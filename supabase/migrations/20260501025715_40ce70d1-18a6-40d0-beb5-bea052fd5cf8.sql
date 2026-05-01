-- Helper: obtem customer_id (empresa) do usuario logado
CREATE OR REPLACE FUNCTION public.current_user_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE owner_user_id = auth.uid() LIMIT 1;
$$;

-- Tabela obras
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  contact_name text,
  contact_email text,
  contact_whatsapp text,
  start_date date,
  expected_end_date date,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all obras" ON public.obras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own obras" ON public.obras
  FOR ALL TO authenticated
  USING (customer_id = public.current_user_customer_id())
  WITH CHECK (customer_id = public.current_user_customer_id());

CREATE TRIGGER obras_updated_at BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela diarios
CREATE TABLE public.obra_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  diary_date date NOT NULL DEFAULT CURRENT_DATE,
  weather text,
  activities text,
  workforce text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obra_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all diarios" ON public.obra_diarios
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own diarios" ON public.obra_diarios
  FOR ALL TO authenticated
  USING (customer_id = public.current_user_customer_id())
  WITH CHECK (customer_id = public.current_user_customer_id());

CREATE TRIGGER obra_diarios_updated_at BEFORE UPDATE ON public.obra_diarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela fotos
CREATE TABLE public.obra_diario_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_id uuid NOT NULL REFERENCES public.obra_diarios(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obra_diario_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all fotos" ON public.obra_diario_fotos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own fotos" ON public.obra_diario_fotos
  FOR ALL TO authenticated
  USING (customer_id = public.current_user_customer_id())
  WITH CHECK (customer_id = public.current_user_customer_id());

-- Storage bucket privado para fotos
INSERT INTO storage.buckets (id, name, public) VALUES ('obra-fotos', 'obra-fotos', false)
  ON CONFLICT (id) DO NOTHING;

-- Convencao de path: {customer_id}/{obra_id}/{diario_id}/{filename}
CREATE POLICY "Owners read own obra fotos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'obra-fotos'
    AND (storage.foldername(name))[1] = public.current_user_customer_id()::text
  );

CREATE POLICY "Owners upload own obra fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'obra-fotos'
    AND (storage.foldername(name))[1] = public.current_user_customer_id()::text
  );

CREATE POLICY "Owners delete own obra fotos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'obra-fotos'
    AND (storage.foldername(name))[1] = public.current_user_customer_id()::text
  );

CREATE POLICY "Admins all obra fotos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'obra-fotos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'obra-fotos' AND has_role(auth.uid(), 'admin'::app_role));