# Mestre 360 — Painel Administrador (Fase 1)

Sistema de gestão para obras. Esta primeira fase entrega o **painel administrativo completo**, com integração de pagamentos (ASAAS), e-mails transacionais e WhatsApp. A área do cliente final e os módulos de obra ficam para fases seguintes.

## Identidade visual
- Logo Mestre 360 (anexada) usada no header do painel e na tela de login.
- Paleta extraída da logo: azul-marinho `#1B2C5C` (primário) e laranja `#F39200` (acento), neutros claros para fundo.
- Tipografia limpa, layout administrativo moderno (sidebar + topbar + área de conteúdo).
- Idioma: Português (BR).

## Acesso
- Apenas administradores entram no painel (login por e-mail e senha).
- Não há auto-cadastro: novos admins são criados por outro admin a partir da própria interface.
- Recuperação de senha por e-mail.
- Rota `/login` pública; todo o resto fica protegido atrás de guard de admin.

## Estrutura do painel
Sidebar com navegação fixa para:

1. **Dashboard** — visão geral
2. **Clientes**
3. **Planos**
4. **Faturas**
5. **Tickets de Suporte**
6. **Configurações** (integrações ASAAS / WhatsApp / e-mails / usuários admin)

### 1. Dashboard
Métricas e gráficos do mês atual com comparativo com mês anterior:
- MRR (receita recorrente mensal) e receita do mês
- Total de clientes ativos / inativos / inadimplentes
- Novos clientes no período
- Faturas: emitidas, pagas, vencidas, a vencer
- Taxa de inadimplência
- Tickets de suporte abertos x resolvidos
- Gráfico de receita dos últimos 12 meses
- Gráfico de novos clientes por mês
- Lista das últimas faturas e últimos tickets

### 2. Clientes
- Tabela com busca, filtros (status, plano) e paginação.
- Colunas: nome, e-mail, telefone/WhatsApp, CPF/CNPJ, plano atual, status, próximo vencimento, ações.
- Cadastro/edição com dados pessoais, contato, endereço, plano selecionado e dia de vencimento.
- Ao salvar: cria/atualiza cliente no ASAAS, gera assinatura conforme plano e dispara e-mail e WhatsApp de boas-vindas.
- Tela de detalhe do cliente com abas: Dados, Assinatura, Faturas, Tickets, Histórico de comunicações enviadas.
- Ações: ativar/inativar, cancelar assinatura, reenviar boas-vindas, gerar fatura avulsa.

### 3. Planos
- Listagem dos planos cadastrados.
- Cadastro: nome, descrição, valor, ciclo (mensal, trimestral, semestral, anual), recursos/limites (lista textual), status ativo/inativo, plano em destaque.
- Edição respeita assinaturas já existentes (não altera valores retroativos).

### 4. Faturas
- Tabela com filtros por status (pendente, paga, vencida, cancelada, estornada), período, cliente e plano.
- Colunas: cliente, descrição, valor, vencimento, pagamento, status, forma, ações.
- Detalhe da fatura com link de pagamento ASAAS, comprovante, histórico de tentativas e comunicações enviadas.
- Ações: copiar link de cobrança, reenviar cobrança (e-mail + WhatsApp), cancelar fatura, marcar como paga manualmente.
- Sincronização automática via webhook do ASAAS (criação, pagamento, vencimento, estorno).

### 5. Tickets de Suporte
- Lista de tickets com filtros por status (aberto, em andamento, aguardando cliente, resolvido, fechado), prioridade e cliente.
- Tela de ticket com thread de mensagens (admin x cliente), anexos, mudança de status/prioridade, atribuição a um admin.
- Nesta fase, tickets podem ser criados manualmente pelo admin em nome do cliente; a criação pelo cliente final virá com a área do cliente.

### 6. Configurações
- **Integrações**: campos para chave da API do ASAAS (sandbox/produção), URL e token da API de WhatsApp, status da conexão e botão "Testar".
- **E-mails**: visualização e edição leve dos templates (boas-vindas, fatura emitida, lembrete antes do vencimento, fatura vencida).
- **Mensagens WhatsApp**: edição dos textos enviados nos mesmos quatro gatilhos.
- **Usuários administradores**: lista, convite por e-mail, ativar/inativar, redefinir senha.

## Integrações

### ASAAS (gateway de pagamento)
- Sincronização bidirecional de clientes e assinaturas.
- Geração automática de faturas conforme ciclo do plano.
- Webhook recebendo eventos `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED` para manter as faturas atualizadas em tempo real.
- Tratamento de assinaturas canceladas e reativadas.

### E-mails automáticos (Lovable Emails)
Disparos:
- Boas-vindas ao cadastrar cliente
- Fatura emitida (com link de pagamento)
- Lembrete 3 dias antes do vencimento
- Fatura vencida / cobrança
Templates com a identidade Mestre 360. Histórico salvo por cliente.

### WhatsApp
Mesmos quatro gatilhos enviados também via WhatsApp, usando a API que você vai fornecer. Texto editável nas Configurações. Histórico de envios salvo por cliente, com status (enviado, entregue, falhou).

## Automações agendadas
- Job diário que verifica faturas a vencer em 3 dias e dispara o lembrete (e-mail + WhatsApp).
- Job diário que reprocessa faturas marcadas como vencidas e dispara cobrança.
- Reprocessamento idempotente (não envia duas vezes para o mesmo gatilho).

## Detalhes técnicos
- Stack: TanStack Start + React + Tailwind + shadcn/ui.
- Backend: Lovable Cloud (Supabase) — autenticação, banco, RLS, storage (anexos de tickets).
- Tabelas principais: `profiles`, `user_roles` (com role `admin`), `plans`, `customers`, `subscriptions`, `invoices`, `tickets`, `ticket_messages`, `communications_log`, `integration_settings`, `message_templates`, `webhook_events`.
- Roles em tabela separada (`user_roles`) com função `has_role()` para evitar recursão de RLS; toda área administrativa exige `has_role(auth.uid(), 'admin')`.
- Chaves do ASAAS e do WhatsApp armazenadas como secrets do servidor, nunca expostas no cliente.
- Server functions/routes para chamadas ao ASAAS, envio de WhatsApp, processamento de webhooks (em `/api/public/asaas-webhook` com validação de origem) e jobs agendados via pg_cron.
- Validação de entrada com Zod em todos os formulários e endpoints.

## O que você precisará me passar quando aprovarmos
1. Chave da API do ASAAS (sandbox primeiro, depois produção).
2. URL base, token e formato de payload da sua API de WhatsApp (ou link da documentação).
3. Domínio para envio dos e-mails (configuração guiada na hora).

## Fora do escopo desta fase
- Área de login/portal do cliente final.
- Módulos operacionais de obra (orçamentos, diário de obra, equipes, materiais etc.).
- App mobile.

Esses itens entram em fases seguintes, mas o banco e a estrutura já ficam preparados para recebê-los.