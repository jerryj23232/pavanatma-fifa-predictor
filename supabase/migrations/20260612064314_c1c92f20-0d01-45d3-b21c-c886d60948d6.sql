CREATE OR REPLACE FUNCTION public.get_user_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_points int := 0;
  total_preds int := 0;
  completed_preds int := 0;
  exact_scores int := 0;
  correct_winners int := 0;
  best_matchday int := 0;
  current_streak int := 0;
  longest_streak int := 0;
  cur int := 0;
  lng int := 0;
  user_rank int := 0;
  avg_pts numeric := 0;
  r record;
BEGIN
  SELECT
    COALESCE(SUM(p.points),0),
    COUNT(*),
    COUNT(*) FILTER (WHERE m.status = 'completed' AND m.home_score IS NOT NULL),
    COUNT(*) FILTER (WHERE m.status = 'completed' AND p.predicted_home = m.home_score AND p.predicted_away = m.away_score),
    COUNT(*) FILTER (WHERE m.status = 'completed' AND p.points = 1)
  INTO total_points, total_preds, completed_preds, exact_scores, correct_winners
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  WHERE p.user_id = _user_id;

  -- best matchday (single day sum of points)
  SELECT COALESCE(MAX(day_pts),0) INTO best_matchday
  FROM (
    SELECT SUM(p.points) AS day_pts
    FROM predictions p JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = _user_id AND m.status = 'completed'
    GROUP BY date_trunc('day', m.kickoff_at)
  ) s;

  -- streaks: chronological order of completed predictions; a "hit" = points > 0
  FOR r IN
    SELECT p.points
    FROM predictions p JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = _user_id AND m.status = 'completed'
    ORDER BY m.kickoff_at ASC
  LOOP
    IF r.points > 0 THEN
      cur := cur + 1;
      IF cur > lng THEN lng := cur; END IF;
    ELSE
      cur := 0;
    END IF;
  END LOOP;
  current_streak := cur;
  longest_streak := lng;

  -- rank
  SELECT rnk INTO user_rank FROM (
    SELECT user_id, RANK() OVER (ORDER BY COALESCE(SUM(points),0) DESC) AS rnk
    FROM predictions GROUP BY user_id
  ) x WHERE x.user_id = _user_id;

  IF completed_preds > 0 THEN
    avg_pts := round(total_points::numeric / completed_preds, 2);
  END IF;

  RETURN jsonb_build_object(
    'total_points', total_points,
    'total_predictions', total_preds,
    'completed_predictions', completed_preds,
    'exact_scores', exact_scores,
    'correct_winners', correct_winners,
    'accuracy', CASE WHEN completed_preds > 0 THEN round(((exact_scores + correct_winners)::numeric / completed_preds) * 100, 1) ELSE 0 END,
    'best_matchday', best_matchday,
    'current_streak', current_streak,
    'longest_streak', longest_streak,
    'rank', COALESCE(user_rank, 0),
    'avg_points', avg_pts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;