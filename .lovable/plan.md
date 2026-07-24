## Feedback do cliente (22/07)

O fluxo de cadastro de compra está fragmentado: usuário preenche cabeçalho → salva → só depois lança itens → e ainda vê pop-up. Além disso, há campos financeiros (forma de pagamento, parcelas, 1ª parcela) misturados na compra — que só deveriam aparecer no passo "Gerar contas a pagar".

## Objetivo

Uma única tela `/compras/nova` com toda a compra (cabeçalho + itens) preenchida antes de salvar. Ao salvar, ir direto para a tela da compra criada, onde já existe o botão **Gerar contas a pagar** (etapa financeira).

## Alterações

### 1. `src/routes/app.obras.$obraId.compras.nova.tsx` (reescrever)
- **Remover** os campos: Forma de pagamento, Parcelas, 1ª parcela (movem-se para "Gerar contas a pagar").
- **Manter** cabeçalho: Importar NF, Fornecedor (+ Novo), Descrição, Etapa*, Subetapa* (+ criar nova), Natureza*, Data da compra*, Desconto, Acréscimo.
- **Adicionar seção "Itens" inline** na mesma página (não modal/pop-up):
  - Tabela editável linha a linha: Descrição, QTD, UND, Valor unit., Total (calc.), Ação (remover).
  - Botão "+ Adicionar item".
  - Total geral dos itens somado ao final.
- Botão **"Criar compra"**:
  - Validação: precisa etapa, subetapa, natureza, data e ≥1 item.
  - Salva `compras` (sem forma_pagamento/parcelas — usar defaults ou tornar nullable, ver seção SQL).
  - Salva `compra_itens` em lote.
  - Redireciona para `/app/obras/$obraId/compras/$compraId` (tela detalhada onde já existe "Gerar contas a pagar").

### 2. `src/routes/app.obras.$obraId.compras.$compraId.tsx`
- Confirmar que o botão **Gerar contas a pagar** continua funcionando e agora é o único lugar que coleta forma_pagamento / qtd_parcelas / data 1ª parcela.
- Ajustar cabeçalho da compra para não exibir mais "1x" se não houver parcelas ainda.

### 3. Remover o modal/pop-up de item
- Localizar o componente atual de adicionar item (dialog) usado em `compras.$compraId.tsx` e substituir por inclusão inline (mesma UX da tela nova).

## SQL para produção

A tabela `compras` hoje tem `forma_pagamento text not null` e `qtd_parcelas integer not null`. Como a criação passa a ocorrer antes da definição financeira, precisamos permitir criar sem esses campos.

Arquivo a ser gerado: **`sql/producao-1.6.0-compra-sem-financeiro.sql`** (idempotente)

```sql
-- Torna campos financeiros opcionais na criação da compra
ALTER TABLE public.compras ALTER COLUMN forma_pagamento DROP NOT NULL;
ALTER TABLE public.compras ALTER COLUMN qtd_parcelas DROP NOT NULL;
ALTER TABLE public.compras ALTER COLUMN qtd_parcelas SET DEFAULT 0;

-- Registro no changelog
INSERT INTO public.app_releases (version, highlight, items)
VALUES ('1.6.0',
  'Fluxo de compra simplificado',
  '["Nova compra em tela única com itens inline","Campos financeiros movidos para Gerar contas a pagar","Remoção do pop-up de item"]'::jsonb)
ON CONFLICT (version) DO NOTHING;
```

## Fora de escopo (não vou mexer)

- Lógica de "Gerar contas a pagar" existente — permanece como está.
- Estrutura de `compra_itens` — sem alteração.
- Tela de listagem/árvore de compras.

## Entrega

Um turno só. Após aprovação, entrego código + arquivo SQL para rodar em produção.
