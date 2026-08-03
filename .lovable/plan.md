# Feedback do cliente (03/08) — v1.7.3

Quatro problemas, todos no financeiro da obra. Três exigem SQL em produção (entrego o arquivo idempotente junto).

## 1. Estorno soma o valor em vez de devolver o saldo

Cenário relatado: aporte 20.000 → compra 17.500 → saldo 2.500. Ao estornar, o saldo virou 37.500.

Causa: o saldo da conta bancária é alterado em dois lugares — o gatilho do banco debita no pagamento, e o código da tela soma de novo no estorno (em Caixa, Contas a pagar e Faturas). Quando o estorno passa por mais de um caminho, o valor é aplicado duas vezes.

Correção:
- Passar a manutenção do saldo inteiramente para o banco: um gatilho em `lancamentos` ajusta `contas_bancarias.saldo_atual` em toda inserção, atualização (inclusive marcação de estornado) e exclusão.
- Remover todos os `update` manuais de saldo das telas (`caixa`, `contas-pagar` da obra, `contas-pagar` global, `faturas`).
- Script de correção recalcula o saldo atual de todas as contas a partir dos lançamentos não estornados, corrigindo os saldos já distorcidos.
- Estorno passa a ser idempotente: lançamento já estornado não pode ser estornado de novo.

## 2. Não é possível estornar o aporte

Hoje o botão de estorno só aparece em lançamentos com conta a pagar vinculada.

Correção: estorno disponível para qualquer lançamento não estornado (entrada ou saída), pedindo motivo. Se houver conta a pagar/compra vinculada, ela volta para pendente como já acontece; se for aporte, apenas gera o contra-lançamento e ajusta o saldo.

## 3. Fatura de cartão da obra não aparece e o botão leva ao financeiro da empresa

Causa: a conta a pagar gerada no fechamento da fatura nasce sem `obra_id`, então a obra nunca a enxerga. E a fatura só existe no escopo da empresa.

Correção:
- Gatilho de fechamento de fatura passa a preencher `obra_id` quando todas as parcelas da fatura pertencem à mesma obra (senão fica global, como hoje).
- Contas a pagar da obra passam a listar também as contas de origem `fatura_cartao` cujas parcelas são daquela obra, mesmo antes do fechamento.
- Conforme a sugestão do cliente: as **faturas de cartão da obra viram um bloco dentro da própria página de Contas a pagar da obra**, com botão "Pagar fatura" (escolhe conta bancária da obra) e "Fechar fatura". A página separada `/faturas` da obra deixa de existir e o item do menu aponta para Contas a pagar.
- Toda operação reversível: fechar → reabrir, pagar → estornar, com o mesmo fluxo de estorno do item 1.

## 4. Saldo a faturar por item (quantidades)

Cenário: compra de 50 formas × 400,00; 20 faturadas no cartão (2× 4.000). Ao faturar o restante, o sistema ainda oferece 50 unidades.

Correção:
- Passar a registrar a quantidade já faturada de cada item (nova coluna `qtd_faturada` em `compra_itens`, preenchida ao gerar contas a pagar/parcelas).
- No diálogo "Gerar contas a pagar", cada item mostra "Qtd. restante" e o campo é limitado a ela; itens totalmente faturados não aparecem.
- Ao estornar/excluir uma conta a pagar ou parcela gerada, a quantidade volta para o saldo a faturar.
- Status da compra (`pendente` / `parcial` / `faturada` / `paga`) passa a considerar a quantidade faturada, não só o valor.

## Detalhes técnicos

- Novo `sql/producao-1.7.3-financeiro-obra.sql`, idempotente:
  - `ALTER TABLE public.compra_itens ADD COLUMN IF NOT EXISTS qtd_faturada numeric NOT NULL DEFAULT 0;`
  - função + gatilho `lancamento_ajusta_saldo` (INSERT/UPDATE/DELETE) em `lancamentos`;
  - `CREATE OR REPLACE FUNCTION fatura_to_conta_pagar()` com preenchimento de `obra_id`;
  - recálculo único de `contas_bancarias.saldo_atual` a partir dos lançamentos ativos;
  - registro da versão 1.7.3 em `app_releases`.
- Frontend: `app.obras.$obraId.caixa.tsx`, `app.obras.$obraId.contas-pagar.tsx` (recebe o bloco de faturas), `app.contas-pagar.tsx`, `app.faturas-cartao.tsx`, `app.obras.$obraId.compras.$compraId.tsx`, `ObraSidebar.tsx`; remoção de `app.obras.$obraId.faturas.tsx`.

## Fora de escopo

- Redesenho das telas de cartão da empresa.
- Faturamento parcial por item em compras já pagas (continua bloqueado).

## Entrega

Um turno após aprovação: código + `sql/producao-1.7.3-financeiro-obra.sql` para rodar no SQL Editor do Supabase de produção.
