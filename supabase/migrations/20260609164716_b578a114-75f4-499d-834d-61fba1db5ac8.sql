
-- Helper: calcula (competencia, dt_fechamento, dt_vencimento) para uma data de compra
CREATE OR REPLACE FUNCTION public.calcular_competencia_fatura(
  p_data_compra date, p_dia_fechamento int, p_dia_vencimento int
) RETURNS TABLE(competencia text, dt_fechamento date, dt_vencimento date)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_ano int; v_mes int;
  v_fech date; v_venc date;
BEGIN
  v_ano := EXTRACT(YEAR FROM p_data_compra)::int;
  v_mes := EXTRACT(MONTH FROM p_data_compra)::int;
  -- Se data da compra ultrapassou o dia de fechamento, joga p/ fatura do próximo mês
  IF EXTRACT(DAY FROM p_data_compra)::int > p_dia_fechamento THEN
    v_mes := v_mes + 1;
    IF v_mes > 12 THEN v_mes := 1; v_ano := v_ano + 1; END IF;
  END IF;
  -- Data de fechamento dessa competência (clamp ao último dia do mês se necessário)
  v_fech := make_date(v_ano, v_mes, LEAST(p_dia_fechamento,
              EXTRACT(DAY FROM (date_trunc('month', make_date(v_ano,v_mes,1)) + interval '1 month - 1 day'))::int));
  -- Vencimento: se dia de venc <= dia de fech, vence no mês seguinte ao fechamento
  IF p_dia_vencimento <= p_dia_fechamento THEN
    v_venc := (date_trunc('month', v_fech) + interval '1 month')::date;
    v_venc := make_date(EXTRACT(YEAR FROM v_venc)::int, EXTRACT(MONTH FROM v_venc)::int,
                LEAST(p_dia_vencimento,
                  EXTRACT(DAY FROM (date_trunc('month', v_venc) + interval '1 month - 1 day'))::int));
  ELSE
    v_venc := make_date(v_ano, v_mes,
                LEAST(p_dia_vencimento,
                  EXTRACT(DAY FROM (date_trunc('month', v_fech) + interval '1 month - 1 day'))::int));
  END IF;
  competencia := to_char(make_date(v_ano, v_mes, 1), 'YYYY-MM');
  dt_fechamento := v_fech;
  dt_vencimento := v_venc;
  RETURN NEXT;
END $$;

-- BEFORE INSERT/UPDATE: para compras no cartão, ajusta vencimento e vincula à fatura
CREATE OR REPLACE FUNCTION public.parcela_cartao_assign_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_compra record; v_cartao record; v_calc record;
  v_ref_data date; v_fatura_id uuid;
BEGIN
  SELECT forma_pagamento, cartao_id, data_compra INTO v_compra FROM public.compras WHERE id = NEW.compra_id;
  IF v_compra.forma_pagamento <> 'cartao' OR v_compra.cartao_id IS NULL THEN
    RETURN NEW; -- não é cartão; mantém vencimento original
  END IF;
  SELECT dia_fechamento, dia_vencimento INTO v_cartao FROM public.cartoes WHERE id = v_compra.cartao_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Data de referência da parcela: data da compra + (n-1) meses
  v_ref_data := (v_compra.data_compra + ((NEW.numero - 1) || ' months')::interval)::date;

  SELECT * INTO v_calc FROM public.calcular_competencia_fatura(v_ref_data, v_cartao.dia_fechamento, v_cartao.dia_vencimento);

  -- Garante a fatura
  SELECT id INTO v_fatura_id FROM public.faturas_cartao
    WHERE cartao_id = v_compra.cartao_id AND competencia = v_calc.competencia;
  IF v_fatura_id IS NULL THEN
    INSERT INTO public.faturas_cartao (customer_id, cartao_id, competencia, dt_fechamento, dt_vencimento, valor_total, status)
    VALUES (NEW.customer_id, v_compra.cartao_id, v_calc.competencia, v_calc.dt_fechamento, v_calc.dt_vencimento, 0, 'aberta')
    RETURNING id INTO v_fatura_id;
  END IF;

  NEW.vencimento := v_calc.dt_vencimento;
  NEW.fatura_cartao_id := v_fatura_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_parcela_cartao_assign ON public.compra_parcelas;
CREATE TRIGGER trg_parcela_cartao_assign
BEFORE INSERT OR UPDATE OF compra_id, numero ON public.compra_parcelas
FOR EACH ROW EXECUTE FUNCTION public.parcela_cartao_assign_fatura();

-- AFTER INSERT/UPDATE/DELETE: recalcula valor_total da(s) fatura(s) afetadas
CREATE OR REPLACE FUNCTION public.recalc_fatura_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fatura_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fatura_id := OLD.fatura_cartao_id;
    IF v_fatura_id IS NOT NULL THEN
      UPDATE public.faturas_cartao f SET valor_total = COALESCE((
        SELECT SUM(valor) FROM public.compra_parcelas WHERE fatura_cartao_id = f.id
      ), 0) WHERE id = v_fatura_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.fatura_cartao_id IS NOT NULL THEN
    UPDATE public.faturas_cartao f SET valor_total = COALESCE((
      SELECT SUM(valor) FROM public.compra_parcelas WHERE fatura_cartao_id = f.id
    ), 0) WHERE id = NEW.fatura_cartao_id;
  END IF;
  -- Se mudou de fatura, recalcula a antiga também
  IF TG_OP = 'UPDATE' AND OLD.fatura_cartao_id IS NOT NULL AND OLD.fatura_cartao_id IS DISTINCT FROM NEW.fatura_cartao_id THEN
    UPDATE public.faturas_cartao f SET valor_total = COALESCE((
      SELECT SUM(valor) FROM public.compra_parcelas WHERE fatura_cartao_id = f.id
    ), 0) WHERE id = OLD.fatura_cartao_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_parcela_recalc_fatura ON public.compra_parcelas;
CREATE TRIGGER trg_parcela_recalc_fatura
AFTER INSERT OR UPDATE OR DELETE ON public.compra_parcelas
FOR EACH ROW EXECUTE FUNCTION public.recalc_fatura_total();
