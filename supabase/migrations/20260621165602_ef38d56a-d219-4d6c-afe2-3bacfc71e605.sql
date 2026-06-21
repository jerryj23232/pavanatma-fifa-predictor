
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
