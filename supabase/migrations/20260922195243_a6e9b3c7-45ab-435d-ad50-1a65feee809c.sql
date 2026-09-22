CREATE OR REPLACE FUNCTION public.enforce_plan_max_obras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_limit integer; v_count bigint;
BEGIN
  IF NEW.status = 'arquivada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'arquivada' AND OLD.customer_id = NEW.customer_id THEN RETURN NEW; END IF;
  SELECT (p.limits->>'max_obras')::integer INTO v_limit
  FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id
  WHERE s.customer_id=NEW.customer_id AND s.status IN ('active','canceled')
    AND (s.status='active' OR COALESCE(s.access_until,s.next_due_date)>=CURRENT_DATE)
  ORDER BY s.started_at DESC LIMIT 1;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.customer_id::text, 421));
  SELECT count(*) INTO v_count FROM public.obras WHERE customer_id=NEW.customer_id AND status <> 'arquivada'
    AND (TG_OP='INSERT' OR id <> NEW.id);
  IF v_count >= v_limit THEN RAISE EXCEPTION 'Limite de obras do plano atingido (%).', v_limit; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_plan_max_obras() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_plan_max_obras ON public.obras;
CREATE TRIGGER enforce_plan_max_obras BEFORE INSERT OR UPDATE OF status,customer_id ON public.obras FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_max_obras();