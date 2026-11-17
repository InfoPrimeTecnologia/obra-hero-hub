-- Aplicar no SQL Editor de produção junto com a publicação do código 1.12.4.
-- Idempotente: preserva as demais policies e não altera dados de clientes.
ALTER POLICY "Authenticated can read action costs"
ON public.credit_action_costs TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

ALTER POLICY "Qualquer usuário autenticado pode ler releases"
ON public.app_releases TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.4', 'Proteção das informações internas',
  '[{"type":"improvement","description":"Leitura dos custos internos de IA e registros de versões restrita à administração; cobrança de créditos preservada no servidor."}]'::jsonb,
  now())
ON CONFLICT (version) DO UPDATE
SET highlight = EXCLUDED.highlight, items = EXCLUDED.items;