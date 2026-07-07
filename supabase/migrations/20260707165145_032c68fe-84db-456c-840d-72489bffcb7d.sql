
-- 1. Add nullable advancing_team column (safe extension)
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS advancing_team text NULL;

-- 2. Helper: is a stage a knockout stage?
CREATE OR REPLACE FUNCTION public.is_knockout_stage(_stage text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _stage IS NOT NULL AND _stage <> 'Group Stage';
$$;

-- 3. Replace scoring trigger to support knockout draw predictions
CREATE OR REPLACE FUNCTION public.score_predictions_on_match_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_adv text;
BEGIN
  IF NEW.status = 'completed' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    -- Derive actual advancing team from matches.winner (set by football-data sync)
    actual_adv := CASE
      WHEN NEW.winner = 'HOME_TEAM' THEN NEW.home_team
      WHEN NEW.winner = 'AWAY_TEAM' THEN NEW.away_team
      ELSE NULL
    END;

    UPDATE public.predictions p
      SET points = CASE
        -- Knockout draw prediction: needs advancing team to score
        WHEN public.is_knockout_stage(NEW.stage) AND p.predicted_home = p.predicted_away THEN
          CASE
            WHEN p.advancing_team IS NOT NULL
              AND actual_adv IS NOT NULL
              AND p.advancing_team = actual_adv
              AND p.predicted_home = NEW.home_score
              AND p.predicted_away = NEW.away_score
              THEN 3
            WHEN p.advancing_team IS NOT NULL
              AND actual_adv IS NOT NULL
              AND p.advancing_team = actual_adv
              THEN 1
            ELSE 0
          END
        -- Everything else: unchanged behaviour
        ELSE public.calc_points(p.predicted_home, p.predicted_away, NEW.home_score, NEW.away_score)
      END,
      updated_at = now()
    WHERE p.match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Validation: require advancing_team for knockout draws; ignore otherwise
CREATE OR REPLACE FUNCTION public.validate_advancing_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_stage text;
  m_home text;
  m_away text;
BEGIN
  SELECT stage, home_team, away_team INTO m_stage, m_home, m_away
    FROM public.matches WHERE id = NEW.match_id;

  IF public.is_knockout_stage(m_stage) AND NEW.predicted_home = NEW.predicted_away THEN
    IF NEW.advancing_team IS NULL THEN
      RAISE EXCEPTION 'Advancing team is required for a knockout draw prediction';
    END IF;
    IF NEW.advancing_team <> m_home AND NEW.advancing_team <> m_away THEN
      RAISE EXCEPTION 'Advancing team must be one of the two teams in the match';
    END IF;
  ELSE
    -- Non-knockout or non-draw prediction: normalize to NULL
    NEW.advancing_team := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_advancing_team ON public.predictions;
CREATE TRIGGER trg_validate_advancing_team
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.validate_advancing_team();
