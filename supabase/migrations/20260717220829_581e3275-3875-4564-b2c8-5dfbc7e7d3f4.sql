-- Add tipo column to rdo_equipes (idempotent)
ALTER TABLE public.rdo_equipes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'interna';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rdo_equipes_tipo_check'
  ) THEN
    ALTER TABLE public.rdo_equipes
      ADD CONSTRAINT rdo_equipes_tipo_check CHECK (tipo IN ('interna','externa'));
  END IF;
END $$;

-- Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.2.0',
  'RDO com equipe interna/externa e menu simplificado',
  '["RDO: classifique cada equipe como Interna (mão de obra própria) ou Externa (empreiteira)","Menu lateral: módulo Estoque removido; Fornecedores permanece acessível"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;
