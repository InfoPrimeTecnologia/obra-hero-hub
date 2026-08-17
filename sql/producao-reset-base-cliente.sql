-- =============================================================================
-- Mestre 360 — PRODUÇÃO — Zerar a base de UM cliente (a pedido dele)
-- Idempotente e seguro: apaga apenas os dados OPERACIONAIS do cliente.
-- MANTÉM: cadastro da empresa (customers), usuários/membros, plano/assinatura,
--         faturas do SaaS, créditos e tickets.
-- Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================
-- COMO USAR: troque o e-mail abaixo pelo e-mail do cliente e execute.
-- =============================================================================

DO $$
DECLARE
  v_email text := 'EMAIL_DO_CLIENTE@exemplo.com';  -- <<< ALTERE AQUI
  v_cust  uuid;
BEGIN
  SELECT id INTO v_cust FROM public.customers WHERE lower(email) = lower(v_email);
  IF v_cust IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado para o e-mail %', v_email;
  END IF;

  RAISE NOTICE 'Zerando base do customer_id = %', v_cust;

  -- Financeiro
  DELETE FROM public.conciliacao_itens        WHERE customer_id = v_cust;
  DELETE FROM public.conciliacao_extratos     WHERE customer_id = v_cust;
  DELETE FROM public.lancamentos              WHERE customer_id = v_cust;
  DELETE FROM public.transferencias           WHERE customer_id = v_cust;
  DELETE FROM public.contas_pagar             WHERE customer_id = v_cust;
  DELETE FROM public.contas_receber           WHERE customer_id = v_cust;
  DELETE FROM public.faturas_cartao           WHERE customer_id = v_cust;
  DELETE FROM public.cartoes                  WHERE customer_id = v_cust;
  DELETE FROM public.contas_bancarias         WHERE customer_id = v_cust;
  DELETE FROM public.categorias_financeiras   WHERE customer_id = v_cust;

  -- Suprimentos / compras
  DELETE FROM public.compra_notas_fiscais     WHERE customer_id = v_cust;
  DELETE FROM public.compra_parcelas          WHERE customer_id = v_cust;
  DELETE FROM public.compra_itens             WHERE customer_id = v_cust;
  DELETE FROM public.compras                  WHERE customer_id = v_cust;
  DELETE FROM public.recebimento_itens        WHERE customer_id = v_cust;
  DELETE FROM public.recebimentos             WHERE customer_id = v_cust;
  DELETE FROM public.requisicao_itens         WHERE customer_id = v_cust;
  DELETE FROM public.requisicoes              WHERE customer_id = v_cust;
  DELETE FROM public.fornecedores             WHERE customer_id = v_cust;

  -- Estoque (legado)
  DELETE FROM public.estoque_movimentacoes    WHERE customer_id = v_cust;
  DELETE FROM public.estoque_saldos           WHERE customer_id = v_cust;
  DELETE FROM public.produtos                 WHERE customer_id = v_cust;
  DELETE FROM public.almoxarifados            WHERE customer_id = v_cust;

  -- Engenharia / obra
  DELETE FROM public.rdo_anexos               WHERE customer_id = v_cust;
  DELETE FROM public.rdo_atividades           WHERE customer_id = v_cust;
  DELETE FROM public.rdo_equipes              WHERE customer_id = v_cust;
  DELETE FROM public.rdo_ocorrencias          WHERE customer_id = v_cust;
  DELETE FROM public.rdos                     WHERE customer_id = v_cust;
  DELETE FROM public.medicao_obra_itens       WHERE customer_id = v_cust;
  DELETE FROM public.medicoes_obra            WHERE customer_id = v_cust;
  DELETE FROM public.medicao_itens            WHERE customer_id = v_cust;
  DELETE FROM public.medicoes                 WHERE customer_id = v_cust;
  DELETE FROM public.orcamento_subetapas      WHERE customer_id = v_cust;
  DELETE FROM public.orcamento_etapas         WHERE customer_id = v_cust;
  DELETE FROM public.obra_documentos          WHERE customer_id = v_cust;
  DELETE FROM public.tarefa_materiais         WHERE customer_id = v_cust;
  DELETE FROM public.tarefas                  WHERE customer_id = v_cust;
  DELETE FROM public.tarefa_colunas           WHERE customer_id = v_cust;
  DELETE FROM public.eventos_agenda           WHERE customer_id = v_cust;

  -- RH
  DELETE FROM public.colaborador_obras        WHERE customer_id = v_cust;
  DELETE FROM public.colaboradores            WHERE customer_id = v_cust;
  DELETE FROM public.funcoes_equipe_obra      WHERE customer_id = v_cust;

  -- Obras e empresas do cliente (por último)
  DELETE FROM public.obras                    WHERE customer_id = v_cust;
  DELETE FROM public.empresas                 WHERE customer_id = v_cust;

  -- Logs de comunicação (opcional — comente se quiser manter histórico)
  DELETE FROM public.whatsapp_send_log        WHERE customer_id = v_cust;
  DELETE FROM public.communications_log       WHERE customer_id = v_cust;

  RAISE NOTICE 'Base zerada com sucesso para %', v_email;
END $$;

-- =============================================================================
-- OPCIONAL: zerar TAMBÉM o comercial (plano, faturas do SaaS, créditos)
-- Descomente somente se o cliente estiver saindo da plataforma.
-- =============================================================================
-- DO $$
-- DECLARE v_cust uuid;
-- BEGIN
--   SELECT id INTO v_cust FROM public.customers WHERE lower(email) = lower('EMAIL_DO_CLIENTE@exemplo.com');
--   DELETE FROM public.credit_transactions WHERE customer_id = v_cust;
--   DELETE FROM public.customer_credits    WHERE customer_id = v_cust;
--   DELETE FROM public.invoices            WHERE customer_id = v_cust;
--   DELETE FROM public.subscriptions       WHERE customer_id = v_cust;
--   DELETE FROM public.tickets             WHERE customer_id = v_cust;
--   DELETE FROM public.customer_invites    WHERE customer_id = v_cust;
--   -- DELETE FROM public.customer_members WHERE customer_id = v_cust;  -- remove acessos
--   -- DELETE FROM public.customers        WHERE id = v_cust;           -- apaga a empresa
-- END $$;
