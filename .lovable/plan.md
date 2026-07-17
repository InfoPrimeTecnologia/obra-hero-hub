## Requisições recebidas

1. **Plano Básico** — remover módulo/menu "Estoque".
2. **Obra ativa › Financeiro › Meios de pagamento** — permitir cadastrar meios de pagamento vinculados à obra (hoje só global).
3. **Obra ativa › Suprimentos › Consulta** — nova tela de consulta de compras com filtros (fornecedor, tipo, faturamento) mostrando compras do fornecedor.
4. **Obra ativa › Administração › RH** — permitir criar colaborador direto na obra (hoje só global).
5. **Obra ativa › Engenharia › Diário de Obra › Equipe** — permitir cadastrar equipe interna e equipe externa.

## Ordem de entrega sugerida (um item por turno, para revisão)

- **Turno 1 (agora):** #1 Remover Estoque do menu + #5 Equipe interna/externa no RDO (mudanças pequenas, sem SQL de schema pesado).
- **Turno 2:** #4 Cadastro de colaborador dentro da obra (reaproveita `colaboradores` + vínculo automático em `colaborador_obras`; sem schema novo).
- **Turno 3:** #2 Meios de pagamento por obra — requer **SQL** (adicionar `obra_id` nullable em `contas_bancarias` ou `cartoes`, ajustar RLS/GRANT, filtros). Entrego migration + script idempotente para produção.
- **Turno 4:** #3 Consulta de compras por fornecedor/tipo/faturamento — provavelmente só front (reaproveita `compras` + joins). Se precisar de índice, entrego SQL.

## Detalhes técnicos por item

### 1. Retirar Estoque
- Remover itens de menu/sidebar/rotas de Estoque (`AppLayout.tsx`, sub-menu Suprimentos).
- Manter tabelas `estoque_*` no banco (não apagar dados) — só ocultar UI. Sem SQL.

### 5. RDO — Equipe interna/externa
- Em `rdo_equipes` já existe estrutura; adicionar campo `tipo` ('interna' | 'externa') se não existir → **SQL necessário**.
- UI: toggle no formulário de equipe do RDO.

### 4. Colaborador na obra
- Botão "Novo colaborador" dentro de `app.obras.$obraId.rh` que abre modal do cadastro global + já vincula em `colaborador_obras` com a obra atual. Sem schema novo.

### 2. Meios de pagamento por obra
- Adicionar `obra_id uuid null` em `contas_bancarias` e `cartoes` (ou criar tabela `obra_meios_pagamento`).
- Preferência: coluna `obra_id` nullable — `null` = global, preenchido = exclusivo da obra.
- Ajustar filtros nos selects de pagamento para: `obra_id IS NULL OR obra_id = :obra`.
- **SQL entregue como migration + arquivo `sql/producao-meios-pagamento-obra.sql`.**

### 3. Consulta de compras
- Nova rota `app.obras.$obraId.suprimentos.consulta.tsx`.
- Filtros: fornecedor (select), tipo (material/serviço), faturamento (à vista/cartão/boleto).
- Lista com totais por fornecedor. Sem SQL (ou índice opcional).

## Changelog
Cada turno registra entrada em `app_releases` via SQL.

Confirma a ordem? Posso começar pelo **Turno 1** (Remover Estoque + Equipe interna/externa no RDO)?
