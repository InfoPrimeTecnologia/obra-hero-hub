INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.7', 'Tag do Google Ads no cadastro',
 '[{"type":"improvement","description":"Tag do Google Ads com conversão Inscrição após criar conta, respeitando o aviso de cookies."}]'::jsonb, now())
ON CONFLICT (version) DO NOTHING;
