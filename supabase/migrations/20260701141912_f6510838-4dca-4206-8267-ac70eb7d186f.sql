-- Fase 2 – Sprint 1: Dashboard executivo + Alertas configuráveis
-- Idempotente (seguro rodar múltiplas vezes)

-- 1) Percentual configurável de alerta de estouro por subetapa
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS alerta_subetapa_pct integer NOT NULL DEFAULT 90;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_alerta_subetapa_pct_chk'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_alerta_subetapa_pct_chk
      CHECK (alerta_subetapa_pct BETWEEN 1 AND 200);
  END IF;
END $$;

-- 2) Registro no changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.2.0',
  'Dashboard executivo + alertas inteligentes de estouro de orçamento',
  '[
    {"tipo":"novo","texto":"Dashboard executivo: % avanço físico médio, top 3 obras estouradas, contas a pagar dos próximos 7 dias e faturamento previsto vs realizado do mês"},
    {"tipo":"novo","texto":"Aviso no momento da compra quando o item ultrapassa o limite configurado da subetapa (modal de confirmação)"},
    {"tipo":"novo","texto":"Percentual de alerta de orçamento configurável por empresa (Configurações › Empresa)"},
    {"tipo":"melhoria","texto":"Notificações no sino agora usam o limite configurado da empresa"}
  ]'::jsonb,
  now()
)
ON CONFLICT DO NOTHING;