-- =====================================================================
-- Mestre 360 · Produção · v1.6.0
-- Fluxo de compra simplificado: campos financeiros movidos para
-- "Gerar contas a pagar". Torna forma_pagamento e qtd_parcelas opcionais.
-- Script IDEMPOTENTE — pode rodar mais de uma vez sem erro.
-- =====================================================================

ALTER TABLE public.compras ALTER COLUMN forma_pagamento DROP NOT NULL;
ALTER TABLE public.compras ALTER COLUMN qtd_parcelas    DROP NOT NULL;
ALTER TABLE public.compras ALTER COLUMN qtd_parcelas    SET DEFAULT 0;

-- Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.6.0',
       'Fluxo de compra simplificado',
       '["Nova compra em tela única com itens inline","Campos financeiros (forma de pagamento e parcelas) movidos para Gerar contas a pagar","Remoção do pop-up ao adicionar itens"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.6.0');
