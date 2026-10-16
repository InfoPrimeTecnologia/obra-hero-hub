-- Mestre 360 — v1.11.1 (apenas changelog; sem mudança de estrutura)
-- Idempotente.
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.11.1',
  false,
  '["Cliente pode cancelar recargas de créditos ainda não pagas","Admin pode suspender ou excluir faturas não pagas"]'::jsonb,
  now()
)
ON CONFLICT (version) DO UPDATE SET
  highlight = EXCLUDED.highlight,
  items = EXCLUDED.items,
  released_at = EXCLUDED.released_at;
