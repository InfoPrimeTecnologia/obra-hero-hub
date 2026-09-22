ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS storage_extra_gb numeric(10,2) NOT NULL DEFAULT 0 CHECK (storage_extra_gb >= 0);

CREATE OR REPLACE FUNCTION public.my_storage_quota()
RETURNS TABLE (used_bytes bigint, limit_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH owned AS (
    SELECT c.id, c.owner_user_id, c.storage_extra_gb
    FROM public.customers c
    WHERE c.owner_user_id = (SELECT auth.uid())
    LIMIT 1
  ), current_plan AS (
    SELECT p.limits
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    JOIN owned o ON o.id = s.customer_id
    WHERE s.status IN ('active','canceled')
      AND (s.status = 'active' OR COALESCE(s.access_until, s.next_due_date) >= CURRENT_DATE)
    ORDER BY s.started_at DESC LIMIT 1
  )
  SELECT COALESCE((
      SELECT SUM(COALESCE((obj.metadata->>'size')::bigint, 0))
      FROM storage.objects obj CROSS JOIN owned o
      WHERE obj.bucket_id IN ('obra-fotos','obra-documentos','notas-fiscais','colaborador-fotos','produto-fotos')
        AND obj.name LIKE o.id::text || '/%'
        AND (obj.metadata->>'size') ~ '^[0-9]+$'
    ), 0)::bigint + COALESCE((
      SELECT SUM(COALESCE((obj.metadata->>'size')::bigint, 0))
      FROM storage.objects obj CROSS JOIN owned o
      WHERE obj.bucket_id = 'avatars'
        AND obj.name LIKE o.owner_user_id::text || '/%'
        AND (obj.metadata->>'size') ~ '^[0-9]+$'
    ), 0)::bigint AS used_bytes,
    CASE WHEN (SELECT id FROM owned) IS NULL THEN 0::bigint
         WHEN (SELECT limits->>'storage_gb' FROM current_plan) IS NULL THEN NULL::bigint
         ELSE FLOOR((COALESCE((SELECT (limits->>'storage_gb')::numeric FROM current_plan), 0)
           + (SELECT storage_extra_gb FROM owned)) * 1073741824)::bigint
    END AS limit_bytes;
$$;
REVOKE ALL ON FUNCTION public.my_storage_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_storage_quota() TO authenticated, service_role;