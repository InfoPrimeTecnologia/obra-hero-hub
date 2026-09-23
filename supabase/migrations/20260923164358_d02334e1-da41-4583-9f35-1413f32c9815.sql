CREATE OR REPLACE FUNCTION public.guard_customer_storage_extra_gb()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.storage_extra_gb IS DISTINCT FROM OLD.storage_extra_gb
    AND (SELECT auth.role()) IS DISTINCT FROM 'service_role'
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem alterar armazenamento adicional';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_customer_storage_extra_gb ON public.customers;
CREATE TRIGGER guard_customer_storage_extra_gb BEFORE UPDATE OF storage_extra_gb ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_storage_extra_gb();
REVOKE ALL ON FUNCTION public.guard_customer_storage_extra_gb() FROM PUBLIC, anon, authenticated;