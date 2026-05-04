-- ============= FORNECEDORES =============
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  nome text NOT NULL,
  cpf_cnpj text,
  email text,
  telefone text,
  contato text,
  endereco text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own fornecedores" ON public.fornecedores
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all fornecedores" ON public.fornecedores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= CARTOES =============
CREATE TABLE public.cartoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  bandeira text,
  ultimos_4 text,
  limite numeric NOT NULL DEFAULT 0,
  dia_fechamento integer NOT NULL DEFAULT 1 CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento integer NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own cartoes" ON public.cartoes
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all cartoes" ON public.cartoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_cartoes_updated BEFORE UPDATE ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= FATURAS CARTAO =============
CREATE TABLE public.faturas_cartao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  cartao_id uuid NOT NULL,
  competencia text NOT NULL, -- formato YYYY-MM
  dt_fechamento date NOT NULL,
  dt_vencimento date NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta', -- aberta, fechada, paga
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cartao_id, competencia)
);
ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own faturas_cartao" ON public.faturas_cartao
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all faturas_cartao" ON public.faturas_cartao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_faturas_cartao_updated BEFORE UPDATE ON public.faturas_cartao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= COMPRAS =============
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  fornecedor_id uuid,
  numero text,
  descricao text,
  forma_pagamento text NOT NULL DEFAULT 'dinheiro', -- dinheiro, pix, boleto, cartao, transferencia
  cartao_id uuid,
  qtd_parcelas integer NOT NULL DEFAULT 1 CHECK (qtd_parcelas >= 1),
  valor_total numeric NOT NULL DEFAULT 0,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  data_primeira_parcela date,
  status text NOT NULL DEFAULT 'aberta', -- aberta, recebida, cancelada
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own compras" ON public.compras
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all compras" ON public.compras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_compras_updated BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= COMPRA_ITENS =============
CREATE TABLE public.compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  compra_id uuid NOT NULL,
  etapa_id uuid,
  subetapa_id uuid,
  descricao text NOT NULL,
  unidade text,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  qtd_recebida numeric NOT NULL DEFAULT 0,
  qtd_medida numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own compra_itens" ON public.compra_itens
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all compra_itens" ON public.compra_itens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============= COMPRA_PARCELAS =============
CREATE TABLE public.compra_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  compra_id uuid NOT NULL,
  numero integer NOT NULL,
  vencimento date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente', -- pendente, pago
  pago_em timestamptz,
  fatura_cartao_id uuid, -- se cartão, vincula à fatura
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compra_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own compra_parcelas" ON public.compra_parcelas
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all compra_parcelas" ON public.compra_parcelas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_compra_parcelas_updated BEFORE UPDATE ON public.compra_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= RECEBIMENTOS =============
CREATE TABLE public.recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  compra_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  recebido_por text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own recebimentos" ON public.recebimentos
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all recebimentos" ON public.recebimentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.recebimento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  recebimento_id uuid NOT NULL,
  compra_item_id uuid NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recebimento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own recebimento_itens" ON public.recebimento_itens
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all recebimento_itens" ON public.recebimento_itens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============= MEDICOES =============
CREATE TABLE public.medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  compra_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 1,
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own medicoes" ON public.medicoes
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all medicoes" ON public.medicoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_medicoes_updated BEFORE UPDATE ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.medicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  medicao_id uuid NOT NULL,
  compra_item_id uuid NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own medicao_itens" ON public.medicao_itens
  FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id())
  WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all medicao_itens" ON public.medicao_itens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Indices úteis
CREATE INDEX idx_compras_obra ON public.compras(obra_id);
CREATE INDEX idx_compras_fornecedor ON public.compras(fornecedor_id);
CREATE INDEX idx_compra_itens_compra ON public.compra_itens(compra_id);
CREATE INDEX idx_compra_itens_etapa ON public.compra_itens(etapa_id);
CREATE INDEX idx_compra_parcelas_compra ON public.compra_parcelas(compra_id);
CREATE INDEX idx_compra_parcelas_fatura ON public.compra_parcelas(fatura_cartao_id);
CREATE INDEX idx_faturas_cartao_cartao ON public.faturas_cartao(cartao_id);
CREATE INDEX idx_recebimentos_compra ON public.recebimentos(compra_id);
CREATE INDEX idx_medicoes_compra ON public.medicoes(compra_id);