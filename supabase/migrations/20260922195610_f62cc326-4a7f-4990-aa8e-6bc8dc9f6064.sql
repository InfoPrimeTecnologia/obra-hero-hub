CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;
CREATE OR REPLACE FUNCTION app_private.storage_quota_for_current_user()
RETURNS TABLE (used_bytes bigint, limit_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 WITH owned AS (
  SELECT c.id, c.owner_user_id, c.storage_extra_gb FROM public.customers c
  WHERE c.id = (SELECT public.current_user_customer_id()) LIMIT 1
 ), current_plan AS (
  SELECT p.limits FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id JOIN owned o ON o.id=s.customer_id
  WHERE s.status IN ('active','canceled') AND (s.status='active' OR COALESCE(s.access_until,s.next_due_date)>=CURRENT_DATE)
  ORDER BY s.started_at DESC LIMIT 1
 )
 SELECT COALESCE((SELECT SUM((obj.metadata->>'size')::bigint) FROM storage.objects obj CROSS JOIN owned o
  WHERE obj.bucket_id IN ('obra-fotos','obra-documentos','notas-fiscais','colaborador-fotos','produto-fotos')
    AND obj.name LIKE o.id::text||'/%' AND (obj.metadata->>'size') ~ '^[0-9]+$'),0)::bigint
 + COALESCE((SELECT SUM((obj.metadata->>'size')::bigint) FROM storage.objects obj CROSS JOIN owned o
  WHERE obj.bucket_id='avatars' AND obj.name LIKE o.owner_user_id::text||'/%' AND (obj.metadata->>'size') ~ '^[0-9]+$'),0)::bigint AS used_bytes,
 CASE WHEN (SELECT id FROM owned) IS NULL THEN 0::bigint
      WHEN (SELECT limits->>'storage_gb' FROM current_plan) IS NULL THEN NULL::bigint
      ELSE FLOOR((COALESCE((SELECT (limits->>'storage_gb')::numeric FROM current_plan),0)
         +(SELECT storage_extra_gb FROM owned))*1073741824)::bigint END AS limit_bytes;
$$;
REVOKE ALL ON FUNCTION app_private.storage_quota_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.storage_quota_for_current_user() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.my_storage_quota()
RETURNS TABLE (used_bytes bigint, limit_bytes bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT * FROM app_private.storage_quota_for_current_user();
$$;
REVOKE ALL ON FUNCTION public.my_storage_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_storage_quota() TO authenticated, service_role;