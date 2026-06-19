## Objetivo

Ao entrar em uma obra (`/app/obras/$obraId/...`), substituir a sidebar global pela **sidebar da obra** com menu agrupado por área, e criar telas novas dentro do contexto da obra — todas já escopadas/filtradas pela obra ativa.

## Estrutura do menu da obra

```
VISÃO GERAL
  Dashboard da obra

ADMINISTRAÇÃO
  RH (equipe da obra)

ENGENHARIA
  Orçamento
  Planejamento (novo — Gantt + tarefas da obra)
  Diário de obra (RDO)

SUPRIMENTOS
  Fornecedores (da obra)
  Compras
  Consulta (novo — cotações)

FINANCEIRO
  Meio de pagamentos (novo — cartões + bancos da obra)
  Contas a pagar
  Faturas cartão
  Caixa e bancos
    ├─ Entrada
    └─ Transferir

RELATÓRIOS
  Relatório de compras (novo)
  Relatório de pagamentos (novo)
  Orçado x Realizado (novo)
```

Topo da sidebar: nome da obra + botão "← Voltar ao sistema" (volta para `/app`).

## Arquitetura

### 1. Layout dedicado da obra

Promover `src/routes/app.obras.$obraId.tsx` (que hoje provavelmente não existe como layout) para **rota-pai com layout próprio** que:

- Substitui a `AppLayout` padrão (renderiza própria sidebar + `<Outlet />`)
- Carrega dados da obra uma vez e expõe via contexto local
- Mantém TopBar para consistência

```text
src/routes/
  app.obras.$obraId.tsx                ← LAYOUT da obra (sidebar nova + Outlet)
  app.obras.$obraId.index.tsx          ← Dashboard da obra (Visão geral)
  app.obras.$obraId.rh.tsx             ← Equipe vinculada
  app.obras.$obraId.orcamento.tsx      ← já existe, mover para dentro
  app.obras.$obraId.planejamento.tsx   ← NOVO (reaproveita Gantt + tarefas)
  app.obras.$obraId.rdo.tsx            ← já existe
  app.obras.$obraId.rdo.$rdoId.tsx     ← já existe
  app.obras.$obraId.fornecedores.tsx   ← NOVO (filtrado)
  app.obras.$obraId.compras.tsx        ← já existe
  app.obras.$obraId.compras.$compraId.tsx ← já existe
  app.obras.$obraId.consulta.tsx       ← NOVO (cotações)
  app.obras.$obraId.pagamentos.tsx     ← NOVO (cartões + bancos da obra)
  app.obras.$obraId.contas-pagar.tsx   ← NOVO (filtrado)
  app.obras.$obraId.faturas.tsx        ← NOVO (filtrado)
  app.obras.$obraId.caixa.tsx          ← NOVO (extrato com Entrada/Transferir)
  app.obras.$obraId.relatorios.compras.tsx       ← NOVO
  app.obras.$obraId.relatorios.pagamentos.tsx    ← NOVO
  app.obras.$obraId.relatorios.orcado-realizado.tsx ← NOVO
```

Como a rota-pai vira layout, **a tela atual `/app/obras/$obraId` (lista de detalhes da obra) precisa virar `.index.tsx`** — caso já exista uma tela "detalhes da obra" hoje, ela vira o Dashboard.

### 2. Como funciona a "substituição" da sidebar

Hoje toda rota `/app/*` passa por `src/routes/app.tsx` → `AppLayout`. A solução:

- `app.tsx` continua sendo o layout global com sidebar global (renderiza `<Outlet />`)
- Mas o **layout filho** `app.obras.$obraId.tsx` esconde a sidebar global e mostra a sua:
  - Opção A (mais limpa): a sidebar global lê `useRouterState().location.pathname` e, se começa com `/app/obras/{id}/`, retorna `null`. O layout da obra renderiza a própria sidebar.
  - Vou usar essa abordagem — uma flag no `AppLayout` que oculta a sidebar global quando estamos em rota de obra; a sidebar da obra é renderizada pelo layout `$obraId.tsx`.

### 3. Sidebar da obra (novo componente)

`src/components/app/ObraSidebar.tsx`:

- Mesma estética da sidebar global (mesmos tokens, mesmo gradiente)
- Cabeçalho com foto/iniciais + nome da obra
- Botão "← Voltar ao sistema" no topo (volta `/app`)
- Grupos colapsáveis (mesmo padrão do `AppLayout`)
- Filtra itens por permissão (`usePermissions`) e plano (`usePlanModules`)

### 4. Telas novas (esqueletos funcionais)

Cada tela nova começa com:
- Header padrão da página
- Filtros pré-aplicados pela `obraId`
- Reutiliza componentes existentes (tabelas, cards, dialogs) quando possível
- Lê dados via `supabase` client browser com `.eq("obra_id", obraId)`

**Telas reaproveitam queries existentes**: ex.: `app.obras.$obraId.contas-pagar.tsx` é praticamente o mesmo código de `app.contas-pagar.tsx`, só com filtro fixo pela obra (sem permitir trocar).

**Planejamento**: unifica Gantt + Kanban de tarefas em abas (já temos Gantt e Tarefas separados).

**Consulta**: tela nova simples para cotações (apenas estrutura inicial — lista + botão "Nova consulta" desabilitado por enquanto, ou abrindo modal placeholder). Decidir junto se quer já implementar o fluxo completo ou só o esqueleto.

**Meio de pagamentos**: agrega Cartões + Contas bancárias usadas pela obra em uma tela só.

**Relatórios da obra**: 3 telas com queries agregadas + cards/tabelas. Reaproveita lógica de `app.relatorios.tsx` filtrando por obra.

### 5. Atualização do menu global

No `AppLayout` (sidebar global), o link "Obras" continua igual. Ao clicar em uma obra, vai para `/app/obras/$obraId` → entra no contexto da obra.

## Pontos a confirmar / observações

- **Consulta de preços**: vou criar a tela vazia ("Em breve") ou fluxo mínimo (cadastro de consulta + itens)? Sugiro esqueleto agora e fluxo completo numa fase 2 dedicada, porque envolve modelagem de dados nova (tabela `consultas_preco`).
- **RH da obra**: vai mostrar `colaborador_obras` (vínculos) + ações de adicionar/remover/trocar função. Sem cadastrar colaborador novo (isso fica no RH global).
- **Caixa e bancos > Entrada/Transferir**: vou interpretar como duas abas/ações dentro da tela "Caixa e bancos" (extrato + botões "Nova entrada" e "Transferir"). OK?
- **Faturas cartão**: dentro da obra, mostra só faturas que têm lançamentos vinculados à obra.

## Validação antes de te entregar

Vou rodar Playwright após implementar e validar:
1. Entrar em uma obra → sidebar troca corretamente
2. Cada item do menu navega sem erro
3. Botão "Voltar ao sistema" volta pra `/app` com sidebar global
4. Permissões/plano escondem itens corretamente

## Entrega

Pacote único, todos os arquivos criados e rotas registradas. Telas novas começam funcionais (lista + filtros pela obra), os fluxos de criação/edição que já existem globalmente são reaproveitados via dialogs/sheets compartilhados.
