-- 1) Valor assinado: estorno NÃO zera (o contra-lançamento é que corrige)
CREATE OR REPLACE FUNCTION public.lancamento_valor_assinado(_tipo text, _valor numeric, _estornado boolean)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _tipo = 'entrada' THEN COALESCE(_valor, 0)
    ELSE -COALESCE(_valor, 0)
  END;
$$;

-- 2) Função única de saldo: só INSERT e DELETE
CREATE OR REPLACE FUNCTION public.lancamento_aplicar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0)
             + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual,0)
             - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lancamento_ajusta_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Remove QUALQUER trigger de saldo em lancamentos e recria um único
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE NOT t.tgisinternal
       AND c.relname = 'lancamentos'
       AND p.proname IN ('lancamento_aplicar_saldo','lancamento_ajusta_saldo')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.lancamentos', r.tgname);
  END LOOP;
END $$;

CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.lancamento_aplicar_saldo();

-- 4) Recalcula os saldos
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
     SELECT SUM(public.lancamento_valor_assinado(l.tipo, l.valor, l.estornado))
       FROM public.lancamentos l
      WHERE l.conta_bancaria_id = cb.id
   ), 0);

-- 5) Changelog
INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT '1.8.4', now(),
  'Correção do saldo no estorno e visual do Orçado x Realizado',
  '["Estorno de pagamento não soma mais o valor em dobro no saldo da conta","Saldos das contas bancárias recalculados a partir do saldo inicial + movimentações","Relatório Orçado x Realizado: linha da etapa destacada com cor diferente das subetapas"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.8.4');