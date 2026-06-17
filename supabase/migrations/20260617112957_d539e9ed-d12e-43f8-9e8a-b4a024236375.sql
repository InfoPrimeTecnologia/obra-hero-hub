GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tarefa_colunas TO authenticated;
GRANT ALL ON TABLE public.tarefa_colunas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tarefas TO authenticated;
GRANT ALL ON TABLE public.tarefas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tarefa_materiais TO authenticated;
GRANT ALL ON TABLE public.tarefa_materiais TO service_role;

NOTIFY pgrst, 'reload schema';