INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.8', 'Agente de IA: obra ativa e lançamento de notas de compra',
 '[{"type":"improvement","description":"O agente usa a obra aberta automaticamente, sem perguntar qual obra."},{"type":"fix","description":"Lançamento de compra/nota pelo agente segue a regra da tela Nova compra: itens, natureza, etapa/subetapa (com criação de subetapa) e financeiro depois em Gerar contas a pagar."}]'::jsonb, now())
ON CONFLICT (version) DO NOTHING;
