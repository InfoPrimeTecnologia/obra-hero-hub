DROP TRIGGER IF EXISTS enforce_customer_storage_quota ON storage.objects;
DROP FUNCTION IF EXISTS public.enforce_customer_storage_quota();