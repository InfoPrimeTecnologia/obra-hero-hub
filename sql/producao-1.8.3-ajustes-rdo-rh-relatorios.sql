-- Mestre 360 — v1.8.3 (idempotente)
-- Ajustes de RDO (excluir RDO + fotos no PDF), RH na obra (ver/editar colaborador),
-- relatórios da empresa (filtro por obra + subetapas) e financeiro segregado obra/empresa.
-- Não há alteração de schema: apenas o registro no changelog.

INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT
  '1.8.3',
  now(),
  'Ajustes de RDO, RH e relatórios',
  '["Financeiro: contas e faturas de obra são pagas somente na obra; a empresa apenas visualiza, com filtro por obra.","Correção do saldo em caixa e bancos (estornos não somam mais em dobro).","RDO: fotos anexadas agora aparecem no PDF e é possível excluir um RDO.","RH: visualização e edição do colaborador dentro da obra.","Relatórios da empresa: filtro por obra e comparativo Orçado x Realizado por etapa e subetapa."]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.8.3');
