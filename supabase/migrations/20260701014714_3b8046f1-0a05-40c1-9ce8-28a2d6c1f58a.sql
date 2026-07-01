
-- 1) Add prediction_points column (backfill from current total_points so ranks don't shift before first recalc)
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS prediction_points integer NOT NULL DEFAULT 0;

UPDATE public.user_stats
SET prediction_points = GREATEST(COALESCE(total_points, 0) - COALESCE(bonus_points, 0), 0)
WHERE prediction_points = 0;

-- 2) Trigger to keep total_points = prediction_points + bonus_points always
CREATE OR REPLACE FUNCTION public.sync_user_stats_total_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.total_points := COALESCE(NEW.prediction_points, 0) + COALESCE(NEW.bonus_points, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_stats_sync_total_points ON public.user_stats;
CREATE TRIGGER user_stats_sync_total_points
BEFORE INSERT OR UPDATE OF prediction_points, bonus_points, total_points
ON public.user_stats
FOR EACH ROW EXECUTE FUNCTION public.sync_user_stats_total_points();

-- One-time normalize existing rows so total_points reflects bonus
UPDATE public.user_stats SET prediction_points = prediction_points;

-- 3) Update recalc_user_stats: preserve bonus_points, write prediction_points; total_points auto-syncs
CREATE OR REPLACE FUNCTION public.recalc_user_stats(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pred_points int := 0;
  v_total_preds int := 0;
  v_completed int := 0;
  v_exact int := 0;
  v_winners int := 0;
  v_best_day int := 0;
  v_cur int := 0;
  v_lng int := 0;
  v_avg numeric := 0;
  v_acc numeric := 0;
  r record;
BEGIN
  SELECT
    COALESCE(SUM(p.points),0),
    COUNT(*),
    COUNT(*) FILTER (WHERE m.status = 'completed' AND m.home_score IS NOT NULL),
    COUNT(*) FILTER (WHERE m.status = 'completed' AND p.predicted_home = m.home_score AND p.predicted_away = m.away_score),
    COUNT(*) FILTER (WHERE m.status = 'completed' AND p.points = 1)
  INTO v_pred_points, v_total_preds, v_completed, v_exact, v_winners
  FROM predictions p JOIN matches m ON m.id = p.match_id
  WHERE p.user_id = _user_id;

  SELECT COALESCE(MAX(day_pts),0) INTO v_best_day
  FROM (
    SELECT SUM(p.points) AS day_pts
    FROM predictions p JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = _user_id AND m.status = 'completed'
    GROUP BY date_trunc('day', m.kickoff_at)
  ) s;

  FOR r IN
    SELECT p.points
    FROM predictions p JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = _user_id AND m.status = 'completed'
    ORDER BY m.kickoff_at ASC
  LOOP
    IF r.points > 0 THEN
      v_cur := v_cur + 1;
      IF v_cur > v_lng THEN v_lng := v_cur; END IF;
    ELSE
      v_cur := 0;
    END IF;
  END LOOP;

  IF v_completed > 0 THEN
    v_avg := round(v_pred_points::numeric / v_completed, 2);
    v_acc := round(((v_exact + v_winners)::numeric / v_completed) * 100, 1);
  END IF;

  INSERT INTO public.user_stats AS us (
    user_id, prediction_points, exact_scores, correct_winners,
    predictions_count, completed_predictions, accuracy_percentage,
    current_streak, longest_streak, best_matchday_score,
    average_points_per_match, updated_at
  ) VALUES (
    _user_id, v_pred_points, v_exact, v_winners,
    v_total_preds, v_completed, v_acc,
    v_cur, v_lng, v_best_day, v_avg, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    prediction_points = EXCLUDED.prediction_points,
    -- bonus_points intentionally NOT touched; trigger recomputes total_points
    exact_scores = EXCLUDED.exact_scores,
    correct_winners = EXCLUDED.correct_winners,
    predictions_count = EXCLUDED.predictions_count,
    completed_predictions = EXCLUDED.completed_predictions,
    accuracy_percentage = EXCLUDED.accuracy_percentage,
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    best_matchday_score = EXCLUDED.best_matchday_score,
    average_points_per_match = EXCLUDED.average_points_per_match,
    updated_at = now();
END;
$$;

-- 4) Update get_user_stats to include bonus in total_points
CREATE OR REPLACE FUNCTION public.get_user_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pred_points int := 0;
  bonus int := 0;
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
  INTO pred_points, total_preds, completed_preds, exact_scores, correct_winners
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  WHERE p.user_id = _user_id;

  SELECT COALESCE(bonus_points, 0) INTO bonus FROM public.user_stats WHERE user_id = _user_id;

  SELECT COALESCE(MAX(day_pts),0) INTO best_matchday
  FROM (
    SELECT SUM(p.points) AS day_pts
    FROM predictions p JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = _user_id AND m.status = 'completed'
    GROUP BY date_trunc('day', m.kickoff_at)
  ) s;

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

  SELECT rnk INTO user_rank FROM (
    SELECT us.user_id, RANK() OVER (ORDER BY COALESCE(us.total_points,0) DESC) AS rnk
    FROM public.user_stats us
  ) x WHERE x.user_id = _user_id;

  IF completed_preds > 0 THEN
    avg_pts := round(pred_points::numeric / completed_preds, 2);
  END IF;

  RETURN jsonb_build_object(
    'total_points', pred_points + COALESCE(bonus, 0),
    'prediction_points', pred_points,
    'bonus_points', COALESCE(bonus, 0),
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
