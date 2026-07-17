-- =============================================================================
-- Mestre 360 — Produção — v1.3.0
-- Meios de pagamento por obra (contas bancárias e cartões)
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

-- 1) Coluna obra_id (opcional) em contas_bancarias
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS obra_id uuid NULL REFERENCES public.obras(id) ON DELETE CASCADE;

-- 2) Coluna obra_id (opcional) em cartoes
ALTER TABLE public.cartoes
  ADD COLUMN IF NOT EXISTS obra_id uuid NULL REFERENCES public.obras(id) ON DELETE CASCADE;

-- 3) Índices auxiliares
CREATE INDEX IF NOT EXISTS contas_bancarias_obra_id_idx ON public.contas_bancarias(obra_id);
CREATE INDEX IF NOT EXISTS cartoes_obra_id_idx ON public.cartoes(obra_id);

-- 4) Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.3.0',
  'Meios de pagamento por obra',
  '["Contas bancárias e cartões agora podem ser criados vinculados a uma obra específica","Selects de pagamento mostram meios globais + meios exclusivos da obra ativa"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;
