-- =============================================================================
-- Mestre 360 — Produção — v1.2.0
-- RDO: equipe interna/externa + registro no changelog
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

-- 1) Coluna tipo em rdo_equipes
ALTER TABLE public.rdo_equipes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'interna';

-- 2) Constraint de valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rdo_equipes_tipo_check'
  ) THEN
    ALTER TABLE public.rdo_equipes
      ADD CONSTRAINT rdo_equipes_tipo_check CHECK (tipo IN ('interna','externa'));
  END IF;
END $$;

-- 3) Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.2.0',
  'RDO com equipe interna/externa e menu simplificado',
  '["RDO: classifique cada equipe como Interna (mão de obra própria) ou Externa (empreiteira)","Menu lateral: módulo Estoque removido; Fornecedores permanece acessível"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;
