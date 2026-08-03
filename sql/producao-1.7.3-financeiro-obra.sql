-- ============================================================
-- Mestre360 · 1.7.3 — Financeiro da obra: saldo automático, estorno e saldo a faturar
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- ============================================================

-- 1) Saldo a faturar por quantidade -------------------------------------------
ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS qtd_faturada numeric NOT NULL DEFAULT 0;

-- 2) Saldo bancário mantido pelo banco (trigger em lancamentos) ---------------
CREATE OR REPLACE FUNCTION public.lancamento_aplicar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := CASE WHEN NEW.tipo = 'entrada' THEN NEW.valor ELSE -NEW.valor END;
    IF NEW.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) + v_delta
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := CASE WHEN OLD.tipo = 'entrada' THEN -OLD.valor ELSE OLD.valor END;
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) + v_delta
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lancamento_saldo ON public.lancamentos;
CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.lancamento_aplicar_saldo();

-- 3) Remove o ajuste manual de saldo das funções que geram lançamentos --------
CREATE OR REPLACE FUNCTION public.cp_baixa_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') AND NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.lancamentos (
      customer_id, conta_bancaria_id, categoria_id, obra_id,
      tipo, valor, data, descricao, conta_pagar_id, created_by
    ) VALUES (
      NEW.customer_id, NEW.conta_bancaria_id, NEW.categoria_id, NEW.obra_id,
      'saida', COALESCE(NEW.valor_pago, NEW.valor), COALESCE(NEW.pago_em, CURRENT_DATE),
      NEW.descricao, NEW.id, NEW.created_by
    );
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.cr_baixa_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') AND NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.lancamentos (
      customer_id, conta_bancaria_id, categoria_id, obra_id,
      tipo, valor, data, descricao, conta_receber_id, created_by
    ) VALUES (
      NEW.customer_id, NEW.conta_bancaria_id, NEW.categoria_id, NEW.obra_id,
      'entrada', COALESCE(NEW.valor_recebido, NEW.valor), COALESCE(NEW.recebido_em, CURRENT_DATE),
      NEW.descricao, NEW.id, NEW.created_by
    );
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.transferencia_to_lancamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lancamentos (customer_id, conta_bancaria_id, tipo, valor, data, descricao, transferencia_id, estorno_token, created_by)
  VALUES (NEW.customer_id, NEW.conta_origem_id, 'saida', NEW.valor, NEW.data, COALESCE(NEW.descricao,'Transferência'), NEW.id, NEW.estorno_token, NEW.created_by);
  INSERT INTO public.lancamentos (customer_id, conta_bancaria_id, tipo, valor, data, descricao, transferencia_id, estorno_token, created_by)
  VALUES (NEW.customer_id, NEW.conta_destino_id, 'entrada', NEW.valor, NEW.data, COALESCE(NEW.descricao,'Transferência'), NEW.id, NEW.estorno_token, NEW.created_by);
  RETURN NEW;
END $$;

-- 4) Fatura de cartão herda a obra quando todas as parcelas são da mesma obra --
CREATE OR REPLACE FUNCTION public.fatura_to_conta_pagar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cartao_nome text;
  v_obra uuid;
BEGIN
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    SELECT nome INTO v_cartao_nome FROM public.cartoes WHERE id = NEW.cartao_id;

    SELECT CASE WHEN COUNT(DISTINCT c.obra_id) = 1 THEN MIN(c.obra_id) ELSE NULL END
      INTO v_obra
      FROM public.compra_parcelas cp
      JOIN public.compras c ON c.id = cp.compra_id
     WHERE cp.fatura_cartao_id = NEW.id;

    IF NOT EXISTS (SELECT 1 FROM public.contas_pagar WHERE fatura_cartao_id = NEW.id) THEN
      INSERT INTO public.contas_pagar (
        customer_id, fatura_cartao_id, obra_id, descricao, valor, vencimento, status, origem
      ) VALUES (
        NEW.customer_id, NEW.id, v_obra,
        'Fatura ' || COALESCE(v_cartao_nome,'Cartão') || ' - ' || NEW.competencia,
        NEW.valor_total, NEW.dt_vencimento, 'pendente', 'fatura_cartao'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 5) Recalcula os saldos atuais a partir do extrato ---------------------------
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
        SELECT SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END)
          FROM public.lancamentos l
         WHERE l.conta_bancaria_id = cb.id
       ), 0);

-- 6) Changelog ----------------------------------------------------------------
INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.7.3',
       'Financeiro da obra: estorno confiável, faturas integradas e saldo por quantidade',
       '[
         "Saldo das contas bancárias mantido automaticamente pelo banco (estorno não soma valor errado)",
         "Estorno disponível para qualquer lançamento do caixa da obra, inclusive aportes",
         "Faturas de cartão da obra aparecem e são pagas dentro de Contas a pagar da obra",
         "Fatura fechada herda a obra quando todas as parcelas são da mesma obra",
         "Saldo a faturar por quantidade em cada item da compra"
       ]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.7.3');
