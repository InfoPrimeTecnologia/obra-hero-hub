-- =====================================================================
-- Mestre 360 · Produção · v1.7.0
-- Ajustes de fluxo de Compras → Contas a pagar → Faturas de cartão.
-- Nenhuma alteração de schema: todas as colunas usadas (cartao_id,
-- dia_fechamento/dia_vencimento em cartoes; status/vencimento em
-- contas_pagar; fatura_cartao_id em compra_parcelas) já existem.
-- Este script apenas registra o release no changelog.
-- IDEMPOTENTE — pode rodar mais de uma vez sem erro.
-- =====================================================================

INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.7.0',
       'Compras, contas a pagar e faturas de cartão',
       '[
         "Tela da compra limpa: parcelas e recebimentos removidos",
         "Alerta em vermelho quando a compra ainda não foi faturada",
         "Cartão de crédito usa a regra do próprio cartão (fechamento/vencimento) para calcular os vencimentos",
         "Intervalo entre parcelas configurável para PIX, boleto, transferência etc.",
         "Botão Gerar contas a pagar bloqueado quando já existem parcelas (poka-yoke)",
         "Status real da compra: pendente / faturada / parcial / paga",
         "Compras no cartão passam a aparecer automaticamente em Faturas de cartão"
       ]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.7.0');
