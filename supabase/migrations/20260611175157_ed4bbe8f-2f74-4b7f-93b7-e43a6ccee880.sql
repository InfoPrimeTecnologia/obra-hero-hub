
-- Estorno tokens em contas a pagar/receber para auditoria de reversões
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS estorno_token uuid,
  ADD COLUMN IF NOT EXISTS estornado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_estorno text;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS estorno_token uuid,
  ADD COLUMN IF NOT EXISTS estornado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_estorno text;

-- Anti-duplicação: parcelas de compra (compra_id + numero único)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='compra_parcelas_compra_id_numero_key') THEN
    ALTER TABLE public.compra_parcelas ADD CONSTRAINT compra_parcelas_compra_id_numero_key UNIQUE (compra_id, numero);
  END IF;
END $$;

-- Anti-duplicação: medições (compra_id + numero único)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='medicoes_compra_id_numero_key') THEN
    ALTER TABLE public.medicoes ADD CONSTRAINT medicoes_compra_id_numero_key UNIQUE (compra_id, numero);
  END IF;
END $$;

-- Anti-duplicação: etapas de orçamento por obra+ordem (permite renumeração via UPDATE temporário)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_etapas_obra_id_ordem_key') THEN
    ALTER TABLE public.orcamento_etapas ADD CONSTRAINT orcamento_etapas_obra_id_ordem_key UNIQUE (obra_id, ordem) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Índices para lookup de estornos
CREATE INDEX IF NOT EXISTS contas_pagar_estorno_token_idx ON public.contas_pagar(estorno_token) WHERE estorno_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS contas_receber_estorno_token_idx ON public.contas_receber(estorno_token) WHERE estorno_token IS NOT NULL;
