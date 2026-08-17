CREATE OR REPLACE FUNCTION public.estornar_lancamento(
  _lancamento_id uuid,
  _motivo text
)
RETURNS TABLE(estorno_token uuid, contra_lancamento_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lanc public.lancamentos%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_contra_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 3 THEN
    RAISE EXCEPTION 'Informe um motivo válido para o estorno';
  END IF;

  SELECT *
    INTO v_lanc
    FROM public.lancamentos
   WHERE id = _lancamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;

  IF NOT public.user_has_customer_access(v_uid, v_lanc.customer_id)
     AND NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para estornar este lançamento';
  END IF;

  IF COALESCE(v_lanc.estornado, false) THEN
    RAISE EXCEPTION 'Este lançamento já foi estornado';
  END IF;

  UPDATE public.lancamentos
     SET estornado = true,
         estorno_token = v_token
   WHERE id = v_lanc.id
     AND COALESCE(estornado, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este lançamento já foi estornado';
  END IF;

  INSERT INTO public.lancamentos (
    customer_id,
    conta_bancaria_id,
    categoria_id,
    obra_id,
    tipo,
    valor,
    data,
    descricao,
    estorno_token,
    created_by
  ) VALUES (
    v_lanc.customer_id,
    v_lanc.conta_bancaria_id,
    v_lanc.categoria_id,
    v_lanc.obra_id,
    CASE WHEN v_lanc.tipo = 'saida' THEN 'entrada' ELSE 'saida' END,
    v_lanc.valor,
    CURRENT_DATE,
    'ESTORNO: ' || COALESCE(v_lanc.descricao, 'Lançamento') || ' - ' || trim(_motivo),
    v_token,
    v_uid
  )
  RETURNING id INTO v_contra_id;

  RETURN QUERY SELECT v_token, v_contra_id;
END;
$$;

REVOKE ALL ON FUNCTION public.estornar_lancamento(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO service_role;