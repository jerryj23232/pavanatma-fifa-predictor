
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard WITH (security_invoker = true) AS
  SELECT
    p.id AS user_id,
    p.full_name,
    p.course,
    p.avatar_url,
    COALESCE(SUM(pr.points), 0)::INT AS total_points,
    COUNT(pr.id) FILTER (WHERE pr.points > 0)::INT AS hits,
    COUNT(pr.id)::INT AS predictions_made
  FROM public.profiles p
  LEFT JOIN public.predictions pr ON pr.user_id = p.id
  GROUP BY p.id, p.full_name, p.course, p.avatar_url;
GRANT SELECT ON public.leaderboard TO authenticated;
