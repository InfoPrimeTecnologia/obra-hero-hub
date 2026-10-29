-- v1.12.1 — Assistente de IA: RDO guiado, anexos no RDO e leitura de notas fiscais
-- Sem alterações de estrutura. Apenas registra o changelog. Idempotente.
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.12.1',
  true,
  '["Assistente de IA pergunta todos os campos do RDO em roteiro numerado (data, clima, condição, equipe, atividades, ocorrências, fotos)","Fotos e arquivos enviados no chat agora são anexados ao RDO","Assistente lê notas fiscais enviadas por foto ou PDF e oferece lançar como compra ou conta a pagar"]'::jsonb,
  now()
)
ON CONFLICT (version) DO UPDATE SET highlight = EXCLUDED.highlight, items = EXCLUDED.items;
