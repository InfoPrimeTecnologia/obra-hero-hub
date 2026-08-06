-- =============================================================================
-- Mestre 360 — Produção — v1.7.4
-- Estorno fiel (saldo por trigger apenas em INSERT/DELETE) + faturas na obra
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- OBS: contém também os itens da v1.7.3 caso ainda não tenham sido aplicados.
-- =============================================================================

-- 1) Coluna de controle de faturamento por quantidade
ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS qtd_faturada numeric NOT NULL DEFAULT 0;

-- 2) Colunas de estorno em contas_pagar / lancamentos (se faltarem)
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS estornado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estorno_token uuid NULL,
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS estornado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS motivo_estorno text NULL;

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS estornado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estorno_token uuid NULL;

-- 3) Valor assinado de um lançamento (estornado NÃO zera; o contra-lançamento é que corrige)
CREATE OR REPLACE FUNCTION public.lancamento_valor_assinado(_tipo text, _valor numeric, _estornado boolean)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _tipo = 'entrada' THEN COALESCE(_valor, 0)
    ELSE -COALESCE(_valor, 0)
  END;
$$;

-- 4) Saldo bancário mantido pelo banco — SOMENTE em INSERT e DELETE
--    (marcar estornado=true via UPDATE não deve mexer no saldo)
CREATE OR REPLACE FUNCTION public.lancamento_ajusta_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0)
             + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0)
             - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lancamento_saldo ON public.lancamentos;
CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.lancamento_ajusta_saldo();

-- 5) Recalcula os saldos atuais a partir do saldo inicial + lançamentos
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
     SELECT SUM(public.lancamento_valor_assinado(l.tipo, l.valor, l.estornado))
       FROM public.lancamentos l
      WHERE l.conta_bancaria_id = cb.id
   ), 0);

-- 6) Fatura fechada herda a obra quando todas as parcelas são da mesma obra
CREATE OR REPLACE FUNCTION public.fatura_to_conta_pagar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 7) Índice para busca de faturas por competência
CREATE UNIQUE INDEX IF NOT EXISTS faturas_cartao_cartao_competencia_uidx
  ON public.faturas_cartao(cartao_id, competencia);

-- 8) Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.7.4',
  'Estorno fiel e faturas de cartão dentro da obra',
  '["Estorno não soma mais o valor em dobro: saldo bancário é ajustado apenas por lançamento e contra-lançamento","Faturas de cartão da obra aparecem em Contas a pagar mesmo abertas, com pagar e estornar na própria obra","Lançamento de compra no cartão cria a fatura de forma explícita, sem falha silenciosa","Estorno liberado para qualquer lançamento do caixa da obra, inclusive aportes"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;
