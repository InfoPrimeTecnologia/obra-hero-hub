
REVOKE EXECUTE ON FUNCTION public.parcela_to_conta_pagar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fatura_to_conta_pagar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cp_baixa_to_lancamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cr_baixa_to_lancamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transferencia_to_lancamentos() FROM PUBLIC, anon, authenticated;
