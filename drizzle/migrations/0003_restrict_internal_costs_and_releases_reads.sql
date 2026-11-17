ALTER POLICY "Authenticated can read action costs"
ON public.credit_action_costs TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

ALTER POLICY "Qualquer usuário autenticado pode ler releases"
ON public.app_releases TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));