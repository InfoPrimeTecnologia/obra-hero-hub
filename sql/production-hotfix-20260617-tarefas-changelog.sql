-- Hotfix produção - Tarefas/Agenda/Changelog
-- Execute este arquivo no banco usado por https://app.mestre360.com.br.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_usuarios integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.customer_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'ativo',
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

DROP POLICY IF EXISTS "Owner gerencia membros" ON public.customer_members;
CREATE POLICY "Owner gerencia membros" ON public.customer_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c
                 WHERE c.id = customer_members.customer_id AND c.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = customer_members.customer_id AND c.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Membro ve a propria associacao" ON public.customer_members;
CREATE POLICY "Membro ve a propria associacao" ON public.customer_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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

DROP POLICY IF EXISTS "Owner gerencia convites" ON public.customer_invites;
CREATE POLICY "Owner gerencia convites" ON public.customer_invites
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c
                 WHERE c.id = customer_invites.customer_id AND c.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = customer_invites.customer_id AND c.owner_user_id = auth.uid()));

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

DROP POLICY IF EXISTS "Empresa acessa colunas" ON public.tarefa_colunas;
CREATE POLICY "Empresa acessa colunas" ON public.tarefa_colunas
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_tarefa_colunas_cust_obra
  ON public.tarefa_colunas(customer_id, obra_id, ordem);

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
  prioridade text NOT NULL DEFAULT 'media',
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

DROP POLICY IF EXISTS "Empresa acessa tarefas" ON public.tarefas;
CREATE POLICY "Empresa acessa tarefas" ON public.tarefas
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_tarefas_customer ON public.tarefas(customer_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_obra ON public.tarefas(obra_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_coluna ON public.tarefas(coluna_id, ordem);

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

DROP POLICY IF EXISTS "Empresa acessa materiais tarefa" ON public.tarefa_materiais;
CREATE POLICY "Empresa acessa materiais tarefa" ON public.tarefa_materiais
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_tarefa_materiais_tarefa ON public.tarefa_materiais(tarefa_id);

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

DROP POLICY IF EXISTS "Empresa acessa eventos" ON public.eventos_agenda;
CREATE POLICY "Empresa acessa eventos" ON public.eventos_agenda
  FOR ALL TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id))
  WITH CHECK (public.user_has_customer_access(auth.uid(), customer_id));

CREATE INDEX IF NOT EXISTS idx_eventos_customer_dt
  ON public.eventos_agenda(customer_id, dt_inicio);

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

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES
  ('1.0.12', 'Tarefas Kanban, Agenda, Usuários & permissões granulares',
   '[{"type":"feature","description":"Novo módulo Tarefas com quadro Kanban, colunas personalizadas e materiais vinculados"},{"type":"feature","description":"Novo módulo Agenda com eventos por empresa, obra e tarefa"},{"type":"feature","description":"Usuários da empresa com permissões granulares por módulo e obra"},{"type":"improvement","description":"Planos agora controlam módulos, recursos e limite de usuários"}]'::jsonb,
   '2026-06-17 10:34:21.386997+00'),
  ('1.0.13', 'Correção do módulo Tarefas',
   '[{"type":"bug","description":"Corrigida a criação de colunas no módulo Tarefas após sincronização de permissões e recarregamento do cache do backend"},{"type":"bug","description":"Corrigida a atribuição de planos com ciclo anual"},{"type":"improvement","description":"Novos módulos Tarefas e Agenda aparecem na seleção de módulos dos planos"}]'::jsonb,
   '2026-06-17 12:22:09.727717+00')
ON CONFLICT (version) DO UPDATE SET
  highlight = EXCLUDED.highlight,
  items = EXCLUDED.items,
  released_at = EXCLUDED.released_at,
  updated_at = now();

NOTIFY pgrst, 'reload schema';