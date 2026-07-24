ALTER TABLE public.compras ALTER COLUMN forma_pagamento DROP NOT NULL;
ALTER TABLE public.compras ALTER COLUMN qtd_parcelas DROP NOT NULL;
ALTER TABLE public.compras ALTER COLUMN qtd_parcelas SET DEFAULT 0;

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.6.0',
  'Fluxo de compra simplificado',
  '["Nova compra em tela única com itens inline","Campos financeiros (forma de pagamento e parcelas) movidos para Gerar contas a pagar","Remoção do pop-up ao adicionar itens"]'::jsonb,
  now())
ON CONFLICT DO NOTHING;