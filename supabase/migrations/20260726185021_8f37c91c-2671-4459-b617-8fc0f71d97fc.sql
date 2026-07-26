ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_qtd_parcelas_check;
ALTER TABLE public.compras ADD CONSTRAINT compras_qtd_parcelas_check CHECK (qtd_parcelas IS NULL OR qtd_parcelas >= 0);