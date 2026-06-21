
-- Replace public-anon-key webhook auth with a private random secret

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.app_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.app_secrets TO service_role;

-- Seed a random secret only the database knows (once)
INSERT INTO private.app_secrets(key, value)
VALUES ('sync_webhook_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- Verifier: callable only by service_role, uses constant-time-ish comparison
CREATE OR REPLACE FUNCTION public.verify_sync_webhook(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
DECLARE
  expected text;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN false;
  END IF;
  SELECT value INTO expected FROM private.app_secrets WHERE key = 'sync_webhook_secret';
  IF expected IS NULL THEN
    RETURN false;
  END IF;
  -- Length-equal constant-ish compare
  RETURN length(_token) = length(expected)
     AND encode(digest(_token, 'sha256'), 'hex') = encode(digest(expected, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_sync_webhook(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sync_webhook(text) TO service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reschedule cron with the new secret pulled from private.app_secrets at runtime
DO $$ BEGIN
  PERFORM cron.unschedule('auto-sync-matches');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto-sync-matches',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pavanatma-fifa-predictor.lovable.app/api/public/hooks/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key', (SELECT value FROM private.app_secrets WHERE key = 'sync_webhook_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
