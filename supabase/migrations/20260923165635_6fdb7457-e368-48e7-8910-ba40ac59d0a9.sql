REVOKE ALL ON FUNCTION public.grant_plan_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_plan_credits(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_plan_max_obras() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_plan_max_obras() TO service_role;
REVOKE ALL ON FUNCTION public.guard_customer_storage_extra_gb() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_customer_storage_extra_gb() TO service_role;