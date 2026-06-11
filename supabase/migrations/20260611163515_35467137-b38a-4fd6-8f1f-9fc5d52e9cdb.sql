
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  course TEXT,
  year TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Matches
CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'completed');

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_flag TEXT,
  away_flag TEXT,
  stage TEXT NOT NULL DEFAULT 'Group Stage',
  group_name TEXT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  venue TEXT,
  status match_status NOT NULL DEFAULT 'scheduled',
  home_score INT,
  away_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select_all_auth" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_admin_all" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER matches_touch BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Predictions
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_home INT NOT NULL,
  predicted_away INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id),
  CHECK (predicted_home >= 0 AND predicted_away >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions_select_all_auth" ON public.predictions FOR SELECT TO authenticated USING (true);

-- Block writes after kickoff using a trigger (CHECK cannot use now())
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m_kickoff TIMESTAMPTZ; m_status match_status;
BEGIN
  SELECT kickoff_at, status INTO m_kickoff, m_status FROM public.matches WHERE id = NEW.match_id;
  IF m_kickoff IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF now() >= m_kickoff OR m_status <> 'scheduled' THEN
    RAISE EXCEPTION 'Predictions are locked for this match';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER predictions_lock_insert BEFORE INSERT ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_lock();
CREATE TRIGGER predictions_lock_update BEFORE UPDATE OF predicted_home, predicted_away ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_lock();

CREATE POLICY "predictions_insert_own" ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_update_own" ON public.predictions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_delete_own" ON public.predictions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER predictions_touch BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-score predictions when a match is completed
CREATE OR REPLACE FUNCTION public.calc_points(_ph INT, _pa INT, _ah INT, _aw INT)
RETURNS INT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN _ph = _ah AND _pa = _aw THEN 3
    WHEN sign(_ph - _pa) = sign(_ah - _aw) THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.score_predictions_on_match_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.predictions
      SET points = public.calc_points(predicted_home, predicted_away, NEW.home_score, NEW.away_score),
          updated_at = now()
      WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER matches_score_predictions AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.score_predictions_on_match_complete();

-- Leaderboard view
CREATE OR REPLACE VIEW public.leaderboard AS
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
