
-- ============================================================
-- 1) Rank movement tracking on user_stats
-- ============================================================
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS current_rank int,
  ADD COLUMN IF NOT EXISTS previous_rank int,
  ADD COLUMN IF NOT EXISTS rank_snapshot_at timestamptz;

CREATE OR REPLACE FUNCTION public.snapshot_leaderboard_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT us.user_id,
           RANK() OVER (ORDER BY us.total_points DESC, us.exact_scores DESC, us.correct_winners DESC) AS rnk
    FROM public.user_stats us
    JOIN auth.users u ON u.id = us.user_id AND u.email_confirmed_at IS NOT NULL
  )
  UPDATE public.user_stats us
  SET previous_rank = us.current_rank,
      current_rank = r.rnk,
      rank_snapshot_at = now()
  FROM ranked r
  WHERE r.user_id = us.user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.snapshot_leaderboard_ranks() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2) Achievements catalog + earned-by-user table
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.achievement_code AS ENUM (
    'first_exact','streak_5','winners_10','points_100','veteran_50','top_3','league_leader'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.achievements (
  code public.achievement_code PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  emoji text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Achievements are public" ON public.achievements;
CREATE POLICY "Achievements are public" ON public.achievements FOR SELECT USING (true);

INSERT INTO public.achievements (code, name, description, emoji, sort_order) VALUES
  ('first_exact',   'First Exact Score',  'Predict an exact final score',          '🎯', 10),
  ('streak_5',      'On Fire',            '5 correct predictions in a row',        '🔥', 20),
  ('winners_10',    'Sharp Caller',       '10 correct winner predictions',         '⚽', 30),
  ('points_100',    'Centurion',          'Reach 100 total points',                '💯', 40),
  ('veteran_50',    'Prediction Veteran', 'Make 50 predictions',                   '🎖️', 50),
  ('top_3',         'Podium Finisher',    'Reach the top 3 on the leaderboard',    '🏆', 60),
  ('league_leader', 'League Leader',      'Reach #1 on the leaderboard',           '👑', 70)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      emoji = EXCLUDED.emoji,
      sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code public.achievement_code NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON public.user_achievements(user_id);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view all achievements" ON public.user_achievements;
CREATE POLICY "Authenticated users can view all achievements"
  ON public.user_achievements FOR SELECT TO authenticated USING (true);

-- Auto-award badges whenever stats are recalculated
CREATE OR REPLACE FUNCTION public.award_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.exact_scores >= 1 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'first_exact')   ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.longest_streak >= 5 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'streak_5')      ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.correct_winners >= 10 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'winners_10')    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.total_points >= 100 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'points_100')    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.predictions_count >= 50 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'veteran_50')    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.current_rank IS NOT NULL AND NEW.current_rank <= 3 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'top_3')         ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.current_rank = 1 THEN
    INSERT INTO public.user_achievements(user_id, code) VALUES (NEW.user_id, 'league_leader') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_stats_award_achievements ON public.user_stats;
CREATE TRIGGER user_stats_award_achievements
  AFTER INSERT OR UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION public.award_achievements();

-- ============================================================
-- 3) Community match-trend RPC (no individual picks revealed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_match_trends(_match_id uuid, _min_predictions int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int := 0;
  home_w int := 0; draw_n int := 0; away_w int := 0;
  top_scores jsonb := '[]'::jsonb;
BEGIN
  SELECT COUNT(*) INTO total FROM public.predictions WHERE match_id = _match_id;
  IF total < _min_predictions THEN
    RETURN jsonb_build_object('total', total, 'enough', false);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE predicted_home > predicted_away),
    COUNT(*) FILTER (WHERE predicted_home = predicted_away),
    COUNT(*) FILTER (WHERE predicted_home < predicted_away)
  INTO home_w, draw_n, away_w
  FROM public.predictions WHERE match_id = _match_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('home', predicted_home, 'away', predicted_away, 'count', c)), '[]'::jsonb)
  INTO top_scores
  FROM (
    SELECT predicted_home, predicted_away, COUNT(*) AS c
    FROM public.predictions
    WHERE match_id = _match_id
    GROUP BY predicted_home, predicted_away
    ORDER BY COUNT(*) DESC
    LIMIT 3
  ) s;

  RETURN jsonb_build_object(
    'total', total,
    'enough', true,
    'home_pct', round((home_w::numeric / total) * 100),
    'draw_pct', round((draw_n::numeric / total) * 100),
    'away_pct', round((away_w::numeric / total) * 100),
    'top_scores', top_scores
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_match_trends(uuid, int) TO authenticated;

-- ============================================================
-- 4) Leaderboard now reads from precomputed user_stats and
--    includes movement + badges in one query
-- ============================================================
DROP FUNCTION IF EXISTS public.get_leaderboard(int);
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit int DEFAULT 100)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  course text,
  avatar_url text,
  total_points int,
  hits int,
  predictions_made int,
  current_rank int,
  previous_rank int,
  badges jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.course,
    p.avatar_url,
    COALESCE(us.total_points, 0)::int,
    COALESCE(us.exact_scores + us.correct_winners, 0)::int AS hits,
    COALESCE(us.predictions_count, 0)::int,
    us.current_rank,
    us.previous_rank,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', ua.code, 'emoji', a.emoji, 'name', a.name, 'description', a.description) ORDER BY a.sort_order)
      FROM public.user_achievements ua
      JOIN public.achievements a ON a.code = ua.code
      WHERE ua.user_id = p.id
    ), '[]'::jsonb) AS badges
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL
  LEFT JOIN public.user_stats us ON us.user_id = p.id
  ORDER BY COALESCE(us.total_points, 0) DESC,
           COALESCE(us.exact_scores, 0) DESC,
           COALESCE(us.correct_winners, 0) DESC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO authenticated;

-- ============================================================
-- 5) Backfill + schedule daily rank snapshot
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT public.snapshot_leaderboard_ranks();

-- Backfill achievements once based on current stats
UPDATE public.user_stats SET updated_at = updated_at;

-- Schedule daily rotation at 03:00 UTC
DO $$ BEGIN
  PERFORM cron.unschedule('snapshot-leaderboard-ranks');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('snapshot-leaderboard-ranks', '0 3 * * *', $$SELECT public.snapshot_leaderboard_ranks();$$);
