
REVOKE EXECUTE ON FUNCTION public.aplicar_movimentacao_estoque() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recebimento_to_estoque() FROM PUBLIC, anon, authenticated;

-- Restringe listagem do bucket: apenas autenticados podem listar/baixar via API.
-- Bucket continua público apenas para acesso direto via URL pública (CDN).
DROP POLICY IF EXISTS "Public read colab fotos" ON storage.objects;
CREATE POLICY "Auth read colab fotos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'colaborador-fotos');
