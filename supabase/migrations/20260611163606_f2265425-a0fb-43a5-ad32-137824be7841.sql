
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_prediction_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_predictions_on_match_complete() FROM PUBLIC, anon, authenticated;
