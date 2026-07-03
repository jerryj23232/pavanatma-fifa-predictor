
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  link_url text,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND start_at <= now()
    AND end_at >= now()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX announcements_active_window_idx
  ON public.announcements (is_active, start_at, end_at, priority DESC);

-- Storage policies for the announcements bucket (bucket created via tool)
CREATE POLICY "Public can read announcement posters"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements');

CREATE POLICY "Admins can upload announcement posters"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcement posters"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcement posters"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));
