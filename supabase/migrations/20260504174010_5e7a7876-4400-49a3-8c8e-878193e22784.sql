-- =========================================
-- EMPRESAS (do cliente do Mestre 360)
-- =========================================
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  nome text NOT NULL,
  cnpj text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_empresas_customer ON public.empresas(customer_id);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all empresas"
  ON public.empresas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own empresas"
  ON public.empresas FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());

CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- OBRAS: vincular a empresa
-- =========================================
ALTER TABLE public.obras
  ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE INDEX idx_obras_empresa ON public.obras(empresa_id);

-- =========================================
-- ORÇAMENTO: ETAPAS (com planejamento)
-- =========================================
CREATE TABLE public.orcamento_etapas (
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

CREATE INDEX idx_etapas_obra ON public.orcamento_etapas(obra_id, ordem);
CREATE INDEX idx_etapas_customer ON public.orcamento_etapas(customer_id);

ALTER TABLE public.orcamento_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all etapas"
  ON public.orcamento_etapas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own etapas"
  ON public.orcamento_etapas FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());

CREATE TRIGGER update_etapas_updated_at
  BEFORE UPDATE ON public.orcamento_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de validação de planejamento
CREATE OR REPLACE FUNCTION public.validate_etapa_planejamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se data fim real foi preenchida, percentual = 100
  IF NEW.dt_fim_real IS NOT NULL THEN
    NEW.percentual := 100;
  END IF;

  -- Percentual entre 0 e 100
  IF NEW.percentual < 0 OR NEW.percentual > 100 THEN
    RAISE EXCEPTION 'Percentual deve estar entre 0 e 100';
  END IF;

  -- Data fim prevista não pode ser antes da início prevista
  IF NEW.dt_inicio_prevista IS NOT NULL
     AND NEW.dt_fim_prevista IS NOT NULL
     AND NEW.dt_fim_prevista < NEW.dt_inicio_prevista THEN
    RAISE EXCEPTION 'Data fim prevista não pode ser anterior à data início prevista';
  END IF;

  -- Mesma regra para datas reais
  IF NEW.dt_inicio_real IS NOT NULL
     AND NEW.dt_fim_real IS NOT NULL
     AND NEW.dt_fim_real < NEW.dt_inicio_real THEN
    RAISE EXCEPTION 'Data fim real não pode ser anterior à data início real';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_etapa_planejamento_trigger
  BEFORE INSERT OR UPDATE ON public.orcamento_etapas
  FOR EACH ROW EXECUTE FUNCTION public.validate_etapa_planejamento();

-- =========================================
-- ORÇAMENTO: SUBETAPAS
-- =========================================
CREATE TABLE public.orcamento_subetapas (
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

CREATE INDEX idx_subetapas_etapa ON public.orcamento_subetapas(etapa_id, ordem);
CREATE INDEX idx_subetapas_customer ON public.orcamento_subetapas(customer_id);

ALTER TABLE public.orcamento_subetapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all subetapas"
  ON public.orcamento_subetapas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage own subetapas"
  ON public.orcamento_subetapas FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());

CREATE TRIGGER update_subetapas_updated_at
  BEFORE UPDATE ON public.orcamento_subetapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();