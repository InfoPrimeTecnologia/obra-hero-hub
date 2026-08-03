-- 1) Quantidade já faturada por item de compra
ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS qtd_faturada numeric NOT NULL DEFAULT 0;

-- 2) Saldo das contas bancárias mantido exclusivamente pelo banco
CREATE OR REPLACE FUNCTION public.lancamento_valor_assinado(_tipo text, _valor numeric, _estornado boolean)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(_estornado, false) THEN 0
    WHEN _tipo = 'entrada' THEN COALESCE(_valor, 0)
    ELSE -COALESCE(_valor, 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.lancamento_ajusta_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.conta_bancaria_id IS NOT DISTINCT FROM NEW.conta_bancaria_id THEN
      IF NEW.conta_bancaria_id IS NOT NULL THEN
        UPDATE public.contas_bancarias
           SET saldo_atual = COALESCE(saldo_atual,0)
             + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
             - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
         WHERE id = NEW.conta_bancaria_id;
      END IF;
    ELSE
      IF OLD.conta_bancaria_id IS NOT NULL THEN
        UPDATE public.contas_bancarias
           SET saldo_atual = COALESCE(saldo_atual,0) - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
         WHERE id = OLD.conta_bancaria_id;
      END IF;
      IF NEW.conta_bancaria_id IS NOT NULL THEN
        UPDATE public.contas_bancarias
           SET saldo_atual = COALESCE(saldo_atual,0) + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
         WHERE id = NEW.conta_bancaria_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_lancamento_saldo ON public.lancamentos;
CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.lancamento_ajusta_saldo();

-- 3) Gatilhos que mexiam no saldo deixam de fazê-lo (agora é o gatilho acima)
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
END;
$$;

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
END;
$$;

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
END;
$$;

-- 4) Fatura de cartão gera conta a pagar já vinculada à obra (quando única)
CREATE OR REPLACE FUNCTION public.fatura_to_conta_pagar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cartao_nome text;
  v_obra_id uuid;
BEGIN
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    SELECT nome INTO v_cartao_nome FROM public.cartoes WHERE id = NEW.cartao_id;

    SELECT CASE WHEN COUNT(DISTINCT c.obra_id) = 1 THEN MIN(c.obra_id) ELSE NULL END
      INTO v_obra_id
      FROM public.compra_parcelas p
      JOIN public.compras c ON c.id = p.compra_id
     WHERE p.fatura_cartao_id = NEW.id
       AND c.obra_id IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM public.contas_pagar WHERE fatura_cartao_id = NEW.id) THEN
      INSERT INTO public.contas_pagar (
        customer_id, obra_id, fatura_cartao_id, descricao, valor, vencimento, status, origem
      ) VALUES (
        NEW.customer_id, v_obra_id, NEW.id,
        'Fatura ' || COALESCE(v_cartao_nome,'Cartão') || ' - ' || NEW.competencia,
        NEW.valor_total, NEW.dt_vencimento, 'pendente', 'fatura_cartao'
      );
    ELSE
      UPDATE public.contas_pagar
         SET obra_id = COALESCE(obra_id, v_obra_id)
       WHERE fatura_cartao_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Recalcula saldos a partir do saldo inicial + lançamentos ativos
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
     SELECT SUM(public.lancamento_valor_assinado(l.tipo, l.valor, l.estornado))
       FROM public.lancamentos l
      WHERE l.conta_bancaria_id = cb.id
   ), 0);