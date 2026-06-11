
-- =========================================================
-- credit_packages
-- =========================================================
CREATE TABLE public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_brl numeric(12,2) NOT NULL CHECK (valor_brl >= 0),
  creditos integer NOT NULL CHECK (creditos > 0),
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packages TO authenticated;
GRANT ALL ON public.credit_packages TO service_role;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read packages" ON public.credit_packages
  FOR SELECT TO authenticated USING (ativo = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage packages" ON public.credit_packages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER credit_packages_updated_at
  BEFORE UPDATE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- credit_action_costs
-- =========================================================
CREATE TABLE public.credit_action_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  descricao text NOT NULL,
  custo integer NOT NULL CHECK (custo >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_action_costs TO authenticated;
GRANT ALL ON public.credit_action_costs TO service_role;
ALTER TABLE public.credit_action_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read action costs" ON public.credit_action_costs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage action costs" ON public.credit_action_costs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER credit_action_costs_updated_at
  BEFORE UPDATE ON public.credit_action_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- customer_credits (saldo por empresa)
-- =========================================================
CREATE TABLE public.customer_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  saldo integer NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_credits TO authenticated;
GRANT ALL ON public.customer_credits TO service_role;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own credits" ON public.customer_credits
  FOR SELECT TO authenticated
  USING (customer_id = current_user_customer_id() OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER customer_credits_updated_at
  BEFORE UPDATE ON public.customer_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- credit_transactions (extrato)
-- =========================================================
CREATE TYPE public.credit_tx_type AS ENUM ('recarga','consumo','ajuste','estorno');

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tipo public.credit_tx_type NOT NULL,
  delta integer NOT NULL,
  saldo_apos integer NOT NULL,
  action_key text,
  descricao text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_tx_customer ON public.credit_transactions(customer_id, created_at DESC);
CREATE UNIQUE INDEX idx_credit_tx_invoice_recarga
  ON public.credit_transactions(invoice_id)
  WHERE tipo = 'recarga';
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own credit tx" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (customer_id = current_user_customer_id() OR has_role(auth.uid(), 'admin'));

-- =========================================================
-- Seed: pacotes default
-- =========================================================
INSERT INTO public.credit_packages (nome, valor_brl, creditos, destaque, ordem) VALUES
  ('Pacote Inicial',  29.90,  100, false, 1),
  ('Pacote Bronze',   59.90,  250, false, 2),
  ('Pacote Prata',   119.90,  600, true,  3),
  ('Pacote Ouro',    249.90, 1500, false, 4),
  ('Pacote Diamante',499.90, 3500, false, 5);

-- =========================================================
-- Seed: custos default por ação
-- =========================================================
INSERT INTO public.credit_action_costs (action_key, descricao, custo) VALUES
  ('chat_message',        'Resposta de texto do assistente', 1),
  ('transcribe_audio',    'Transcrição de áudio (voz)', 2),
  ('create_etapa',        'Criar etapa de orçamento', 2),
  ('create_subetapa',     'Criar subetapa de orçamento', 2),
  ('create_rdo',          'Criar Diário de Obra (RDO)', 5),
  ('create_compra',       'Registrar compra', 8),
  ('create_conta_pagar',  'Criar conta a pagar', 5),
  ('create_conta_receber','Criar conta a receber', 5);
