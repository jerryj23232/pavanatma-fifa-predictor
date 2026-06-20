
CREATE INDEX IF NOT EXISTS idx_matches_kickoff_status ON public.matches (kickoff_at, status);
CREATE INDEX IF NOT EXISTS idx_predictions_match_user ON public.predictions (match_id, user_id);

CREATE OR REPLACE FUNCTION public.get_period_leaderboard(_period text, _limit int DEFAULT 3)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  total_points int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      CASE WHEN _period = 'week'
        THEN date_trunc('week', now())
        ELSE date_trunc('day', now())
      END AS start_at,
      CASE WHEN _period = 'week'
        THEN date_trunc('week', now()) + interval '1 week'
        ELSE date_trunc('day', now()) + interval '1 day'
      END AS end_at
  )
  SELECT
    p.user_id,
    pr.full_name,
    pr.avatar_url,
    COALESCE(SUM(p.points), 0)::int AS total_points
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  JOIN public.profiles pr ON pr.id = p.user_id
  JOIN auth.users u ON u.id = p.user_id AND u.email_confirmed_at IS NOT NULL
  CROSS JOIN bounds b
  WHERE m.status = 'completed'
    AND m.kickoff_at >= b.start_at
    AND m.kickoff_at < b.end_at
    AND p.points > 0
  GROUP BY p.user_id, pr.full_name, pr.avatar_url
  HAVING COALESCE(SUM(p.points), 0) > 0
  ORDER BY total_points DESC, pr.full_name ASC
  LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.get_period_leaderboard(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_period_leaderboard(text, int) TO authenticated;
