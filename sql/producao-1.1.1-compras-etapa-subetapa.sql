-- =========================================================
-- PRODUÇÃO v1.1.1 – Compras vinculadas a Etapa / Subetapa
-- Rodar no SQL Editor do Supabase de produção.
-- Idempotente: pode ser executado múltiplas vezes.
-- =========================================================

-- ----------------------------------------------------------
-- 1) Etapas do orçamento
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  dt_inicio_prevista date,
  dt_fim_prevista date,
  dt_inicio_real date,
  dt_fim_real date,
  percentual numeric(5,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etapas_obra ON public.orcamento_etapas(obra_id, ordem);
CREATE INDEX IF NOT EXISTS idx_etapas_customer ON public.orcamento_etapas(customer_id);

ALTER TABLE public.orcamento_etapas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orcamento_etapas' AND policyname = 'Admins manage all etapas'
  ) THEN
    CREATE POLICY "Admins manage all etapas" ON public.orcamento_etapas
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orcamento_etapas' AND policyname = 'Owners manage own etapas'
  ) THEN
    CREATE POLICY "Owners manage own etapas" ON public.orcamento_etapas
      FOR ALL TO authenticated
      USING (customer_id = current_user_customer_id())
      WITH CHECK (customer_id = current_user_customer_id());
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_etapas TO authenticated;
GRANT ALL ON public.orcamento_etapas TO service_role;

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_etapas_updated_at ON public.orcamento_etapas;
CREATE TRIGGER update_etapas_updated_at
  BEFORE UPDATE ON public.orcamento_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger validação de planejamento
CREATE OR REPLACE FUNCTION public.validate_etapa_planejamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dt_fim_real IS NOT NULL THEN
    NEW.percentual := 100;
  END IF;
  IF NEW.percentual < 0 OR NEW.percentual > 100 THEN
    RAISE EXCEPTION 'Percentual deve estar entre 0 e 100';
  END IF;
  IF NEW.dt_inicio_prevista IS NOT NULL AND NEW.dt_fim_prevista IS NOT NULL AND NEW.dt_fim_prevista < NEW.dt_inicio_prevista THEN
    RAISE EXCEPTION 'Data fim prevista não pode ser anterior à data início prevista';
  END IF;
  IF NEW.dt_inicio_real IS NOT NULL AND NEW.dt_fim_real IS NOT NULL AND NEW.dt_fim_real < NEW.dt_inicio_real THEN
    RAISE EXCEPTION 'Data fim real não pode ser anterior à data início real';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_etapa_planejamento_trigger ON public.orcamento_etapas;
CREATE TRIGGER validate_etapa_planejamento_trigger
  BEFORE INSERT OR UPDATE ON public.orcamento_etapas
  FOR EACH ROW EXECUTE FUNCTION public.validate_etapa_planejamento();

-- ----------------------------------------------------------
-- 2) Subetapas do orçamento
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_subetapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  etapa_id uuid NOT NULL REFERENCES public.orcamento_etapas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  valor_orcado numeric(14,2) NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subetapas_etapa ON public.orcamento_subetapas(etapa_id, ordem);
CREATE INDEX IF NOT EXISTS idx_subetapas_customer ON public.orcamento_subetapas(customer_id);

ALTER TABLE public.orcamento_subetapas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orcamento_subetapas' AND policyname = 'Admins manage all subetapas'
  ) THEN
    CREATE POLICY "Admins manage all subetapas" ON public.orcamento_subetapas
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orcamento_subetapas' AND policyname = 'Owners manage own subetapas'
  ) THEN
    CREATE POLICY "Owners manage own subetapas" ON public.orcamento_subetapas
      FOR ALL TO authenticated
      USING (customer_id = current_user_customer_id())
      WITH CHECK (customer_id = current_user_customer_id());
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_subetapas TO authenticated;
GRANT ALL ON public.orcamento_subetapas TO service_role;

DROP TRIGGER IF EXISTS update_subetapas_updated_at ON public.orcamento_subetapas;
CREATE TRIGGER update_subetapas_updated_at
  BEFORE UPDATE ON public.orcamento_subetapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------
-- 3) Vincular compras a etapa/subetapa
-- ----------------------------------------------------------
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.orcamento_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subetapa_id uuid REFERENCES public.orcamento_subetapas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_compras_etapa_id ON public.compras(etapa_id);
CREATE INDEX IF NOT EXISTS idx_compras_subetapa_id ON public.compras(subetapa_id);

-- Garante grants na tabela compras (caso ainda não tenha)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
