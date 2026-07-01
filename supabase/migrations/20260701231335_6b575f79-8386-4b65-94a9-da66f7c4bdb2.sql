
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS portal_token uuid,
  ADD COLUMN IF NOT EXISTS portal_ativo boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS obras_portal_token_uidx
  ON public.obras (portal_token)
  WHERE portal_token IS NOT NULL;

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
