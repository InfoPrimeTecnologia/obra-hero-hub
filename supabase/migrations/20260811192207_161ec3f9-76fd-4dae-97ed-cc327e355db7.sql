CREATE OR REPLACE FUNCTION public.compra_cascade_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.contas_pagar WHERE compra_id = OLD.id;
  DELETE FROM public.compra_parcelas WHERE compra_id = OLD.id;
  DELETE FROM public.compra_itens WHERE compra_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_compra_cascade_delete ON public.compras;
CREATE TRIGGER trg_compra_cascade_delete
BEFORE DELETE ON public.compras
FOR EACH ROW EXECUTE FUNCTION public.compra_cascade_delete();

CREATE OR REPLACE FUNCTION public.parcela_cascade_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.contas_pagar WHERE compra_parcela_id = OLD.id AND status <> 'pago';
  IF OLD.fatura_cartao_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.compra_parcelas WHERE fatura_cartao_id = OLD.fatura_cartao_id AND id <> OLD.id
    ) THEN
      DELETE FROM public.contas_pagar WHERE fatura_cartao_id = OLD.fatura_cartao_id AND status <> 'pago';
      DELETE FROM public.faturas_cartao WHERE id = OLD.fatura_cartao_id AND status <> 'paga';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_parcela_cascade_delete ON public.compra_parcelas;
CREATE TRIGGER trg_parcela_cascade_delete
AFTER DELETE ON public.compra_parcelas
FOR EACH ROW EXECUTE FUNCTION public.parcela_cascade_delete();

DELETE FROM public.contas_pagar cp
 WHERE cp.compra_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.compras c WHERE c.id = cp.compra_id);

DELETE FROM public.contas_pagar cp
 WHERE cp.compra_parcela_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.compra_parcelas p WHERE p.id = cp.compra_parcela_id);

DELETE FROM public.contas_pagar cp
 WHERE cp.fatura_cartao_id IS NOT NULL
   AND cp.status <> 'pago'
   AND NOT EXISTS (SELECT 1 FROM public.compra_parcelas p WHERE p.fatura_cartao_id = cp.fatura_cartao_id);

DELETE FROM public.faturas_cartao f
 WHERE f.status <> 'paga'
   AND NOT EXISTS (SELECT 1 FROM public.compra_parcelas p WHERE p.fatura_cartao_id = f.id)
   AND NOT EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.fatura_cartao_id = f.id AND cp.status = 'pago');

UPDATE public.faturas_cartao f
   SET valor_total = COALESCE((SELECT SUM(p.valor) FROM public.compra_parcelas p WHERE p.fatura_cartao_id = f.id), 0);

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.8.2',
  'Fim das contas a pagar fantasma',
  '["Excluir uma compra agora remove também suas parcelas e contas a pagar","Faturas de cartão que ficaram sem compras são removidas automaticamente e podem ser excluídas na tela de Faturas","Contas ligadas a faturas inexistentes voltam a aparecer na lista da obra em vez de somarem invisíveis no dashboard","Limpeza dos registros órfãos já existentes e recálculo do total das faturas"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;