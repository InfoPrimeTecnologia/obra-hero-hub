## Feedback do cliente (27/07)

Cinco pontos, todos concentrados no fluxo Compras → Contas a pagar → Cartão.

## 1. Tela da compra — limpeza visual

Arquivo: `src/routes/app.obras.$obraId.compras.$compraId.tsx`

- **Remover** o bloco "Parcelas" ("Adicione itens para as parcelas") — vestígio do fluxo antigo, não serve para nada agora que parcelas nascem em "Gerar contas a pagar".
- **Remover** o bloco "Recebimentos" da tela de compra. Recebimento é controle de estoque; será exibido só para quem tiver o módulo de estoque (hoje removido do menu). Também escondo os contadores "Recebida: 0 / X" nos itens.
- **Destacar em vermelho** o cartão "Contas a pagar geradas" quando `nenhuma conta ainda foi gerada` (badge/borda `destructive` + texto "Compra ainda não faturada"). Assim que existe pelo menos 1 parcela, volta ao visual neutro.

## 2. "Gerar contas a pagar" — regras por meio de pagamento

Mesmo arquivo, no diálogo/seção "Gerar contas a pagar".

- Data de emissão: já vem por default da data da compra — manter.
- **Cartão de crédito**: quando o meio selecionado for um cartão, esconder "1ª parcela vence" e "Intervalo entre parcelas". As datas de vencimento passam a ser calculadas pela regra do cartão (`dia_fechamento`, `dia_vencimento`): cada parcela cai no vencimento da fatura correspondente ao mês em que ela é lançada, a partir da data da compra. Mostrar preview das datas antes de confirmar.
- **Demais meios (pix, boleto, transferência, dinheiro)**: manter "1ª parcela vence" e **adicionar** campo "Intervalo entre parcelas (dias)" com default 30, aceitando 10/15/qualquer valor. Vencimentos passam a ser `1ª parcela + (n-1) × intervalo`.
- Preview das parcelas (data + valor) renderizado antes do botão "Gerar", para o usuário conferir.

## 3. Compra faturada não pode gerar contas de novo (poka-yoke)

Mesmo arquivo.

- Se `contas_pagar_geradas.length > 0`, desabilitar o botão "Gerar contas a pagar" e trocar o texto por "Contas a pagar já geradas". Tooltip explica que para refazer é preciso excluir as parcelas existentes.
- Na árvore de compras (`compras.index.tsx`) e na Consulta de compras (`consulta.tsx`), o status "pendente" hoje é fixo. Passar a calcular:
  - `faturada` (cinza) — tem contas a pagar geradas, nenhuma paga ainda.
  - `paga` (verde) — todas as contas a pagar da compra estão com `status = 'pago'`.
  - `parcial` (âmbar) — mistura.
  - `pendente` (vermelho) — nenhuma conta gerada.
- Botão "Gerar contas a pagar" só aparece quando status = `pendente`.

## 4. Compras no cartão precisam aparecer em "Faturas de cartão"

Arquivos: `src/routes/app.faturas-cartao.tsx`, `src/routes/app.obras.$obraId.faturas.tsx`.

Hoje a tela lista lançamentos manuais. Passar a agregar também as **parcelas de `contas_pagar` cujo `cartao_id` está preenchido**, agrupadas pela fatura em que caem (competência = mês/ano do vencimento derivado da regra do cartão). Cada linha mostra data da compra, fornecedor, descrição, parcela n/total, valor. Total da fatura = soma das parcelas do período.

Sem migração — só passa a ler o que já existe.

## 5. Item "Recebimento" (esclarecimento)

Confirmar com o cliente que recebimento é módulo de estoque. Como estoque está desativado, esconder completamente da UI de compras (já coberto no item 1). Se um dia o módulo voltar, reativa via feature flag.

## SQL para produção

**Nenhuma alteração de schema.** Todos os campos necessários (`cartao_id`, `dia_fechamento`, `dia_vencimento` em `cartoes`; `status`, `data_vencimento` em `contas_pagar`) já existem. O único SQL será o registro no changelog:

Arquivo: `sql/producao-1.7.0-compras-fluxo-cartao.sql` (idempotente)

```sql
INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.7.0',
       'Compras, contas a pagar e faturas de cartão',
       '["Tela da compra limpa (parcelas/recebimento removidos)","Alerta vermelho quando a compra ainda não foi faturada","Cartão de crédito usa regra do próprio cartão para calcular vencimentos","Intervalo configurável entre parcelas em pix/boleto/transferência","Botão Gerar contas a pagar bloqueado quando já existem parcelas (poka-yoke)","Status real da compra: pendente / faturada / parcial / paga","Compras no cartão passam a aparecer em Faturas de cartão"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.7.0');
```

## Fora de escopo

- Reativar módulo de estoque / recebimento.
- Mudar estrutura de `contas_pagar` ou `cartoes`.
- Redesenho da tela de faturas — só passa a incluir a nova fonte de dados.

## Entrega

Um turno. Após aprovação: código + `sql/producao-1.7.0-compras-fluxo-cartao.sql` para rodar no Supabase de produção.
