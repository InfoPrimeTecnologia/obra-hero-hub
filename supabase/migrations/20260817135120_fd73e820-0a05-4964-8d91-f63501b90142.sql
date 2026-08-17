REVOKE ALL ON FUNCTION public.estornar_lancamento(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estornar_lancamento(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO service_role;