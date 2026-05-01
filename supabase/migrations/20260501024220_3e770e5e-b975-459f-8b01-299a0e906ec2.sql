-- Add owner_user_id to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_customers_owner_user_id ON public.customers(owner_user_id);

-- Update handle_new_user to also create company + company_owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_name text;
  v_cpf_cnpj text;
  v_full_name text;
  v_new_customer_id uuid;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_company_name := NULLIF(NEW.raw_user_meta_data->>'company_name', '');
  v_cpf_cnpj := NULLIF(NEW.raw_user_meta_data->>'cpf_cnpj', '');

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name);

  -- Admin allowlist check
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  -- If signup includes company info, create company and link as owner
  IF v_company_name IS NOT NULL OR v_cpf_cnpj IS NOT NULL THEN
    INSERT INTO public.customers (name, email, company_name, cpf_cnpj, owner_user_id, created_by)
    VALUES (v_full_name, NEW.email, v_company_name, v_cpf_cnpj, NEW.id, NEW.id)
    RETURNING id INTO v_new_customer_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'company_owner')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow company owners to view their own company
CREATE POLICY "Owners view own company"
ON public.customers
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Owners update own company"
ON public.customers
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());
