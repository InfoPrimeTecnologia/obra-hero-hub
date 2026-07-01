-- =====================================================================
-- MESTRE 360 — v1.4.0 (Fase 2 · Sprint 3)
-- Portal do cliente: link público read-only por obra
--
-- Rodar no SQL Editor do Supabase de PRODUÇÃO (idempotente — pode ser
-- executado múltiplas vezes sem efeitos colaterais).
--
-- Observações de segurança:
--  - Não são criadas policies TO anon. A leitura pública é feita por uma
--    server function (createServerFn) que valida o token e usa a service
--    role — o banco continua totalmente protegido por RLS.
-- =====================================================================

-- 1) Colunas de controle do portal na obra
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS portal_token uuid,
  ADD COLUMN IF NOT EXISTS portal_ativo boolean NOT NULL DEFAULT false;

-- 2) Índice único do token (só quando presente)
CREATE UNIQUE INDEX IF NOT EXISTS obras_portal_token_uidx
  ON public.obras (portal_token)
  WHERE portal_token IS NOT NULL;

-- 3) Registro no changelog (app_releases)
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.4.0',
  'Portal do cliente: link público read-only por obra',
  '[
    {"tipo":"novo","texto":"Portal do cliente: gere um link público por obra para compartilhar avanço físico, cronograma, últimos RDOs e medições sem exigir login"},
    {"tipo":"novo","texto":"Botão de ativar/desativar portal e copiar link na tela da obra"},
    {"tipo":"novo","texto":"Rotação de token: ao reativar, um novo link é gerado e o anterior deixa de funcionar"}
  ]'::jsonb,
  now()
)
ON CONFLICT DO NOTHING;
