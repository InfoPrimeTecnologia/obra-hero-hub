GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

DROP POLICY IF EXISTS "Owners create own company" ON public.customers;

CREATE POLICY "Owners create own company" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;