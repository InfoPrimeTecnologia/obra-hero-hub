-- v1.12.6 — Cadastro mais curto (idempotente)
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.6', 'Cadastro mais rápido',
 '[{"type":"improvement","description":"Links /cadastro, /signup, ?aba=criar e ?tab=signup abrem direto em Criar conta."},{"type":"improvement","description":"Cadastro só com nome, e-mail e senha (mínimo 8 caracteres) e título Teste 5 dias grátis."},{"type":"improvement","description":"Aviso de cookies menor e discreto."}]'::jsonb,
 now())
ON CONFLICT (version) DO NOTHING;
