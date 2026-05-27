
-- 1. Foto da obra
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS foto_url text;

-- 2. Tornar bucket obra-fotos público
UPDATE storage.buckets SET public = true WHERE id = 'obra-fotos';

-- 3. Políticas storage para obra-fotos (idempotente)
DROP POLICY IF EXISTS "obra-fotos public read" ON storage.objects;
CREATE POLICY "obra-fotos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'obra-fotos');

DROP POLICY IF EXISTS "obra-fotos auth insert" ON storage.objects;
CREATE POLICY "obra-fotos auth insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'obra-fotos');

DROP POLICY IF EXISTS "obra-fotos auth update" ON storage.objects;
CREATE POLICY "obra-fotos auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'obra-fotos');

DROP POLICY IF EXISTS "obra-fotos auth delete" ON storage.objects;
CREATE POLICY "obra-fotos auth delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'obra-fotos');
