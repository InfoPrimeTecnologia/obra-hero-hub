
-- Drop diário antigo
DROP TABLE IF EXISTS public.obra_diario_fotos CASCADE;
DROP TABLE IF EXISTS public.obra_diarios CASCADE;

-- Funções de equipe por obra
CREATE TABLE public.funcoes_equipe_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_funcoes_obra ON public.funcoes_equipe_obra(obra_id);

-- RDO (cabeçalho)
CREATE TABLE public.rdos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  clima_manha text,
  clima_tarde text,
  clima_noite text,
  condicao text NOT NULL DEFAULT 'praticavel', -- praticavel | parcial | impraticavel
  responsavel text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, data)
);
CREATE INDEX idx_rdos_obra_data ON public.rdos(obra_id, data DESC);

-- Equipes do RDO
CREATE TABLE public.rdo_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empreiteiro text,
  funcao text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  horas numeric NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdo_equipes_rdo ON public.rdo_equipes(rdo_id);

-- Atividades do RDO
CREATE TABLE public.rdo_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.orcamento_etapas(id) ON DELETE SET NULL,
  subetapa_id uuid REFERENCES public.orcamento_subetapas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  percentual numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdo_atividades_rdo ON public.rdo_atividades(rdo_id);

-- Ocorrências do RDO
CREATE TABLE public.rdo_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro', -- atraso | acidente | visita | entrega | outro
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdo_ocorrencias_rdo ON public.rdo_ocorrencias(rdo_id);

-- Anexos do RDO (fotos e documentos)
CREATE TABLE public.rdo_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'foto', -- foto | documento
  storage_path text NOT NULL,
  legenda text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdo_anexos_rdo ON public.rdo_anexos(rdo_id);

-- Trigger updated_at em rdos
CREATE TRIGGER update_rdos_updated_at
BEFORE UPDATE ON public.rdos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.funcoes_equipe_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_anexos ENABLE ROW LEVEL SECURITY;

-- Policies (admins + owners por customer_id)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['funcoes_equipe_obra','rdos','rdo_equipes','rdo_atividades','rdo_ocorrencias','rdo_anexos']
  LOOP
    EXECUTE format('CREATE POLICY "Admins manage all %1$s" ON public.%1$s FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', t);
    EXECUTE format('CREATE POLICY "Owners manage own %1$s" ON public.%1$s FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id())', t);
  END LOOP;
END$$;
