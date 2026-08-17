-- =============================================================================
-- Mestre 360 — Produção — v1.8.8
-- Indicadores financeiros sem contabilizar estornos como novas entradas/saídas
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO após publicar o app.
-- =============================================================================

INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT
  '1.8.8',
  now(),
  'Indicadores financeiros corrigidos para operações estornadas',
  '["Valores de estorno deixam de aparecer como novas entradas nos indicadores","O lançamento cancelado e seu contralançamento são desconsiderados nos totais operacionais","O histórico completo do estorno continua visível no extrato financeiro"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_releases WHERE version = '1.8.8'
);