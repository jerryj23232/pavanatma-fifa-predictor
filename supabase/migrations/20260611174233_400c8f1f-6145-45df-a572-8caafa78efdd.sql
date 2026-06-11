-- Add minute column for live match progress
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS minute INTEGER;

-- Enable required extensions for scheduled sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name
DO $$ BEGIN
  PERFORM cron.unschedule('auto-sync-matches');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Schedule auto-sync every 5 minutes
SELECT cron.schedule(
  'auto-sync-matches',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pavanatma-fifa-predictor.lovable.app/api/public/hooks/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bmJhbmh3bG16dHhtYnZlZHduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTA3NzQsImV4cCI6MjA5Njc2Njc3NH0.Kbb-08wu6zOrISUujOvGU-6qtHn5JEm3C36QCo6cSVA'
    ),
    body := '{}'::jsonb
  );
  $$
);