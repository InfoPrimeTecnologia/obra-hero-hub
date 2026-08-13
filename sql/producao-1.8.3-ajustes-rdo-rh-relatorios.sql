-- Mestre 360 — v1.8.3
-- Ajustes de RDO (exclusão + fotos no PDF), RH na obra (ver/editar colaborador),
-- relatórios da empresa (filtro por obra + subetapas) e financeiro segregado obra/empresa.
-- Nenhuma alteração de schema é necessária: apenas o registro no changelog.
-- Script idempotente.

INSERT INTO public.app_releases (version, title, notes, released_at)
SELECT
  '1.8.3',
  'Ajustes de RDO, RH e relatórios',
  E'- Financeiro: contas e faturas de obra são pagas somente na obra; empresa apenas visualiza, com filtro por obra.\n'
  || E'- Correção do saldo em caixa e bancos (estornos não somam mais em dobro).\n'
  || E'- RDO: fotos anexadas agora aparecem no PDF e é possível excluir um RDO.\n'
  || E'- RH: visualização e edição do colaborador dentro da obra.\n'
  || E'- Relatórios da empresa: filtro por obra e comparativo Orçado x Realizado por etapa e subetapa.',
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.8.3');
