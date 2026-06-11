CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, full_name text, course text, avatar_url text, total_points integer, hits integer, predictions_made integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.full_name,
    p.course,
    p.avatar_url,
    COALESCE(sum(pr.points), 0)::int,
    count(pr.id) FILTER (WHERE pr.points > 0)::int,
    count(pr.id)::int
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL
  LEFT JOIN public.predictions pr ON pr.user_id = p.id
  GROUP BY p.id, p.full_name, p.course, p.avatar_url
  ORDER BY COALESCE(sum(pr.points), 0) DESC,
           count(pr.id) FILTER (WHERE pr.points > 0) DESC
  LIMIT _limit;
$function$;