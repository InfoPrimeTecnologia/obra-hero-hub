-- =============================================================================
-- Mestre 360 — Produção — v1.9.1
-- Saldo exclusivo da obra em Caixa e Bancos
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

-- Não há mudança de schema nesta versão (correção de cálculo na aplicação).
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.9.1',
  'Saldo exclusivo da obra em Caixa e Bancos',
  '["O card Saldo atual agora soma somente as movimentações efetivas da obra consultada, sem usar o saldo geral das contas bancárias","Os relatórios PDF e Excel de Caixa e Bancos passam a apresentar o mesmo saldo exclusivo da obra"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;