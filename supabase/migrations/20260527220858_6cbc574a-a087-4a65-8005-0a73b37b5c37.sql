
-- Tabela de notas fiscais vinculadas a compras
CREATE TABLE IF NOT EXISTS public.compra_notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  numero text,
  serie text,
  chave text,
  valor numeric(14,2),
  emitida_em date,
  arquivo_url text,
  arquivo_nome text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compra_notas_fiscais TO authenticated;
GRANT ALL ON public.compra_notas_fiscais TO service_role;

ALTER TABLE public.compra_notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all nfs"
  ON public.compra_notas_fiscais FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own nfs"
  ON public.compra_notas_fiscais FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());

CREATE TRIGGER update_compra_nfs_updated_at
  BEFORE UPDATE ON public.compra_notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para notas fiscais
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: usuários autenticados gerenciam arquivos na pasta do seu customer_id
CREATE POLICY "Owners read own nf files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'notas-fiscais'
    AND (storage.foldername(name))[1] = current_user_customer_id()::text
  );

CREATE POLICY "Owners upload own nf files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notas-fiscais'
    AND (storage.foldername(name))[1] = current_user_customer_id()::text
  );

CREATE POLICY "Owners delete own nf files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'notas-fiscais'
    AND (storage.foldername(name))[1] = current_user_customer_id()::text
  );

-- Release notes v1.0.6
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.0.6',
  'Filtro por obra + Notas Fiscais nas compras',
  '[
    "Cards de obra com upload de foto e miniatura",
    "Dashboard mostra hero com foto da obra ativa quando filtrada",
    "Filtro por obra em contas a pagar, receber e fluxo de caixa",
    "Notas fiscais podem ser anexadas a cada compra",
    "Leitor de NF-e (XML) disponível no plano Empresarial",
    "Correções nas consultas do dashboard (vencimento/obra)"
  ]'::jsonb,
  now()
)
ON CONFLICT DO NOTHING;
