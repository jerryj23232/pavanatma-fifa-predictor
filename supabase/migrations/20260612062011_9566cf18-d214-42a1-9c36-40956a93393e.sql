
CREATE OR REPLACE FUNCTION public.prevent_admin_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin'::app_role THEN
    -- Only allow when executed by the service_role (server-side) or postgres superuser
    IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' IS DISTINCT FROM 'service_role'
       AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Assigning the admin role is not allowed via the client. Use a secure server-side process.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_admin_role_escalation_trg ON public.user_roles;
CREATE TRIGGER prevent_admin_role_escalation_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_admin_role_escalation();
