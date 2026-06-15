CREATE POLICY "Owners create own company" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());