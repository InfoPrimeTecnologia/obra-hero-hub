CREATE TABLE public.app_releases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL UNIQUE,
  released_at timestamptz NOT NULL DEFAULT now(),
  highlight text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_releases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer usuário autenticado pode ler releases"
  ON public.app_releases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas admins inserem releases"
  ON public.app_releases FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins atualizam releases"
  ON public.app_releases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins removem releases"
  ON public.app_releases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_releases_updated_at
  BEFORE UPDATE ON public.app_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_releases (version, highlight, items) VALUES
('1.0.0', 'Lançamento inicial do Mestre 360',
  '[
    {"type":"feature","description":"Gestão de obras, RDO, orçamento e compras"},
    {"type":"feature","description":"Módulo financeiro: contas a pagar/receber, fluxo de caixa, conciliação"},
    {"type":"feature","description":"Estoque com almoxarifados, saldos e requisições"},
    {"type":"feature","description":"RH com cadastro de colaboradores"},
    {"type":"feature","description":"Assinatura via Asaas com períodos mensal, semestral (-5%) e anual (-10%)"},
    {"type":"feature","description":"Painel Super Admin para empresas, planos, faturas e tickets"}
  ]'::jsonb);