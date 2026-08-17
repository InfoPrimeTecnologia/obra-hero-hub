-- Mestre 360 — v1.8.5 — correção definitiva do estorno e saldo

CREATE OR REPLACE FUNCTION public.lancamento_valor_assinado(
  _tipo text,
  _valor numeric,
  _estornado boolean
)
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
         SET saldo_atual = COALESCE(saldo_atual, 0)
             + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual, 0)
             - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Neutraliza a função legada caso algum ambiente ainda a possua.
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

-- Remove todo gatilho legado em lançamentos cuja função altere saldo_atual,
-- independentemente do nome dado ao gatilho/função em versões anteriores.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname = 'lancamentos'
       AND (
         p.proname IN ('lancamento_aplicar_saldo', 'lancamento_ajusta_saldo')
         OR pg_get_functiondef(p.oid) ILIKE '%saldo_atual%'
       )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.lancamentos', r.tgname);
  END LOOP;
END $$;

CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.lancamento_aplicar_saldo();

-- Corrige imediatamente qualquer saldo que já tenha ficado divergente.
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
     SELECT SUM(public.lancamento_valor_assinado(l.tipo, l.valor, l.estornado))
       FROM public.lancamentos l
      WHERE l.conta_bancaria_id = cb.id
   ), 0);

INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT
  '1.8.5',
  now(),
  'Correção definitiva do saldo após estorno',
  '["Estornos passam a devolver o valor uma única vez, sem duplicidade causada por gatilhos antigos","Gatilhos legados de saldo são removidos mesmo quando possuem nomes diferentes","Saldos bancários divergentes são recalculados automaticamente a partir do histórico completo"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_releases WHERE version = '1.8.5'
);