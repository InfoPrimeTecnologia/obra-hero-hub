-- =====================================================================
-- MESTRE 360 — v1.3.0 (Fase 2 · Sprint 2)
-- Aba Documentos por obra + Duplicar obra (template)
--
-- Rodar no SQL Editor do Supabase de PRODUÇÃO (idempotente).
-- =====================================================================

-- 1) Tabela obra_documentos
CREATE TABLE IF NOT EXISTS public.obra_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tags text[] NOT NULL DEFAULT '{}',
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_documentos_obra     ON public.obra_documentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_documentos_customer ON public.obra_documentos(customer_id);
CREATE INDEX IF NOT EXISTS idx_obra_documentos_tags     ON public.obra_documentos USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_documentos TO authenticated;
GRANT ALL ON public.obra_documentos TO service_role;

ALTER TABLE public.obra_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_documentos_select" ON public.obra_documentos;
CREATE POLICY "obra_documentos_select" ON public.obra_documentos FOR SELECT TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id));

DROP POLICY IF EXISTS "obra_documentos_insert" ON public.obra_documentos;
CREATE POLICY "obra_documentos_insert" ON public.obra_documentos FOR INSERT TO authenticated
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

DROP POLICY IF EXISTS "obra_documentos_update" ON public.obra_documentos;
CREATE POLICY "obra_documentos_update" ON public.obra_documentos FOR UPDATE TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

DROP POLICY IF EXISTS "obra_documentos_delete" ON public.obra_documentos;
CREATE POLICY "obra_documentos_delete" ON public.obra_documentos FOR DELETE TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id));

DROP TRIGGER IF EXISTS trg_obra_documentos_updated_at ON public.obra_documentos;
CREATE TRIGGER trg_obra_documentos_updated_at
  BEFORE UPDATE ON public.obra_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Bucket privado 'obra-documentos' + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('obra-documentos', 'obra-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Convenção de path: {customer_id}/{obra_id}/{uuid}.{ext}
DROP POLICY IF EXISTS "obra_docs_select" ON storage.objects;
CREATE POLICY "obra_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'obra-documentos'
    AND public.user_has_customer_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "obra_docs_insert" ON storage.objects;
CREATE POLICY "obra_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'obra-documentos'
    AND public.user_has_customer_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "obra_docs_update" ON storage.objects;
CREATE POLICY "obra_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'obra-documentos'
    AND public.user_has_customer_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "obra_docs_delete" ON storage.objects;
CREATE POLICY "obra_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'obra-documentos'
    AND public.user_has_customer_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- 3) Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.3.0',
  'Documentos por obra + Duplicar obra',
  '[
    {"tipo":"novo","texto":"Nova aba Documentos dentro da obra: envio de arquivos com nome, descrição e tags; busca por texto e filtro por tag; download por link temporário e exclusão"},
    {"tipo":"novo","texto":"Botão Duplicar obra na listagem: cria nova obra copiando cadastro, endereço, contato, etapas e subetapas do orçamento (opção de copiar também datas previstas e % de avanço)"},
    {"tipo":"melhoria","texto":"Item Documentos adicionado ao menu lateral da obra"}
  ]'::jsonb,
  now()
)
ON CONFLICT DO NOTHING;
