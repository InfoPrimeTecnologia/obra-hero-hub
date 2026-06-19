## Escopo: 5 melhorias no sistema

### 1. Card "Abrir obra" em `/app/obras`
- Botão principal em cada card da lista de obras → `/app/obras/$obraId`
- Hover destaca a ação primária; mantém ações secundárias (editar, RDO, etc.)

### 2. Breadcrumb fixo dentro da obra
- Componente `ObraBreadcrumb` no topo de `app.obras.$obraId.tsx`
- Formato: **Empresa › Obra › Seção** (seção derivada do pathname)
- Links clicáveis: Empresa → `/app`, Obra → `/app/obras/$obraId`

### 3. "Última obra" — atalho global
- Ao entrar em uma obra, salva `{ id, name }` em `localStorage` (`mestre360:last-obra`)
- Botão no `TopBar` (quando fora do escopo de obra) "Voltar para [Nome da Obra]"
- Item no menu principal `Obras` mostra última obra acessada em destaque

### 7. Medições por etapa (avanço físico)
- Tabelas `medicoes_obra` e `medicao_obra_itens` já existem — apenas wire UI
- Nova tela `/app/obras/$obraId/medicoes`
- Lista medições (período), cria nova medição com % avanço por subetapa do orçamento
- Em `relatorios.orcado-realizado` adiciona **Curva S** (planejado vs físico vs financeiro) usando recharts

### 10. Notificações in-app (sino no header)
- Sem tabela nova: computa eventos em tempo de query
  - Contas a pagar vencendo em ≤3 dias (não pagas)
  - Faturas de cartão fechando em ≤3 dias
  - Obras sem RDO há ≥7 dias
- Componente `NotificationBell` no `TopBar` (popover com lista, link para origem)
- Hook `useNotifications()` consolida queries Supabase, retorna contagem + itens
- Sem persistência de "lida" por enquanto (V2)

### Validação
- Build limpo
- Playwright: abrir `/app/obras`, clicar "Abrir obra", ver breadcrumb, voltar, ver atalho de última obra no TopBar, clicar sino no header

### Detalhes técnicos
- Sem migration (todas as tabelas já existem)
- Sem mudanças em rotas existentes além de adicionar `medicoes.tsx` na sidebar da obra (grupo Engenharia)
- localStorage key namespaced: `mestre360:last-obra`
- Curva S usa `recharts` (já no projeto)
