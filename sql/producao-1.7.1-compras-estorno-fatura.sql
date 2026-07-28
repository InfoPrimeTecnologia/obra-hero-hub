-- =====================================================================
-- Mestre 360 · Produção · v1.7.1
-- Ajustes de UX em Compras, Contas a pagar e Faturas de cartão.
-- Nenhuma alteração de schema. Este script apenas registra o release.
-- IDEMPOTENTE — pode rodar mais de uma vez sem erro.
-- =====================================================================

INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.7.1',
       'Pagar fatura, estorno, exclusão e correção de data',
       '[
         "Corrigido bug de fuso: datas de vencimento e emissão passam a exibir/gravar o dia correto",
         "Nova opção À vista no diálogo Gerar contas a pagar (1 parcela na data de emissão)",
         "Intervalo entre parcelas aceita 0 (todas no mesmo dia) para PIX, boleto, transferência etc.",
         "Poka-yoke agora também considera parcelas de cartão: não é possível refaturar uma compra já lançada em fatura",
         "Botão Excluir compra na tela detalhada (bloqueado quando já existem contas geradas)",
         "Botão Excluir conta a pagar (somente para contas pendentes) nas telas global e por obra",
         "Novo botão Pagar fatura em Faturas de cartão: fecha (se aberta), debita da conta bancária escolhida e marca a fatura e as parcelas como pagas",
         "Estorno de pagamento continua disponível em Contas a pagar para reverter o débito com trilha de auditoria"
       ]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.7.1');
