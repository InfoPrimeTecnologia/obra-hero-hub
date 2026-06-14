DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND policyname = 'Owners create pending recharge invoices'
  ) THEN
    CREATE POLICY "Owners create pending recharge invoices" ON public.invoices
      FOR INSERT TO authenticated
      WITH CHECK (
        customer_id = public.current_user_customer_id()
        AND subscription_id IS NULL
        AND status = 'pending'
        AND paid_at IS NULL
      );
  END IF;
END $$;