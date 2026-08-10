# Correções do feedback de 10/08

Os dois problemas do feedback já têm correção pronta no código, mas dependem de um script SQL que ainda não foi rodado no banco de produção. Além disso, um ajuste extra é necessário para o erro da foto.

## 1. Fatura do cartão aparecendo com valor errado (R$ 18.800 em vez de R$ 600)

O que acontece hoje: quando uma fatura de cartão é fechada, o sistema cria **uma única** conta a pagar com o valor total do cartão (somando todas as obras). Por isso a obra nova, que tem só R$ 600 de compra, exibe o valor cheio do cartão. E como existe uma fatura antiga já paga e outra em aberto do mesmo cartão, aparecem os dois cartões repetidos ("Paga" e "Aberta").

Correção:
- A fatura passa a gerar uma conta a pagar **por obra**, com o valor apenas das compras daquela obra.
- Dentro da obra: aparece só a parte da obra (R$ 600 no exemplo).
- Na empresa: continua o total do cartão, com o detalhamento por obra abaixo.
- Pagar dentro da obra quita só a parte da obra; a fatura só fica "paga" quando todas as obras quitarem.
- Faturas já pagas deixam de ser listadas junto das pendentes na obra (some a duplicidade "Paga"/"Aberta").
- Correção retroativa (backfill) das faturas pendentes já existentes.

## 2. Erro ao anexar a foto da obra ("new row violates row-level security policy")

As regras de acesso do armazenamento de fotos da obra em produção estão incompletas: falta a permissão de gravar/substituir arquivo para o usuário da empresa (e para usuários convidados que não são o dono da conta).

Correção:
- Recriar as quatro regras de acesso (ler, enviar, substituir, excluir) do armazenamento de fotos da obra.
- Passar a validar o acesso pela empresa da obra, cobrindo também usuários convidados, não só o dono.
- Mensagem de erro mais clara no envio da foto.

## Detalhes técnicos

- Script novo `sql/producao-1.8.1-fotos-obra-e-fatura.sql` (idempotente, para o SQL Editor do Supabase de produção), contendo:
  - tudo do `1.8.0` (trigger `fatura_to_conta_pagar` por obra, backfill, índice único `fatura_cartao_id + obra_id`);
  - recriação das policies de `storage.objects` para o bucket `obra-fotos` usando `public.user_has_customer_access(auth.uid(), <customer_id da pasta>)` em SELECT/INSERT/UPDATE/DELETE;
  - registro da versão em `app_releases`.
- Frontend:
  - `src/routes/app.obras.$obraId.contas-pagar.tsx`: filtrar faturas com status `paga` do card de faturas pendentes da obra.
  - `src/routes/app.obras.index.tsx`: tratamento de erro do upload com mensagem amigável.
- A mesma migração é aplicada no ambiente de desenvolvimento pelo fluxo padrão de migração.
