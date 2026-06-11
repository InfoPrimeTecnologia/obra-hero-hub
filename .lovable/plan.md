# Sistema de Créditos para Assistente IA

## Visão geral

Hoje o Assistente IA é liberado por plano (Empresarial). Vamos adicionar uma camada de **créditos consumíveis**: cada interação com o assistente desconta um número de créditos que varia conforme a complexidade da ação. O usuário pode recarregar créditos comprando pacotes definidos pelo admin (pagamento via Asaas, que já está integrado).

## Banco de dados (novas tabelas)

1. **`credit_packages`** (admin define os pacotes de recarga)
   - `nome` (ex.: "Pacote Bronze")
   - `valor_brl` (preço em reais)
   - `creditos` (quantidade de créditos)
   - `ativo`, `ordem`, `destaque`
   - RLS: leitura para `authenticated`; escrita só admin

2. **`credit_action_costs`** (admin define custo por ação)
   - `action_key` (ex.: `chat_message`, `create_compra`, `transcribe_audio`)
   - `descricao`, `custo` (int), `ativo`
   - Seed com defaults (ver tabela abaixo)
   - RLS: leitura `authenticated`; escrita só admin

3. **`customer_credits`** (saldo atual por empresa)
   - `customer_id` UNIQUE, `saldo` int, `updated_at`
   - RLS: leitura para membros do customer

4. **`credit_transactions`** (extrato/histórico)
   - `customer_id`, `tipo` (`recarga` | `consumo` | `ajuste` | `estorno`)
   - `delta` (positivo = entra, negativo = sai)
   - `saldo_apos`, `action_key`, `descricao`
   - `invoice_id` (FK quando recarga), `user_id` (quem consumiu)
   - RLS: leitura para membros do customer; insert via server fn

## Custos default (tabela `credit_action_costs`)

| Ação | Custo | Justificativa |
|---|---|---|
| `chat_message` | 1 | Resposta simples do GPT-4o-mini |
| `transcribe_audio` | 2 | Whisper, custo extra de áudio |
| `list_obras` (leitura) | 0 | Não cobra leituras auxiliares |
| `create_etapa` | 2 | Mutação leve |
| `create_subetapa` | 2 | Mutação leve |
| `create_rdo` | 5 | Cria registro composto |
| `create_compra` | 8 | Toca financeiro/estoque |
| `create_conta_pagar` | 5 | Lançamento financeiro |
| `create_conta_receber` | 5 | Lançamento financeiro |

Editáveis pelo admin.

## Server functions (novo `credits.functions.ts`)

- `getMyCredits()` → saldo atual + últimos 20 lançamentos
- `listCreditPackages()` → pacotes ativos ordenados
- `createCreditRecharge({ packageId })` → cria fatura Asaas (cobra `valor_brl`); ao webhook confirmar pagamento, credita `creditos` no saldo
- `consumeCredits({ actionKey, descricao })` → server-side helper, usado pelo assistente; lança erro `INSUFFICIENT_CREDITS` se saldo < custo
- Admin: `adminUpsertPackage`, `adminUpsertActionCost`, `adminAdjustCredits` (com motivo)

## Integração no Assistente IA

Em `ai-assistant.functions.ts`:
- `aiChat`: antes de chamar OpenAI, cobra `chat_message`
- `aiTranscribe`: cobra `transcribe_audio`
- `aiExecuteAction`: ao confirmar, cobra o custo da `tool` específica (`create_compra`, etc.)
- Se saldo insuficiente, retorna `{ type: 'no_credits', needed, balance }` para a UI mostrar CTA "Recarregar"

## Webhook Asaas

Em `api/public/asaas-webhook.ts`, ao processar `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` de uma fatura do tipo "recarga de créditos":
- Identificar pelo `external_reference` (`credit_recharge:<package_id>:<customer_id>`)
- Inserir transação `recarga` + atualizar `customer_credits.saldo`
- Idempotente (não credita 2x para a mesma `invoice_id`)

## UI

### Usuário
- **`/app/creditos`** (nova rota):
  - Card grande: "Saldo atual: X créditos"
  - Grid dos pacotes (admin define), botão "Recarregar" → abre fatura Asaas
  - Tabela de extrato (últimas 50 transações)
- **`AIAssistant`**: badge mostrando saldo no header; banner "Sem créditos" com link para `/app/creditos` quando vazio
- **`TopBar`**: pill clicável com saldo (só plano Empresarial)

### Admin
- **`/admin/creditos`** (nova rota):
  - Aba "Pacotes de recarga": CRUD (nome, valor R$, créditos, ativo, destaque)
  - Aba "Custos por ação": tabela editável (action_key, descrição, custo)
  - Aba "Ajustes manuais": buscar empresa, somar/subtrair créditos com motivo (audit)

## Sem mudança de comportamento para quem não usa o assistente

O sistema de créditos só importa para empresas no plano Empresarial (gate atual permanece). Empresas que não acessam o assistente nunca veem a página de créditos.

## Arquivos previstos

**Migração**: 1 arquivo SQL (4 tabelas + grants + RLS + seed dos pacotes/custos default)

**Novos**:
- `src/lib/credits.functions.ts`
- `src/routes/app.creditos.tsx`
- `src/routes/admin.creditos.tsx`
- `src/components/app/CreditBalanceBadge.tsx`

**Editados**:
- `src/lib/ai-assistant.functions.ts` (cobrar créditos)
- `src/components/app/AIAssistant.tsx` (mostrar saldo + erro "sem créditos")
- `src/components/app/TopBar.tsx` (pill de saldo)
- `src/components/admin/AdminLayout.tsx` (menu "Créditos")
- `src/routes/api/public/asaas-webhook.ts` (creditar recarga)
- `src/routeTree.gen.ts`

## Confirmação

Confirma os custos default da tabela acima? Posso ajustar antes de implementar, ou seguir com esses valores e você edita depois pelo admin (que é justamente para isso).
