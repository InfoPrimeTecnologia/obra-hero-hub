CREATE UNIQUE INDEX IF NOT EXISTS credit_tx_unique_plan_invoice ON public.credit_transactions (invoice_id) WHERE action_key = 'plan_grant' AND invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_plan_credits(_invoice_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_customer uuid; v_amount integer; v_balance integer;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT i.customer_id, GREATEST(0, LEAST(100000, COALESCE((p.limits->>'ai_credits')::integer, 0)))
  INTO v_customer, v_amount
  FROM public.invoices i
  JOIN public.subscriptions s ON s.id = i.subscription_id AND s.customer_id = i.customer_id
  JOIN public.plans p ON p.id = s.plan_id
  WHERE i.id = _invoice_id AND i.status = 'paid';
  IF v_customer IS NULL OR v_amount IS NULL OR v_amount = 0 THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer::text, 719));
  IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE invoice_id = _invoice_id AND action_key = 'plan_grant') THEN RETURN 0; END IF;
  INSERT INTO public.customer_credits(customer_id, saldo) VALUES (v_customer, 0)
    ON CONFLICT (customer_id) DO NOTHING;
  UPDATE public.customer_credits SET saldo = saldo + v_amount, updated_at = now()
    WHERE customer_id = v_customer RETURNING saldo INTO v_balance;
  INSERT INTO public.credit_transactions(customer_id,tipo,delta,saldo_apos,action_key,descricao,invoice_id)
    VALUES (v_customer,'ajuste',v_amount,v_balance,'plan_grant','Créditos incluídos no plano',_invoice_id);
  RETURN v_amount;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_plan_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_plan_credits(uuid) TO service_role;