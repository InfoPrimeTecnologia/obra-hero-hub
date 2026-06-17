-- =========================================================
-- 1) Planos: limite de usuários
-- =========================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_usuarios integer NOT NULL DEFAULT 1;

-- =========================================================
-- 2) Membros da empresa (multi-usuário por customer)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.customer_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'member',   -- 'admin' | 'member'
  status text NOT NULL DEFAULT 'ativo',  -- 'ativo' | 'suspenso'
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  can_access_all_obras boolean NOT NULL DEFAULT true,
  allowed_obras uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_members TO authenticated;
GRANT ALL ON public.customer_members TO service_role;
ALTER TABLE public.customer_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner gerencia membros" ON public.customer_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c
                 WHERE c.id = customer_members.customer_id AND c.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = customer_members.customer_id AND c.owner_user_id = auth.uid()));

CREATE POLICY "Membro ve a propria associacao" ON public.customer_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- 3) Convites por e-mail
-- =========================================================
CREATE TABLE IF NOT EXISTS public.customer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  can_access_all_obras boolean NOT NULL DEFAULT true,
  allowed_obras uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invites TO authenticated;
GRANT ALL ON public.customer_invites TO service_role;
ALTER TABLE public.customer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner gerencia convites" ON public.customer_invites
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c
                 WHERE c.id = customer_invites.customer_id AND c.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = customer_invites.customer_id AND c.owner_user_id = auth.uid()));

-- =========================================================
-- 4) Atualiza current_user_customer_id() para reconhecer membros
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_user_customer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM (
    SELECT id, 0 AS prio FROM public.customers WHERE owner_user_id = auth.uid()
    UNION ALL
    SELECT customer_id AS id, 1 AS prio FROM public.customer_members
      WHERE user_id = auth.uid() AND status = 'ativo'
  ) t
  ORDER BY prio
  LIMIT 1;
$function$;

-- Helper: usuário tem acesso à empresa (owner ou membro ativo)
CREATE OR REPLACE FUNCTION public.user_has_customer_access(_user uuid, _cust uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = _cust AND owner_user_id = _user)
      OR EXISTS(SELECT 1 FROM public.customer_members
                WHERE customer_id = _cust AND user_id = _user AND status = 'ativo');
$function$;

-- =========================================================
-- 5) Kanban - colunas
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tarefa_colunas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor text DEFAULT '#94a3b8',
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_colunas TO authenticated;
GRANT ALL ON public.tarefa_colunas TO service_role;
ALTER TABLE public.tarefa_colunas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa acessa colunas" ON public.tarefa_colunas
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_tarefa_colunas_cust_obra
  ON public.tarefa_colunas(customer_id, obra_id, ordem);

-- =========================================================
-- 6) Tarefas
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  etapa_id uuid REFERENCES public.orcamento_etapas(id) ON DELETE SET NULL,
  subetapa_id uuid REFERENCES public.orcamento_subetapas(id) ON DELETE SET NULL,
  coluna_id uuid REFERENCES public.tarefa_colunas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  responsavel_colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  responsavel_user_id uuid,
  prioridade text NOT NULL DEFAULT 'media',  -- baixa | media | alta | urgente
  prazo date,
  ordem integer NOT NULL DEFAULT 0,
  concluida_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa acessa tarefas" ON public.tarefas
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_tarefas_customer ON public.tarefas(customer_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_obra ON public.tarefas(obra_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_coluna ON public.tarefas(coluna_id, ordem);

-- =========================================================
-- 7) Materiais vinculados à tarefa
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tarefa_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade numeric(14,3) NOT NULL DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_materiais TO authenticated;
GRANT ALL ON public.tarefa_materiais TO service_role;
ALTER TABLE public.tarefa_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa acessa materiais tarefa" ON public.tarefa_materiais
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_tarefa_materiais_tarefa ON public.tarefa_materiais(tarefa_id);

-- =========================================================
-- 8) Agenda - eventos
-- =========================================================
CREATE TABLE IF NOT EXISTS public.eventos_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  local text,
  cor text DEFAULT '#3b82f6',
  dia_inteiro boolean NOT NULL DEFAULT false,
  dt_inicio timestamptz NOT NULL,
  dt_fim timestamptz NOT NULL,
  lembrete_minutos integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_agenda TO authenticated;
GRANT ALL ON public.eventos_agenda TO service_role;
ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa acessa eventos" ON public.eventos_agenda
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_eventos_customer_dt
  ON public.eventos_agenda(customer_id, dt_inicio);

-- =========================================================
-- 9) Triggers updated_at
-- =========================================================
DROP TRIGGER IF EXISTS trg_customer_members_updated ON public.customer_members;
CREATE TRIGGER trg_customer_members_updated BEFORE UPDATE ON public.customer_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tarefa_colunas_updated ON public.tarefa_colunas;
CREATE TRIGGER trg_tarefa_colunas_updated BEFORE UPDATE ON public.tarefa_colunas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tarefas_updated ON public.tarefas;
CREATE TRIGGER trg_tarefas_updated BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_eventos_agenda_updated ON public.eventos_agenda;
CREATE TRIGGER trg_eventos_agenda_updated BEFORE UPDATE ON public.eventos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
