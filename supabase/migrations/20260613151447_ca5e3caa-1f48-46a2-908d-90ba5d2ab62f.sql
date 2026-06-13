
-- Função admin para ajuste manual de créditos (SECURITY DEFINER)
-- Permite que admins ajustem saldo sem depender da service role key.
CREATE OR REPLACE FUNCTION public.admin_apply_credit_delta(
  _customer_id uuid,
  _delta integer,
  _motivo text
)
RETURNS TABLE(saldo integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_atual integer;
  v_novo_saldo integer;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo obrigatório';
  END IF;

  SELECT cc.saldo INTO v_saldo_atual
    FROM public.customer_credits cc
    WHERE cc.customer_id = _customer_id
    FOR UPDATE;

  IF v_saldo_atual IS NULL THEN
    v_saldo_atual := 0;
    INSERT INTO public.customer_credits(customer_id, saldo) VALUES(_customer_id, 0);
  END IF;

  v_novo_saldo := v_saldo_atual + _delta;
  IF v_novo_saldo < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE public.customer_credits
     SET saldo = v_novo_saldo, updated_at = now()
   WHERE customer_id = _customer_id;

  INSERT INTO public.credit_transactions(customer_id, tipo, delta, saldo_apos, descricao, user_id)
  VALUES(_customer_id, 'ajuste', _delta, v_novo_saldo, _motivo, v_user);

  RETURN QUERY SELECT v_novo_saldo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_apply_credit_delta(uuid, integer, text) TO authenticated;
