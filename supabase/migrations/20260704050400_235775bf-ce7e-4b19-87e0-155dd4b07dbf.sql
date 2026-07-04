ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.announcements SET images = jsonb_build_array(image_url) WHERE (images IS NULL OR jsonb_array_length(images) = 0) AND image_url IS NOT NULL AND image_url <> '';
ALTER TABLE public.announcements ALTER COLUMN image_url DROP NOT NULL;