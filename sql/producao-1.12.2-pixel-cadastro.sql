-- Somente changelog; sem mudança de schema. Executar no SQL Editor de produção.
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.2', true,
 '["Pixel Meta para medir criação bem-sucedida de novas contas (CompleteRegistration)","Consentimento separado para análise e publicidade, com aviso regional e opção de retirada","Publicidade sem envio de nome, e-mail, CPF/CNPJ ou dados internos de obras"]'::jsonb,
 now())
ON CONFLICT (version) DO UPDATE SET highlight = EXCLUDED.highlight, items = EXCLUDED.items;