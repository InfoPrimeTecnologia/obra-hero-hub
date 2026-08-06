-- 1) Quantidade já faturada por item (saldo a faturar)
ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS qtd_faturada numeric NOT NULL DEFAULT 0;

-- 2) Saldo bancário: só INSERT/DELETE de lançamento
CREATE OR REPLACE FUNCTION public.lancamento_aplicar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := CASE WHEN NEW.tipo = 'entrada' THEN NEW.valor ELSE -NEW.valor END;
    IF NEW.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) + v_delta
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := CASE WHEN OLD.tipo = 'entrada' THEN -OLD.valor ELSE OLD.valor END;
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0) + v_delta
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lancamento_saldo ON public.lancamentos;
CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.lancamento_aplicar_saldo();

-- 3) Recalcula saldos a partir do extrato
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
        SELECT SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END)
          FROM public.lancamentos l
         WHERE l.conta_bancaria_id = cb.id
       ), 0);