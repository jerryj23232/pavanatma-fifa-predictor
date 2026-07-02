
CREATE TABLE public.bonus_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  team_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_teams JSONB,
  deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bonus_challenges TO authenticated;
GRANT ALL ON public.bonus_challenges TO service_role;

ALTER TABLE public.bonus_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active bonus challenges"
  ON public.bonus_challenges FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage bonus challenges"
  ON public.bonus_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER bonus_challenges_touch
  BEFORE UPDATE ON public.bonus_challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.bonus_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.bonus_challenges(id) ON DELETE CASCADE,
  teams JSONB NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  awarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonus_predictions TO authenticated;
GRANT ALL ON public.bonus_predictions TO service_role;

ALTER TABLE public.bonus_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bonus predictions"
  ON public.bonus_predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bonus predictions"
  ON public.bonus_predictions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own bonus predictions before deadline"
  ON public.bonus_predictions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND jsonb_typeof(teams) = 'array'
    AND jsonb_array_length(teams) = 4
    AND EXISTS (
      SELECT 1 FROM public.bonus_challenges c
      WHERE c.id = challenge_id AND c.is_active = true AND c.deadline > now()
    )
  );

CREATE POLICY "Users can update their own bonus predictions before deadline"
  ON public.bonus_predictions FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bonus_challenges c
      WHERE c.id = challenge_id AND c.is_active = true AND c.deadline > now()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND jsonb_typeof(teams) = 'array'
    AND jsonb_array_length(teams) = 4
  );

CREATE POLICY "Admins can manage all bonus predictions"
  ON public.bonus_predictions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER bonus_predictions_touch
  BEFORE UPDATE ON public.bonus_predictions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Function admins call to evaluate a challenge: awards bonus_points to user_stats
CREATE OR REPLACE FUNCTION public.evaluate_bonus_challenge(_challenge_id UUID, _correct_teams JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  correct_count INT;
  pts INT;
  updated_rows INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can evaluate bonus challenges';
  END IF;
  IF jsonb_typeof(_correct_teams) <> 'array' OR jsonb_array_length(_correct_teams) <> 4 THEN
    RAISE EXCEPTION 'correct_teams must be a JSON array of 4 team names';
  END IF;

  UPDATE public.bonus_challenges
    SET correct_teams = _correct_teams, evaluated_at = now(), is_active = false
    WHERE id = _challenge_id;

  -- Reset previously awarded points for this challenge
  FOR r IN
    SELECT * FROM public.bonus_predictions WHERE challenge_id = _challenge_id
  LOOP
    IF r.points_awarded > 0 THEN
      UPDATE public.user_stats
        SET bonus_points = GREATEST(0, bonus_points - r.points_awarded)
        WHERE user_id = r.user_id;
    END IF;

    SELECT COUNT(*) INTO correct_count
    FROM jsonb_array_elements_text(r.teams) t(team)
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(_correct_teams) c(team) WHERE c.team = t.team
    );

    pts := CASE correct_count
      WHEN 4 THEN 10
      WHEN 3 THEN 5
      WHEN 2 THEN 3
      WHEN 1 THEN 2
      ELSE 0
    END;

    UPDATE public.bonus_predictions
      SET points_awarded = pts, awarded_at = now()
      WHERE id = r.id;

    IF pts > 0 THEN
      INSERT INTO public.user_stats (user_id, bonus_points)
        VALUES (r.user_id, pts)
        ON CONFLICT (user_id) DO UPDATE
          SET bonus_points = public.user_stats.bonus_points + pts;
    END IF;

    updated_rows := updated_rows + 1;
  END LOOP;

  RETURN updated_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_bonus_challenge(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.evaluate_bonus_challenge(UUID, JSONB) TO authenticated;
