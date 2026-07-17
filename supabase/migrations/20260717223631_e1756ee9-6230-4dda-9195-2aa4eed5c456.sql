
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS natureza text;
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_natureza_check;
ALTER TABLE public.compras ADD CONSTRAINT compras_natureza_check CHECK (natureza IS NULL OR natureza IN ('material','servico','equipamento'));

INSERT INTO public.app_releases (version, released_at, highlight, items)
VALUES (
  '1.5.0',
  now(),
  'Relatórios avançados e natureza de compras',
  '["Relatório de Compras: exportar PDF, Excel, enviar por WhatsApp; filtros por fornecedor, etapa e NF","Relatório de Pagamentos: PDF, Excel; filtros por fornecedor, forma de pagamento, status, natureza, NF, tipo de data","Compras: cadastro de natureza (material/serviço/equipamento)","Compras: árvore de etapas fechada ao abrir a tela","Nova compra abre em tela dedicada (não popup)","Edição de contato/WhatsApp direto no painel da obra"]'::jsonb
)
ON CONFLICT (version) DO NOTHING;
