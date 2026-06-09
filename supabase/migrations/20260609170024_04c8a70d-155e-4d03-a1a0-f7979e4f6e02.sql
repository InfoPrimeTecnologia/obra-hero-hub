
-- 1) Storage policies hardening: drop unscoped writes, add ownership-scoped policies

-- obra-fotos: drop unscoped write policies (keep ownership-scoped + public read + admin)
DROP POLICY IF EXISTS "obra-fotos auth insert" ON storage.objects;
DROP POLICY IF EXISTS "obra-fotos auth update" ON storage.objects;
DROP POLICY IF EXISTS "obra-fotos auth delete" ON storage.objects;

-- produto-fotos: drop unscoped writes and add ownership-scoped writes
DROP POLICY IF EXISTS "produto-fotos auth insert" ON storage.objects;
DROP POLICY IF EXISTS "produto-fotos auth update" ON storage.objects;
DROP POLICY IF EXISTS "produto-fotos auth delete" ON storage.objects;

CREATE POLICY "Owners upload own produto fotos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produto-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);
CREATE POLICY "Owners update own produto fotos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'produto-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);
CREATE POLICY "Owners delete own produto fotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'produto-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);

-- colaborador-fotos: drop unscoped policies, add ownership-scoped (still public bucket for reads)
DROP POLICY IF EXISTS "Auth upload colab fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update colab fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete colab fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth read colab fotos" ON storage.objects;

CREATE POLICY "Public read colab fotos" ON storage.objects FOR SELECT
  USING (bucket_id = 'colaborador-fotos');
CREATE POLICY "Owners upload own colab fotos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'colaborador-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);
CREATE POLICY "Owners update own colab fotos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'colaborador-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);
CREATE POLICY "Owners delete own colab fotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'colaborador-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);

-- 2) Tickets / ticket_messages / communications_log: scoped customer policies
CREATE POLICY "Customers read own tickets" ON public.tickets FOR SELECT TO authenticated
  USING (customer_id = public.current_user_customer_id());
CREATE POLICY "Customers create own tickets" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.current_user_customer_id());
CREATE POLICY "Customers update own tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (customer_id = public.current_user_customer_id())
  WITH CHECK (customer_id = public.current_user_customer_id());

CREATE POLICY "Customers read own ticket messages" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_messages.ticket_id AND t.customer_id = public.current_user_customer_id()));
CREATE POLICY "Customers create messages on own tickets" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_messages.ticket_id AND t.customer_id = public.current_user_customer_id()));

CREATE POLICY "Customers read own communications" ON public.communications_log FOR SELECT TO authenticated
  USING (customer_id = public.current_user_customer_id());

-- 3) Ensure one customer per owner to make current_user_customer_id deterministic
ALTER TABLE public.customers ADD CONSTRAINT customers_owner_user_id_key UNIQUE (owner_user_id);

-- 4) Lock down auth_email_tokens explicitly (deny-all to clients; service_role bypasses RLS)
CREATE POLICY "Service role only" ON public.auth_email_tokens FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- 5) Fix mutable search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 6) Revoke EXECUTE on internal SECURITY DEFINER trigger/maintenance functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parcela_cartao_assign_fatura() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_fatura_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parcela_to_conta_pagar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fatura_to_conta_pagar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cp_baixa_to_lancamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cr_baixa_to_lancamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transferencia_to_lancamentos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recebimento_to_estoque() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aplicar_movimentacao_estoque() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_etapa_planejamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calcular_competencia_fatura(date, integer, integer) FROM PUBLIC, anon, authenticated;
