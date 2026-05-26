CREATE POLICY "Owners view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (customer_id = current_user_customer_id());

CREATE POLICY "Plans readable by authenticated" ON public.plans
  FOR SELECT TO authenticated
  USING (is_active = true);