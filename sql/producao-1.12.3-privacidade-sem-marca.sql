-- Somente changelog; sem mudança de schema. Executar no SQL Editor de produção.
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.3', true,
 '["Aviso de privacidade e página de política sem menção a fornecedor externo: análise passa a ser \"Análise de uso do sistema\"","Selo \"Edit with Lovable\" ocultado no site publicado"]'::jsonb,
 now())
ON CONFLICT (version) DO UPDATE SET highlight = EXCLUDED.highlight, items = EXCLUDED.items;
