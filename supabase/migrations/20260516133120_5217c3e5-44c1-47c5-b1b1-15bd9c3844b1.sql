-- Add product photo
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ncm text;

-- Create public bucket for product photos
INSERT INTO storage.buckets (id, name, public) VALUES ('produto-fotos', 'produto-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  CREATE POLICY "produto-fotos public read" ON storage.objects FOR SELECT USING (bucket_id = 'produto-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "produto-fotos auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produto-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "produto-fotos auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'produto-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "produto-fotos auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'produto-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;