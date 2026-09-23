-- Mestre 360 — produção v1.10.0
-- Execute integralmente no SQL Editor do banco de produção, após as versões anteriores.
-- Idempotente: reaplicar mantém assinaturas e não duplica créditos nem versões.
-- O campo storage_extra_gb pode ser ajustado por empresa para ampliar a franquia.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS storage_extra_gb numeric(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_storage_extra_gb_nonnegative' AND conrelid = 'public.customers'::regclass) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_storage_extra_gb_nonnegative CHECK (storage_extra_gb >= 0);
  END IF;
END $$;

-- Preserva IDs existentes, inclusive quando os IDs de produção diferem dos de testes.
DO $planos$
DECLARE
  n integer;
  existing_id uuid;
  plan_id uuid;
  plan_name text;
  plan_description text;
  plan_price numeric;
  plan_features text[];
  plan_limits jsonb;
BEGIN
  FOR n IN 1..3 LOOP
    IF n = 1 THEN
      plan_id := '6f912ee1-9215-4a0f-9adc-7d1b3f2ab463';
      plan_name := 'PLANO-01'; plan_description := 'Para começar a organizar suas obras.';
      plan_price := 109.90;
      plan_features := ARRAY['1 obra','2 usuários','1,2 GB de armazenamento'];
      plan_limits := '{"max_obras":1,"max_usuarios":2,"max_colaboradores":null,"storage_gb":1.2,"ai_credits":0}'::jsonb;
    ELSIF n = 2 THEN
      plan_id := 'fe3ee892-acfd-4c76-b402-050fe49e742d';
      plan_name := 'PLANO-02'; plan_description := 'Mais obras e equipe, com créditos de IA.';
      plan_price := 179.90;
      plan_features := ARRAY['10 obras','10 usuários','24 GB de armazenamento','300 créditos de IA'];
      plan_limits := '{"max_obras":10,"max_usuarios":10,"max_colaboradores":null,"storage_gb":24,"ai_credits":300}'::jsonb;
    ELSE
      plan_id := '8d9f2899-9bce-49a0-b7f8-c3f14e91873a';
      plan_name := 'PLANO-03'; plan_description := 'Obras e usuários ilimitados, com armazenamento expansível.';
      plan_price := 329.90;
      plan_features := ARRAY['Obras ilimitadas','Usuários ilimitados','60 GB de armazenamento (expansível)','500 créditos de IA'];
      plan_limits := '{"max_obras":null,"max_usuarios":null,"max_colaboradores":null,"storage_gb":60,"ai_credits":500}'::jsonb;
    END IF;
    SELECT id INTO existing_id FROM public.plans
      WHERE id = plan_id OR (display_order = n AND is_active)
      ORDER BY (id = plan_id) DESC LIMIT 1;
    IF existing_id IS NOT NULL THEN
      UPDATE public.plans SET name = plan_name, description = plan_description,
        price = plan_price, cycle = 'monthly', features = plan_features,
        modules = '["obras","financeiro","compras","rh","relatorios","tarefas","agenda"]'::jsonb,
        limits = plan_limits, max_usuarios = CASE WHEN n = 3 THEN 1 ELSE (plan_limits->>'max_usuarios')::integer END,
        is_active = true, is_featured = (n = 2), display_order = n
      WHERE id = existing_id;
    ELSE
      INSERT INTO public.plans (id, name, description, price, cycle, features, modules, limits, max_usuarios, is_active, is_featured, display_order)
      VALUES (plan_id, plan_name, plan_description, plan_price, 'monthly', plan_features,
        '["obras","financeiro","compras","rh","relatorios","tarefas","agenda"]'::jsonb,
        plan_limits, CASE WHEN n = 3 THEN 1 ELSE (plan_limits->>'max_usuarios')::integer END, true, n = 2, n);
    END IF;
  END LOOP;
END;
$planos$;

-- Os donos podem atualizar o cadastro da própria empresa, mas só administradores
-- podem ampliar a franquia de armazenamento (inclusive via API).
CREATE OR REPLACE FUNCTION public.guard_customer_storage_extra_gb()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.storage_extra_gb IS DISTINCT FROM OLD.storage_extra_gb
    AND (SELECT auth.role()) IS DISTINCT FROM 'service_role'
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem alterar armazenamento adicional';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_customer_storage_extra_gb ON public.customers;
CREATE TRIGGER guard_customer_storage_extra_gb BEFORE UPDATE OF storage_extra_gb ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_storage_extra_gb();
REVOKE ALL ON FUNCTION public.guard_customer_storage_extra_gb() FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS credit_tx_unique_plan_invoice ON public.credit_transactions (invoice_id)
  WHERE action_key = 'plan_grant' AND invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_plan_credits(_invoice_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_customer uuid; v_amount integer; v_balance integer;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT i.customer_id, GREATEST(0, LEAST(100000, COALESCE((p.limits->>'ai_credits')::integer, 0)))
    INTO v_customer, v_amount
    FROM public.invoices i JOIN public.subscriptions s ON s.id = i.subscription_id AND s.customer_id = i.customer_id
    JOIN public.plans p ON p.id = s.plan_id WHERE i.id = _invoice_id AND i.status = 'paid';
  IF v_customer IS NULL OR v_amount IS NULL OR v_amount = 0 THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer::text, 719));
  IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE invoice_id = _invoice_id AND action_key = 'plan_grant') THEN RETURN 0; END IF;
  INSERT INTO public.customer_credits(customer_id, saldo) VALUES (v_customer, 0) ON CONFLICT (customer_id) DO NOTHING;
  UPDATE public.customer_credits SET saldo = saldo + v_amount, updated_at = now()
    WHERE customer_id = v_customer RETURNING saldo INTO v_balance;
  INSERT INTO public.credit_transactions(customer_id,tipo,delta,saldo_apos,action_key,descricao,invoice_id)
    VALUES (v_customer,'ajuste',v_amount,v_balance,'plan_grant','Créditos incluídos no plano',_invoice_id);
  RETURN v_amount;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_plan_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_plan_credits(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_plan_max_obras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_limit integer; v_count bigint;
BEGIN
  IF NEW.status = 'arquivada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'arquivada' AND OLD.customer_id = NEW.customer_id THEN RETURN NEW; END IF;
  SELECT (p.limits->>'max_obras')::integer INTO v_limit
    FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
    WHERE s.customer_id = NEW.customer_id AND s.status IN ('active','canceled')
      AND (s.status = 'active' OR COALESCE(s.access_until,s.next_due_date) >= CURRENT_DATE)
    ORDER BY s.started_at DESC LIMIT 1;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.customer_id::text, 421));
  SELECT count(*) INTO v_count FROM public.obras WHERE customer_id = NEW.customer_id AND status <> 'arquivada'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF v_count >= v_limit THEN RAISE EXCEPTION 'Limite de obras do plano atingido (%).', v_limit; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_plan_max_obras() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_plan_max_obras ON public.obras;
