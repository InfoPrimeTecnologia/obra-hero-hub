-- ============================================================
-- Mestre360 · 1.7.2 — Financeiro dentro da obra
-- Idempotente. Rodar no SQL Editor do Supabase de produção.
-- Nenhuma alteração de schema é necessária (as colunas usadas já existem:
-- contas_bancarias.obra_id, cartoes.obra_id, contas_pagar.estornado/estorno_token,
-- lancamentos.estornado/estorno_token/conta_pagar_id).
-- Este script apenas registra a versão no changelog do sistema.
-- ============================================================

INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.7.2',
       'Financeiro da obra: pagamento de fatura, faturamento parcial e estorno',
       '[
         "Pagar fatura de cartão direto dentro da obra, escolhendo a conta bancária da obra",
         "Contas a pagar e faturas da obra debitam apenas contas bancárias da própria obra (ou globais)",
         "Geração parcial de contas a pagar: compra fica como parcial e permite gerar o restante depois",
         "Compras já faturadas e pagas ficam bloqueadas para inclusão/edição de itens",
         "Estorno de pagamento em Caixa e bancos da obra, revertendo a compra para pendente"
       ]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.7.2');
