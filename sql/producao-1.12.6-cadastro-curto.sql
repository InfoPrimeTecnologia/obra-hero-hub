-- v1.12.6 — Cadastro mais curto e link direto para "Criar conta" (idempotente)
INSERT INTO public.app_releases (version, title, description)
SELECT '1.12.6', 'Cadastro mais rápido',
 'Links /cadastro, /signup, ?aba=criar e ?tab=signup abrem direto em "Criar conta"; formulário com apenas nome, e-mail e senha (mín. 8 caracteres); título "Teste 5 dias grátis"; aviso de cookies compacto.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.12.6');
