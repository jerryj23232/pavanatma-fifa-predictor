
-- 1) Restrict predictions SELECT: own predictions, or predictions for matches that have kicked off / completed
DROP POLICY IF EXISTS predictions_select_all_auth ON public.predictions;

CREATE POLICY predictions_select_own_or_locked ON public.predictions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = predictions.match_id
      AND (m.status <> 'scheduled' OR now() >= m.kickoff_at)
  )
);

-- 2) Recreate leaderboard view WITHOUT security_invoker so aggregate stats still work for everyone
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard
WITH (security_invoker = false) AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.course,
  p.avatar_url,
  COALESCE(sum(pr.points), 0)::int AS total_points,
  count(pr.id) FILTER (WHERE pr.points > 0)::int AS hits,
  count(pr.id)::int AS predictions_made
FROM public.profiles p
LEFT JOIN public.predictions pr ON pr.user_id = p.id
GROUP BY p.id, p.full_name, p.course, p.avatar_url;

GRANT SELECT ON public.leaderboard TO authenticated;

-- 3) Fix mutable search_path on calc_points
CREATE OR REPLACE FUNCTION public.calc_points(_ph integer, _pa integer, _ah integer, _aw integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _ph = _ah AND _pa = _aw THEN 3
    WHEN sign(_ph - _pa) = sign(_ah - _aw) THEN 1
    ELSE 0
  END;
$$;

-- 4) Revoke EXECUTE on SECURITY DEFINER trigger/helper functions from public/authenticated/anon.
--    Trigger functions are invoked by the database engine, not by clients, so they don't need EXECUTE
--    grants. has_role stays executable because RLS policies and application code call it.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_prediction_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_predictions_on_match_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
