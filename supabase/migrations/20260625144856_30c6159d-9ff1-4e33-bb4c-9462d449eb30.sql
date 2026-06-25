ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.orcamento_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subetapa_id uuid REFERENCES public.orcamento_subetapas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_compras_etapa_id ON public.compras(etapa_id);
CREATE INDEX IF NOT EXISTS idx_compras_subetapa_id ON public.compras(subetapa_id);