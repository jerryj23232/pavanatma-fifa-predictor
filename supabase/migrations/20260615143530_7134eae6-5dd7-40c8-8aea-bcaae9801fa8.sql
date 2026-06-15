
-- 1. user_stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points int NOT NULL DEFAULT 0,
  exact_scores int NOT NULL DEFAULT 0,
  correct_winners int NOT NULL DEFAULT 0,
  predictions_count int NOT NULL DEFAULT 0,
  completed_predictions int NOT NULL DEFAULT 0,
  accuracy_percentage numeric NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  best_matchday_score int NOT NULL DEFAULT 0,
  average_points_per_match numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_stats_select_all_auth ON public.user_stats
  FOR SELECT TO authenticated USING (true);

-- 2. recalc function (scoped to one user)
CREATE OR REPLACE FUNCTION public.recalc_user_stats(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_points int := 0;
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
  INTO v_total_points, v_total_preds, v_completed, v_exact, v_winners
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
    v_avg := round(v_total_points::numeric / v_completed, 2);
    v_acc := round(((v_exact + v_winners)::numeric / v_completed) * 100, 1);
  END IF;

  INSERT INTO public.user_stats AS us (
    user_id, total_points, exact_scores, correct_winners,
    predictions_count, completed_predictions, accuracy_percentage,
    current_streak, longest_streak, best_matchday_score,
    average_points_per_match, updated_at
  ) VALUES (
    _user_id, v_total_points, v_exact, v_winners,
    v_total_preds, v_completed, v_acc,
    v_cur, v_lng, v_best_day, v_avg, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
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

-- 3. Trigger on predictions: recalc when row changes (insert/update/delete)
CREATE OR REPLACE FUNCTION public.trg_recalc_user_stats_on_prediction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_user_stats(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_user_stats(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS predictions_recalc_user_stats ON public.predictions;
CREATE TRIGGER predictions_recalc_user_stats
AFTER INSERT OR UPDATE OR DELETE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_user_stats_on_prediction();

-- 4. Trigger on matches: when a match completes, recalc every affected user
CREATE OR REPLACE FUNCTION public.trg_recalc_user_stats_on_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'completed' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    FOR r IN SELECT DISTINCT user_id FROM public.predictions WHERE match_id = NEW.id LOOP
      PERFORM public.recalc_user_stats(r.user_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Must run AFTER score_predictions_on_match_complete (alphabetical: 'u' > 's')
DROP TRIGGER IF EXISTS u_matches_recalc_user_stats ON public.matches;
CREATE TRIGGER u_matches_recalc_user_stats
AFTER UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_user_stats_on_match();

-- 5. Backfill rows for all existing users
INSERT INTO public.user_stats (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalc_user_stats(r.id);
  END LOOP;
END $$;

-- 6. Ensure new users get a stats row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