CREATE TRIGGER enforce_plan_max_obras BEFORE INSERT OR UPDATE OF status,customer_id ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_max_obras();

-- Função privada consulta o tamanho real dos arquivos. A função pública não expõe privilégios elevados.
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
  WHERE obj.bucket_id='avatars' AND (obj.name LIKE o.owner_user_id::text||'/%'
    OR EXISTS (SELECT 1 FROM public.customer_members m WHERE m.customer_id=o.id AND m.status='ativo' AND obj.name LIKE m.user_id::text||'/%'))
    AND (obj.metadata->>'size') ~ '^[0-9]+$'),0)::bigint AS used_bytes,
 CASE WHEN (SELECT id FROM owned) IS NULL THEN 0::bigint
      WHEN NOT EXISTS (SELECT 1 FROM current_plan) THEN 0::bigint
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

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.10.0','Novos planos e armazenamento por empresa',
  '[{"type":"feature","description":"PLANO-01, PLANO-02 e PLANO-03 com preços e limites atualizados"},{"type":"improvement","description":"Consumo de armazenamento exibido em tempo real na assinatura e capacidade adicional configurável por empresa"},{"type":"improvement","description":"Créditos de IA incluídos após confirmação de cada mensalidade paga"}]'::jsonb, now())
ON CONFLICT (version) DO UPDATE SET highlight=EXCLUDED.highlight, items=EXCLUDED.items;
