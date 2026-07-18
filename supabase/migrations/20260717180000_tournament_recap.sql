-- Rank history gives end-of-tournament stories an honest journey to tell.
CREATE TABLE public.leaderboard_rank_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  total_points integer NOT NULL DEFAULT 0,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX leaderboard_rank_history_user_time_idx
  ON public.leaderboard_rank_history (user_id, snapshot_at DESC);

GRANT SELECT ON public.leaderboard_rank_history TO authenticated;
GRANT ALL ON public.leaderboard_rank_history TO service_role;

ALTER TABLE public.leaderboard_rank_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rank history"
  ON public.leaderboard_rank_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Preserve the existing snapshot fields while retaining a daily history point.
CREATE OR REPLACE FUNCTION public.snapshot_leaderboard_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT
      us.user_id,
      us.total_points,
      RANK() OVER (
        ORDER BY us.total_points DESC, us.exact_scores DESC, us.correct_winners DESC
      ) AS rnk
    FROM public.user_stats us
    JOIN auth.users u ON u.id = us.user_id AND u.email_confirmed_at IS NOT NULL
  )
  INSERT INTO public.leaderboard_rank_history (user_id, rank, total_points)
  SELECT user_id, rnk, total_points
  FROM ranked
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET rank = EXCLUDED.rank,
      total_points = EXCLUDED.total_points,
      snapshot_at = EXCLUDED.snapshot_at;

  WITH ranked AS (
    SELECT
      us.user_id,
      RANK() OVER (
        ORDER BY us.total_points DESC, us.exact_scores DESC, us.correct_winners DESC
      ) AS rnk
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

-- Personalized, authenticated recap data. No other user's raw prediction data
-- is returned to the client; cohort comparisons are aggregated here.
CREATE OR REPLACE FUNCTION public.get_tournament_recap()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := 'Player';
  v_total_matches integer := 0;
  v_completed_matches integer := 0;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_available boolean := false;
  v_total_points integer := 0;
  v_prediction_points integer := 0;
  v_bonus_points integer := 0;
  v_predictions integer := 0;
  v_completed_predictions integer := 0;
  v_exact_scores integer := 0;
  v_correct_winners integer := 0;
  v_accuracy numeric := 0;
  v_longest_streak integer := 0;
  v_final_rank integer;
  v_previous_rank integer;
  v_highest_rank integer;
  v_rank_timeline jsonb := '[]'::jsonb;
  v_best_prediction jsonb := 'null'::jsonb;
  v_heartbreak jsonb := 'null'::jsonb;
  v_badges jsonb := '[]'::jsonb;
  v_facts jsonb := '[]'::jsonb;
  v_top_team text;
  v_top_team_count integer := 0;
  v_draw_predictions integer := 0;
  v_knockout_predictions integer := 0;
  v_knockout_hits integer := 0;
  v_group_points integer := 0;
  v_knockout_points integer := 0;
  v_semifinal_predictions integer := 0;
  v_semifinal_hits integer := 0;
  v_bonus_completed integer := 0;
  v_bonus_missed integer := 0;
  v_exact_percentile integer := 0;
  v_draw_percentile integer := 0;
  v_personality text := 'The Fearless Forecaster';
  v_personality_reason text := 'You showed up, trusted your instincts, and made the tournament your own.';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user_id;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status = 'completed')::integer,
    MIN(kickoff_at),
    MAX(kickoff_at)
  INTO v_total_matches, v_completed_matches, v_started_at, v_ended_at
  FROM public.matches;

  v_available := v_total_matches > 0 AND v_total_matches = v_completed_matches;

  SELECT
    COALESCE(total_points, 0),
    COALESCE(prediction_points, 0),
    COALESCE(bonus_points, 0),
    COALESCE(predictions_count, 0),
    COALESCE(completed_predictions, 0),
    COALESCE(exact_scores, 0),
    COALESCE(correct_winners, 0),
    COALESCE(accuracy_percentage, 0),
    COALESCE(longest_streak, 0),
    previous_rank
  INTO
    v_total_points,
    v_prediction_points,
    v_bonus_points,
    v_predictions,
    v_completed_predictions,
    v_exact_scores,
    v_correct_winners,
    v_accuracy,
    v_longest_streak,
    v_previous_rank
  FROM public.user_stats
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    v_total_points := 0;
    v_prediction_points := 0;
    v_bonus_points := 0;
    v_predictions := 0;
    v_completed_predictions := 0;
    v_exact_scores := 0;
    v_correct_winners := 0;
    v_accuracy := 0;
    v_longest_streak := 0;
    v_previous_rank := NULL;
  END IF;

  SELECT rnk INTO v_final_rank
  FROM (
    SELECT
      p.id,
      RANK() OVER (
        ORDER BY COALESCE(us.total_points, 0) DESC,
                 COALESCE(us.exact_scores, 0) DESC,
                 COALESCE(us.correct_winners, 0) DESC
      )::integer AS rnk
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL
    LEFT JOIN public.user_stats us ON us.user_id = p.id
  ) ranked
  WHERE id = v_user_id;

  SELECT MIN(rank) INTO v_highest_rank
  FROM public.leaderboard_rank_history
  WHERE user_id = v_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('rank', rank, 'points', total_points, 'at', snapshot_at)
      ORDER BY snapshot_at
    ),
    '[]'::jsonb
  )
  INTO v_rank_timeline
  FROM (
    SELECT rank, total_points, snapshot_at
    FROM public.leaderboard_rank_history
    WHERE user_id = v_user_id
    ORDER BY snapshot_at DESC
    LIMIT 12
  ) history;

  SELECT jsonb_build_object(
    'home_team', m.home_team,
    'away_team', m.away_team,
    'stage', m.stage,
    'predicted_home', p.predicted_home,
    'predicted_away', p.predicted_away,
    'home_score', m.home_score,
    'away_score', m.away_score,
    'points', p.points
  )
  INTO v_best_prediction
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = v_user_id
    AND m.status = 'completed'
    AND p.predicted_home = m.home_score
    AND p.predicted_away = m.away_score
  ORDER BY m.kickoff_at
  LIMIT 1;

  SELECT jsonb_build_object(
    'home_team', m.home_team,
    'away_team', m.away_team,
    'stage', m.stage,
    'predicted_home', p.predicted_home,
    'predicted_away', p.predicted_away,
    'home_score', m.home_score,
    'away_score', m.away_score,
    'miss_by', ABS(p.predicted_home - m.home_score) + ABS(p.predicted_away - m.away_score)
  )
  INTO v_heartbreak
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = v_user_id
    AND m.status = 'completed'
    AND m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
    AND (p.predicted_home <> m.home_score OR p.predicted_away <> m.away_score)
  ORDER BY
    ABS(p.predicted_home - m.home_score) + ABS(p.predicted_away - m.away_score),
    p.points DESC,
    m.kickoff_at
  LIMIT 1;

  SELECT team, COUNT(*)::integer
  INTO v_top_team, v_top_team_count
  FROM (
    SELECT m.home_team AS team
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = v_user_id AND p.predicted_home > p.predicted_away
    UNION ALL
    SELECT m.away_team AS team
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = v_user_id AND p.predicted_away > p.predicted_home
  ) picks
  GROUP BY team
  ORDER BY COUNT(*) DESC, team
  LIMIT 1;

  SELECT
    COUNT(*) FILTER (WHERE p.predicted_home = p.predicted_away)::integer,
    COUNT(*) FILTER (WHERE m.stage <> 'Group Stage')::integer,
    COUNT(*) FILTER (WHERE m.stage <> 'Group Stage' AND p.points > 0)::integer,
    COALESCE(SUM(p.points) FILTER (WHERE m.stage = 'Group Stage'), 0)::integer,
    COALESCE(SUM(p.points) FILTER (WHERE m.stage <> 'Group Stage'), 0)::integer,
    COUNT(*) FILTER (WHERE m.stage = 'Semi-final')::integer,
    COUNT(*) FILTER (WHERE m.stage = 'Semi-final' AND p.points > 0)::integer
  INTO
    v_draw_predictions,
    v_knockout_predictions,
    v_knockout_hits,
    v_group_points,
    v_knockout_points,
    v_semifinal_predictions,
    v_semifinal_hits
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = v_user_id;

  SELECT
    COUNT(bp.id)::integer,
    GREATEST(COUNT(bc.id) FILTER (WHERE bc.deadline <= now()) - COUNT(bp.id), 0)::integer
  INTO v_bonus_completed, v_bonus_missed
  FROM public.bonus_challenges bc
  LEFT JOIN public.bonus_predictions bp
    ON bp.challenge_id = bc.id AND bp.user_id = v_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'code', ua.code,
        'emoji', a.emoji,
        'name', a.name,
        'description', a.description
      )
      ORDER BY a.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_badges
  FROM public.user_achievements ua
  JOIN public.achievements a ON a.code = ua.code
  WHERE ua.user_id = v_user_id;

  SELECT COALESCE(
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE us.exact_scores < v_exact_scores)
      / NULLIF(COUNT(*), 0)
    ),
    0
  )::integer
  INTO v_exact_percentile
  FROM public.user_stats us
  JOIN auth.users u ON u.id = us.user_id AND u.email_confirmed_at IS NOT NULL
  WHERE us.predictions_count > 0;

  SELECT COALESCE(
    ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE COALESCE(draws.draw_count, 0) < v_draw_predictions
      ) / NULLIF(COUNT(*), 0)
    ),
    0
  )::integer
  INTO v_draw_percentile
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL
  LEFT JOIN (
    SELECT user_id, COUNT(*) FILTER (WHERE predicted_home = predicted_away)::integer AS draw_count
    FROM public.predictions
    GROUP BY user_id
  ) draws ON draws.user_id = p.id;

  IF v_predictions = v_total_matches AND v_total_matches > 0 THEN
    v_facts := v_facts || jsonb_build_array('You showed up for every match of the tournament.');
  END IF;
  IF v_knockout_predictions > 0 AND v_knockout_predictions = v_knockout_hits THEN
    v_facts := v_facts || jsonb_build_array('You never missed a knockout prediction.');
  END IF;
  IF v_semifinal_predictions > 0 AND v_semifinal_predictions = v_semifinal_hits THEN
    v_facts := v_facts || jsonb_build_array('You called every semifinal result correctly.');
  END IF;
  IF v_top_team IS NOT NULL THEN
    v_facts := v_facts || jsonb_build_array(
      format('You backed %s to win %s time%s.', v_top_team, v_top_team_count, CASE WHEN v_top_team_count = 1 THEN '' ELSE 's' END)
    );
  END IF;
  IF v_group_points > v_knockout_points THEN
    v_facts := v_facts || jsonb_build_array('Your best work came during the group stage.');
  ELSIF v_knockout_points > v_group_points THEN
    v_facts := v_facts || jsonb_build_array('You saved your strongest calls for the knockout rounds.');
  END IF;
  IF v_exact_scores > 0 AND v_exact_percentile > 0 THEN
    v_facts := v_facts || jsonb_build_array(
      format('You made more exact calls than %s%% of players.', v_exact_percentile)
    );
  END IF;
  IF v_draw_predictions > 0 AND v_draw_percentile >= 60 THEN
    v_facts := v_facts || jsonb_build_array(
      format('You predicted draws more often than %s%% of players.', v_draw_percentile)
    );
  END IF;

  IF v_accuracy >= 55 AND v_exact_scores >= 3 THEN
    v_personality := 'The Ice-Cold Analyst';
    v_personality_reason := 'Your accuracy and eye for exact scores made your calls feel calculated.';
  ELSIF v_exact_scores >= 5 THEN
    v_personality := 'The Tactical Genius';
    v_personality_reason := 'You saw scorelines other players missed and turned detail into points.';
  ELSIF v_draw_predictions > 0 AND v_draw_percentile >= 60 THEN
    v_personality := 'The Risk Taker';
    v_personality_reason := 'You were willing to make the calls most players avoided.';
  ELSIF v_total_matches > 0 AND v_predictions::numeric / v_total_matches >= 0.8 THEN
    v_personality := 'The Reliable Starter';
    v_personality_reason := 'Match after match, you were there with a call before kickoff.';
  END IF;

  RETURN jsonb_build_object(
    'available', v_available,
    'tournament', jsonb_build_object(
      'matches', v_total_matches,
      'completed_matches', v_completed_matches,
      'started_at', v_started_at,
      'ended_at', v_ended_at
    ),
    'player', jsonb_build_object(
      'full_name', COALESCE(NULLIF(v_name, ''), 'Player'),
      'total_points', v_total_points,
      'prediction_points', v_prediction_points,
      'bonus_points', v_bonus_points,
      'predictions', v_predictions,
      'completed_predictions', v_completed_predictions,
      'exact_scores', v_exact_scores,
      'correct_winners', v_correct_winners,
      'accuracy', v_accuracy,
      'longest_streak', v_longest_streak
    ),
    'leaderboard', jsonb_build_object(
      'final_rank', v_final_rank,
      'previous_rank', v_previous_rank,
      'highest_rank', COALESCE(v_highest_rank, v_final_rank),
      'timeline', v_rank_timeline
    ),
    'best_prediction', COALESCE(v_best_prediction, 'null'::jsonb),
    'heartbreak', COALESCE(v_heartbreak, 'null'::jsonb),
    'bonus', jsonb_build_object(
      'completed', v_bonus_completed,
      'missed', v_bonus_missed,
      'points', v_bonus_points
    ),
    'behaviour', jsonb_build_object(
      'draw_predictions', v_draw_predictions,
      'knockout_predictions', v_knockout_predictions,
      'knockout_hits', v_knockout_hits,
      'group_points', v_group_points,
      'knockout_points', v_knockout_points,
      'most_backed_team', v_top_team,
      'most_backed_team_count', v_top_team_count
    ),
    'achievements', v_badges,
    'fun_facts', v_facts,
    'personality', jsonb_build_object('name', v_personality, 'reason', v_personality_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tournament_recap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tournament_recap() TO authenticated;
