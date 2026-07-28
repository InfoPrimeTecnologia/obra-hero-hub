## Feedback do cliente (28/07) — 4 pontos

Todos concentrados em Compras → Contas a pagar → Fatura de cartão. Nenhuma alteração de schema exceto o registro do release; o SQL vai idempotente para o Editor do Supabase de produção.

## 1. Compra à vista no mesmo dia (bug de data)

Arquivo: `src/routes/app.obras.$obraId.compras.$compraId.tsx`

Sintomas relatados:
- Ao gerar contas a pagar "à vista", o default vem 30 dias à frente.
- Ao trocar a data da 1ª parcela para hoje, a data salva volta 1 dia (efeito timezone: `new Date("2026-07-28")` vira 21h do dia 27 em UTC-3).

Ajustes:
- Novo botão/opção **"À vista"** no diálogo "Gerar contas a pagar" — força `qtd_parcelas = 1`, `data_vencimento = data_emissao`, esconde intervalo.
- Quando `qtd_parcelas = 1`, esconder o campo "Intervalo entre parcelas".
- Corrigir parsing/formatação de datas para usar sempre string `YYYY-MM-DD` local (sem `new Date(iso)` que aplica timezone). Preview e insert usam a mesma helper.
- Default do intervalo continua 30 quando `qtd_parcelas > 1`; mínimo aceito `0` (mesmo dia) em vez de `1`.

## 2. Pagamento da fatura de cartão indicando conta bancária

Arquivos: `src/routes/app.faturas-cartao.tsx` (+ helper de baixa).

Hoje "Fechar fatura" gera uma conta a pagar, mas não há botão para **pagar** a fatura escolhendo a conta bancária de saída.

Ajustes:
- Novo botão **"Pagar fatura"** em faturas com status `fechada` (e opcionalmente em `aberta`, respeitando data).
- Diálogo pede: **conta bancária** (select de `contas_bancarias` ativas do escopo), **data do pagamento** (default = hoje), **valor pago** (default = `valor_total`).
- Ao confirmar:
  - marca `faturas_cartao.status = 'paga'`, `valor_pago`, `dt_pagamento`, `conta_bancaria_id`.
  - marca a `contas_pagar` gerada da fatura (`fatura_cartao_id = f.id`) como `pago` com a mesma conta/data/valor.
  - as parcelas individuais da fatura seguem o status da conta agregada (não vira 1 lançamento por parcela no extrato — só o pagamento consolidado da fatura, que é o comportamento contábil correto).

## 3. Poka-yoke: não gerar contas duplicadas para compra no cartão

Arquivo: `src/routes/app.obras.$obraId.compras.$compraId.tsx`.

Já bloqueamos quando `contas_pagar_geradas.length > 0`. Falta considerar as parcelas que caem em cartão: elas vivem em `compra_parcelas` (para o trigger de fatura) e não estão sendo contadas.

Ajustes:
- Ao carregar a compra, também buscar `compra_parcelas` daquela compra. Se existir qualquer parcela (cartão) **ou** qualquer `contas_pagar` (demais meios), considerar `jaFaturada = true`.
- Botão "Gerar contas a pagar" desabilitado com tooltip "Contas a pagar já geradas". Status do card e da árvore respeita a mesma regra.
- Cálculo de status na listagem (`compras.index.tsx`, `consulta.tsx`) passa a olhar as duas origens.

## 4. Fluxo de reversão (estorno → excluir conta → excluir compra)

Requisito contábil: nada é apagado silenciosamente depois de pago; o extrato bancário guarda o histórico via **estorno**.

Fluxo aprovado:

```text
Compra paga
   │  1) Estornar pagamento (na conta a pagar OU no lançamento bancário)
   ▼
Conta a pagar volta a "pendente"; lançamento de estorno aparece no extrato
   │  2) Excluir conta a pagar
   ▼
Compra volta a "pendente" (sem faturamento)
   │  3) Excluir compra
   ▼
Compra removida
```

Arquivos:
- `src/routes/app.contas-pagar.tsx` e `src/routes/app.obras.$obraId.contas-pagar.tsx`
  - Botão **"Estornar pagamento"** em contas `pago`: reabre a conta (`status = 'pendente'`, limpa `dt_pagamento`, `conta_bancaria_id`, `valor_pago`) **e** insere um lançamento de estorno na `contas_bancarias_lancamentos` (tipo `credito`, descrição "Estorno – <descrição original>", vinculado ao mesmo `origem_id`) para preservar histórico do banco.
  - Botão **"Excluir conta a pagar"** só habilitado quando `status = 'pendente'`. Confirmação explicando que a compra volta a "pendente".
- `src/routes/app.obras.$obraId.compras.$compraId.tsx` e `compras.index.tsx`
  - Botão **"Excluir compra"** só habilitado quando `jaFaturada = false` (nenhuma parcela em `compra_parcelas` e nenhuma conta em `contas_pagar`). Se houver itens/anexos, remove em cascata via query.
- Fatura de cartão: quando a última parcela de uma fatura é removida (via exclusão de conta a pagar de cartão), o trigger existente já recalcula. Se todas as parcelas somem, marcar a fatura como `cancelada` (fallback via UI ao excluir a conta agregada de fatura).

## Detalhes técnicos

- Datas: helpers `toLocalYMD(date)` e `fromYMD(str)` centralizadas no arquivo, sem `new Date(iso)`. Preview de vencimentos usa aritmética em `Date` local + `toLocalYMD`.
- Estorno bancário reutiliza a estrutura já existente de `contas_bancarias_lancamentos` (nenhuma coluna nova). Se algum registro obrigatório for identificado na leitura do schema, será documentado antes de ativar o botão.
- "Pagar fatura" só aparece se existir a `contas_pagar` gerada pelo fechamento (já mapeada por `cpByFatura`). Caso o cliente ainda não tenha fechado, o botão "Fechar e pagar" combina os dois passos.

## SQL para o Editor do Supabase (produção)

Arquivo novo: `sql/producao-1.7.1-compras-estorno-fatura.sql` — idempotente, sem DDL, só registro no changelog:

```sql
INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.7.1',
       'Correções em compras, faturas de cartão e estorno',
       '[
         "Compra à vista no mesmo dia (data local, sem defasagem de timezone)",
         "Pagamento de fatura de cartão indicando conta bancária de saída",
         "Bloqueio de geração duplicada de contas para compras no cartão",
         "Fluxo de reversão: estornar pagamento → excluir conta a pagar → excluir compra",
         "Estorno preserva histórico no extrato bancário (auditoria)"
       ]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.7.1');
```

Se, ao ler o schema real de `contas_bancarias_lancamentos` durante a implementação, faltar alguma coluna para representar estorno de forma limpa (ex.: `estorno_de_id`), aviso antes e incluo o `ALTER TABLE` idempotente no mesmo arquivo.

## Fora de escopo

- Redesenho da tela de faturas de cartão.
- Mudanças estruturais em `compra_parcelas` ou `faturas_cartao`.
- Regras de aprovação para estorno (por ora qualquer usuário com permissão de baixa pode estornar).

## Entrega

Um turno após aprovação: código + `sql/producao-1.7.1-compras-estorno-fatura.sql`.
