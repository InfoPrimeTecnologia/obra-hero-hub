CREATE OR REPLACE FUNCTION public.enforce_customer_storage_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_customer uuid; v_owner uuid; v_limit numeric; v_used bigint; v_extra numeric; v_old_size bigint := 0; v_new_size bigint;
BEGIN
  IF NEW.bucket_id NOT IN ('obra-fotos','obra-documentos','notas-fiscais','colaborador-fotos','produto-fotos','avatars') THEN RETURN NEW; END IF;
  IF NEW.name !~ '^[0-9a-fA-F-]{36}/' THEN RETURN NEW; END IF;
  IF NEW.bucket_id = 'avatars' THEN
    SELECT c.id, c.owner_user_id, c.storage_extra_gb INTO v_customer,v_owner,v_extra FROM public.customers c WHERE c.owner_user_id = split_part(NEW.name,'/',1)::uuid LIMIT 1;
  ELSE
    SELECT c.id, c.owner_user_id, c.storage_extra_gb INTO v_customer,v_owner,v_extra FROM public.customers c WHERE c.id = split_part(NEW.name,'/',1)::uuid;
  END IF;
  IF v_customer IS NULL THEN RETURN NEW; END IF;
  SELECT (p.limits->>'storage_gb')::numeric INTO v_limit
  FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id
  WHERE s.customer_id=v_customer AND s.status IN ('active','canceled')
    AND (s.status='active' OR COALESCE(s.access_until,s.next_due_date)>=CURRENT_DATE)
  ORDER BY s.started_at DESC LIMIT 1;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer::text, 420));
  SELECT COALESCE(SUM(CASE WHEN o.metadata->>'size' ~ '^[0-9]+$' THEN (o.metadata->>'size')::bigint ELSE 0 END),0) INTO v_used
  FROM storage.objects o
  WHERE (o.bucket_id IN ('obra-fotos','obra-documentos','notas-fiscais','colaborador-fotos','produto-fotos') AND o.name LIKE v_customer::text||'/%')
     OR (o.bucket_id='avatars' AND o.name LIKE v_owner::text||'/%');
  IF TG_OP='UPDATE' AND OLD.metadata->>'size' ~ '^[0-9]+$' THEN v_old_size := (OLD.metadata->>'size')::bigint; END IF;
  v_new_size := CASE WHEN NEW.metadata->>'size' ~ '^[0-9]+$' THEN (NEW.metadata->>'size')::bigint ELSE 0 END;
  IF v_used - v_old_size + v_new_size > FLOOR((v_limit+v_extra)*1073741824) THEN
    RAISE EXCEPTION 'Armazenamento do plano esgotado. Libere espaço ou aumente a capacidade do plano.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_customer_storage_quota() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_customer_storage_quota ON storage.objects;
CREATE TRIGGER enforce_customer_storage_quota BEFORE INSERT OR UPDATE OF metadata, name, bucket_id ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_storage_quota();