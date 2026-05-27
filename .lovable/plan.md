## Versão 1.0.5 — Escopo amplo

Vou dividir em blocos. Confirme se quer tudo de uma vez ou priorizar.

### 1. Login — "Lembrar de mim"
- Checkbox em `src/routes/login.tsx`.
- Quando marcado: salva email em `localStorage` (`mestre360.remember_email`) e mantém sessão persistente (padrão atual do Supabase).
- Quando desmarcado: limpa email salvo; sessão expira no fechamento do navegador (`signOut` em `beforeunload` se não-lembrar — opcional).
- Pré-preenche o email no próximo acesso.

### 2. Dashboard por Obra
- Sidebar: item **Obras** vira accordion com submenu listando obras ativas do cliente (já existem em `obras`).
- Ao clicar em uma obra: define `ObraSelecionada` (já existe `obra-context.tsx`) e navega para `/app` (dashboard).
- Dashboard (`src/routes/app.index.tsx`) detecta `obra` do contexto:
  - Se obra selecionada → métricas filtradas por `obra_id` (contas pagar/receber, compras, colaboradores, estoque) + nome + **foto da obra** em destaque.
  - Se nenhuma → métricas gerais (comportamento atual).
- Botão "Limpar filtro" para voltar à visão geral.

### 3. Foto da obra
- Migration: adicionar coluna `foto_url text` em `obras`.
- Bucket de storage: reutilizar `obra-fotos` (já existe, privado) → torná-lo público OU gerar URL assinada. Vou tornar público para simplificar exibição.
- Em `app.obras.index.tsx` (cadastro/edição de obra): upload de foto.
- Exibida no dashboard quando obra está filtrada.

### 4. Orçamento — Etapas e Subetapas
- Já existem tabelas `orcamento_etapas` e `orcamento_subetapas`. Confirmar UI em `app.obras.$obraId.orcamento.tsx`:
  - CRUD de etapas (nome, ordem, datas previstas).
  - Dentro de cada etapa, CRUD de subetapas (nome, tipo, valor orçado).
  - Visual hierárquico (accordion).

### 5. Compras vinculadas à subetapa
- Em `app.obras.$obraId.compras.tsx` (form de compra/itens): cada item de compra **deve** ter `subetapa_id` obrigatório (campo já existe em `compra_itens`).
- Validação: bloquear salvar compra se algum item sem subetapa.
- Listagem agrupa por etapa/subetapa.

### 6. Nota fiscal anexa à compra (individual)
- Migration: coluna `nf_url text`, `nf_numero text`, `nf_chave text` em `compras` (ou nova tabela `compra_notas_fiscais` se múltiplas NFs por compra). Vou usar nova tabela `compra_notas_fiscais` (anexo por compra, suporta múltiplas).
- Bucket novo: `notas-fiscais` (privado, URLs assinadas).
- UI de upload no detalhe da compra.

### 7. Leitor de NF-e (plano Empresarial)
- Upload de XML da NF-e → parser identifica itens (descrição, qtd, valor) e sugere preenchimento de `compra_itens`.
- Server function `parseNfeXml` (`src/lib/nfe.functions.ts`) — parse puro de XML, sem chamadas externas.
- Gating por plano: usa `use-plan-modules.ts` → bloquear se plano ≠ "Empresarial". Mostrar upsell.

### 8. RH — Colaboradores por obra
- Já existe `colaborador_obras` (vínculo N:N). Garantir UI em `app.rh.colaboradores.tsx`:
  - No cadastro de colaborador, selecionar uma ou mais obras (datas início/fim opcionais).
  - Lista filtrável por obra (usa `ObraSelecionada` quando ativa).

### 9. Financeiro por obra
- `contas_pagar`, `contas_receber`, `lancamentos`, `compras` já têm `obra_id`.
- Quando `ObraSelecionada` ativa, todas as telas de financeiro (`contas-pagar`, `contas-receber`, `fluxo-caixa`, `relatorios`) filtram por `obra_id`.
- Quando nenhuma → visão geral consolidada.
- Adicionar badge "Filtrado por obra: X" no topo das páginas quando aplicável.

### 10. Versionamento
- Inserir release **v1.0.5** em `app_releases` com lista completa.

---

### Detalhes técnicos
- Migrations necessárias:
  - `ALTER TABLE obras ADD COLUMN foto_url text;`
  - `CREATE TABLE compra_notas_fiscais (id, customer_id, compra_id, numero, chave, arquivo_url, valor, emitida_em, created_at)` + GRANTs + RLS.
  - Storage: tornar `obra-fotos` público; criar bucket `notas-fiscais` privado.
- Componente `ObraScopeBadge` para exibir filtro ativo.
- Hook `useObraScopeFilter()` para aplicar `.eq('obra_id', obra.id)` quando ativa.

### Risco / escopo
Esse pacote é grande — provavelmente 2–3 turnos de implementação para fazer bem feito. Sugiro priorizar:
- **Fase A (essa rodada)**: 1 (lembrar login), 2 (submenu obras + dashboard filtrado), 3 (foto da obra), 9 (financeiro por obra usando contexto existente). Já entrega visualmente o "dashboard por obra".
- **Fase B (próxima)**: 4, 5, 6 (orçamento + vínculo + NF anexa).
- **Fase C**: 7 (leitor NF-e empresarial), 8 (RH refinado).

Confirme: **toca tudo de uma vez** ou **vai por fases A → B → C**?
