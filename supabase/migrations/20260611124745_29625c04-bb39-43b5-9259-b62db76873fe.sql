
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS pix_tipo text,
  ADD COLUMN IF NOT EXISTS pix_chave text;

ALTER TABLE public.fornecedores
  DROP CONSTRAINT IF EXISTS fornecedores_pix_tipo_check;

ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_pix_tipo_check
  CHECK (pix_tipo IS NULL OR pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria'));
