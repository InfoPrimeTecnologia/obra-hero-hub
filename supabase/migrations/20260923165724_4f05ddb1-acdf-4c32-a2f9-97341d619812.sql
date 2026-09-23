REVOKE ALL ON FUNCTION public.my_storage_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_storage_quota() TO authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.storage_quota_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.storage_quota_for_current_user() TO authenticated, service_role;