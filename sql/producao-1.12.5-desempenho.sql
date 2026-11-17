-- Somente changelog; sem mudança de schema.
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.5', 'Sistema mais rápido',
 '[{"type":"improvement","description":"Verificação do plano em uma única consulta, lembrada entre páginas: ao voltar para o sistema não há mais espera."},{"type":"improvement","description":"Dados recentes reaproveitados por 1 minuto e telas pré-carregadas ao passar o mouse nos menus."}]'::jsonb,
 now())
ON CONFLICT (version) DO UPDATE SET highlight = EXCLUDED.highlight, items = EXCLUDED.items;
