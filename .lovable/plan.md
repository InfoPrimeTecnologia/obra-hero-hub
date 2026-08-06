# Plano de alterações — v1.7.4 (Feedback 05.08)

## Diagnóstico

Investiguei o banco e encontrei a causa raiz dos dois problemas financeiros: o pacote 1.7.3 **não chegou a ser aplicado no banco**. O gatilho de saldo ainda é o antigo, que reage também a atualizações de lançamento. Por isso, ao estornar uma compra de 17.500, o saldo soma o valor duas vezes (uma ao marcar o lançamento como estornado, outra no contra-lançamento) e chega em 37.500 em vez de voltar a 20.000.

## 1. Estorno com saldo correto (aporte e compra)

- Substituir o gatilho de saldo pelo que só considera criação/exclusão de lançamento, eliminando a soma dupla.
- Recalcular os saldos atuais de todas as contas a partir do extrato, corrigindo saldos já distorcidos.
- Liberar o botão "Estornar" para qualquer lançamento do caixa da obra, incluindo aportes (hoje ele fica indisponível em lançamentos sem compra vinculada).
- Estorno de aporte com motivo obrigatório, contra-lançamento identificado e reversão visível no extrato.

## 2. Compra no cartão aparecendo em Contas a pagar da obra

- Ao gerar o faturamento no cartão, o próprio sistema garante a fatura da competência e vincula as parcelas, sem depender de gatilho e sem depender de a compra já estar marcada como "cartão". Erros passam a ser exibidos em vez de falhar em silêncio.
- A página **Contas a pagar da obra** passa a listar todas as faturas de cartão que contenham parcelas desta obra, inclusive faturas ainda **abertas** (hoje só aparecem depois de fechadas).
- Cada fatura ganha o botão "Pagar fatura" na própria obra, debitando de conta bancária/caixa da obra.
- O item "Faturas do cartão" que leva ao financeiro da empresa sai do contexto da obra, para não confundir.

## 3. CRUD/reversão de todas as operações de cartão

- Estornar pagamento de fatura: volta fatura e parcelas para pendente, gera contra-lançamento e devolve o saldo à conta.
- Excluir/estornar o faturamento no cartão: remove as parcelas da fatura, recalcula o total da fatura e devolve as quantidades ao saldo a faturar da compra.
- Bloqueios de segurança mantidos: não é possível excluir faturamento de fatura já paga sem antes estornar o pagamento.

## 4. Saldo a faturar por quantidade

Já entregue na 1.7.3 (cliente marcou "demanda atendida"). Apenas revalidamos após a limpeza da base, pois o comportamento correto depende do pacote de banco que ainda não foi aplicado.

## Banco de dados (rodar no SQL Editor de produção)

Novo arquivo `sql/producao-1.7.4-estorno-fatura-obra.sql`, idempotente, com:

- gatilho de saldo corrigido (apenas inserção/exclusão de lançamento);
- recálculo dos saldos atuais a partir do extrato;
- fatura fechada herdando a obra quando todas as parcelas são da mesma obra;
- registro da versão 1.7.4 no changelog.

Importante: o arquivo `sql/producao-1.7.3-financeiro-obra.sql` também precisa ser executado caso ainda não tenha sido — o novo script inclui as partes essenciais dele para funcionar mesmo sozinho.

## Detalhes técnicos

- `trg_lancamento_saldo` passa a usar `lancamento_aplicar_saldo` (AFTER INSERT OR DELETE), removendo o caminho de UPDATE que causava a soma dupla.
- Faturamento no cartão deixa de depender exclusivamente de `parcela_cartao_assign_fatura`: a aplicação resolve competência/vencimento via `calcular_competencia_fatura` e faz upsert em `faturas_cartao` antes de inserir em `compra_parcelas`.
- `app.obras.$obraId.contas-pagar.tsx`: consulta de faturas por parcelas da obra sem filtrar status; ações de pagar/estornar fatura.
- `app.obras.$obraId.caixa.tsx`: estorno habilitado para lançamentos sem `compra_id`.
