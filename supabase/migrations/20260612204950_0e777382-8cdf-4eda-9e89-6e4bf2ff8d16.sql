GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_packages TO authenticated;
GRANT ALL ON public.credit_packages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_action_costs TO authenticated;
GRANT ALL ON public.credit_action_costs TO service_role;