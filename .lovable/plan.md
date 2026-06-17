## Objetivo

Hoje o Assistente IA tem 8 ferramentas. Vamos expandir para que ele consiga executar (ou consultar) tudo que um usuário consegue fazer manualmente no sistema.

## Considerações importantes (ler antes)

1. **Custo de tokens por chamada**: cada ferramenta vai junto na chamada da OpenAI. Hoje são 8; vamos para ~55. Isso aumenta ~3-4k tokens por mensagem enviada, então cada mensagem fica ~30% mais cara em créditos. Vale a pena, mas é bom saber.
2. **Precisão**: com muitas ferramentas, o modelo às vezes escolhe a errada. Vou agrupar por domínio com nomes claros e descrições objetivas para minimizar isso.
3. **Confirmação**: toda ação que **muda dados** continua exigindo confirmação do usuário no chat (como já é hoje). Leituras (listar/buscar) executam direto.
4. **Permissões**: tudo passa pelo `requireSupabaseAuth` + RLS — o agente só faz o que o usuário logado pode fazer.

## Ferramentas a adicionar

### Obras (já tem 2, adicionar 4)
- `list_obras` ✅ — já existe
- `create_obra` ✅ — já existe
- `update_obra` — editar dados (nome, endereço, contato, datas)
- `archive_obra` — arquivar/desarquivar
- `get_obra_resumo` — saldo orçamento vs realizado, % concluído, próximas etapas

### Orçamento (já tem 2, adicionar 3)
- `create_etapa` ✅ / `create_subetapa` ✅
- `update_subetapa` — ajustar valor orçado / percentual
- `list_etapas` — listar etapas + subetapas de uma obra
- `delete_etapa` / `delete_subetapa`

### Compras (já tem 1, adicionar 4)
- `create_compra` ✅
- `list_compras` — filtros por obra/fornecedor/período
- `get_compra` — detalhes (itens, parcelas, recebimentos, NFs)
- `add_recebimento` — registrar recebimento de itens
- `cancel_compra`

### RDO (já tem 1, adicionar 3)
- `create_rdo` ✅
- `add_rdo_equipe` — registrar colaborador no RDO (com função e horas)
- `add_rdo_atividade` — adicionar atividade ao RDO
- `add_rdo_ocorrencia` — registrar ocorrência

### Financeiro — Contas a Pagar/Receber (já tem 2, adicionar 4)
- `create_conta_pagar` ✅ / `create_conta_receber` ✅
- `pagar_conta` — dar baixa em conta a pagar (informa conta bancária + data)
- `receber_conta` — dar baixa em conta a receber
- `list_contas_pagar` / `list_contas_receber` — com filtros (status, vencimento, obra)

### Financeiro — Bancos / Lançamentos (4)
- `create_conta_bancaria`
- `list_contas_bancarias` — com saldo atual
- `create_transferencia` — entre contas próprias
- `list_lancamentos` — extrato com filtros

### Cartões / Faturas (3)
- `create_cartao`
- `list_faturas_cartao` — abertas e fechadas
- `pagar_fatura_cartao` — gera/baixa a conta a pagar vinculada

### Fornecedores (3)
- `create_fornecedor`
- `list_fornecedores`
- `update_fornecedor`

### Categorias financeiras (2)
- `create_categoria` (despesa/receita)
- `list_categorias`

### Empresas (2)
- `create_empresa` (filial/CNPJ)
- `list_empresas`

### Estoque (5)
- `create_produto`
- `list_produtos` — com saldo
- `create_almoxarifado`
- `movimentar_estoque` — entrada/saída/ajuste/transferência
- `create_requisicao` — requisição de material

### RH (4)
- `create_colaborador`
- `list_colaboradores`
- `vincular_colaborador_obra` — adicionar colaborador a obra com função
- `desligar_colaborador`

### Medições (2)
- `create_medicao` — gerar medição de uma obra no período
- `list_medicoes`

### Relatórios / consultas gerais (3)
- `fluxo_caixa` — entrada/saída por período
- `relatorio_obra` — custo realizado vs orçado por etapa
- `dashboard_geral` — KPIs (saldo bancos, contas em atraso, obras ativas)

**Total**: ~55 ferramentas (8 existentes + ~47 novas).

## Implementação

Tudo num único arquivo, mantendo o padrão atual:

- `src/lib/ai-assistant.functions.ts` — adicionar entradas em `TOOLS`, em `MUTATING_TOOLS` (só as que mudam dados), e os `case` em `executeTool`.
- `src/components/app/AIAssistant.tsx` — adicionar entradas em `TOOL_LABELS` e funções `summarizeArgs` para as novas ações.
- `credit_action_costs` (tabela): adicionar custos para as novas ações via migração (defaults sugeridos: leituras 0, criações leves 2, criações pesadas 5-8, baixas/pagamentos 3).

## Sugestão de fasear (opcional)

Se preferir não fazer tudo de uma vez, posso entregar em fases:

- **Fase 1 (essencial diário)**: pagar/receber contas, list_compras, list_contas_pagar, get_obra_resumo, fluxo_caixa, dashboard_geral, vincular_colaborador_obra, add_rdo_equipe — ~10 tools
- **Fase 2 (gestão)**: CRUD de cartões, contas bancárias, fornecedores, categorias, empresas, colaboradores — ~15 tools
- **Fase 3 (estoque + medições)**: produtos, almoxarifados, movimentações, requisições, medições — ~10 tools
- **Fase 4 (relatórios avançados)**: relatorio_obra, list_lancamentos, list_faturas, etc. — ~10 tools

## Perguntas

1. **Faço tudo de uma vez (~55 tools) ou prefere fasear?**
2. **Alguma área que você nem quer expor ao agente?** (ex.: exclusões — `delete_*` — costuma ser arriscado)
3. **Quer que ações destrutivas (`delete_*`, `cancel_*`, `archive_*`) tenham confirmação extra ("dupla confirmação")?**