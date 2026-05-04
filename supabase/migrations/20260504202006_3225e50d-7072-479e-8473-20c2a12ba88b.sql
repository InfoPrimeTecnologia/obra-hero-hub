
-- ============ CONTAS BANCÁRIAS ============
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  banco text,
  agencia text,
  conta text,
  tipo text NOT NULL DEFAULT 'corrente',
  saldo_inicial numeric NOT NULL DEFAULT 0,
  saldo_atual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own contas_bancarias" ON public.contas_bancarias FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all contas_bancarias" ON public.contas_bancarias FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_contas_bancarias_upd BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CATEGORIAS FINANCEIRAS ============
CREATE TABLE public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  parent_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own cats" ON public.categorias_financeiras FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all cats" ON public.categorias_financeiras FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ CONTAS A PAGAR ============
CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid,
  empresa_id uuid,
  fornecedor_id uuid,
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  compra_id uuid,
  compra_parcela_id uuid,
  fatura_cartao_id uuid,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  pago_em date,
  valor_pago numeric DEFAULT 0,
  conta_bancaria_id uuid,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado','parcial')),
  origem text NOT NULL DEFAULT 'manual',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own ap" ON public.contas_pagar FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all ap" ON public.contas_pagar FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cp_upd BEFORE UPDATE ON public.contas_pagar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.contas_pagar (customer_id, status, vencimento);

-- ============ MEDIÇÕES DE OBRA (faturamento ao cliente) ============
CREATE TABLE public.medicoes_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 1,
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','aprovada','faturada','cancelada')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicoes_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own mo" ON public.medicoes_obra FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all mo" ON public.medicoes_obra FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_mo_upd BEFORE UPDATE ON public.medicoes_obra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.medicao_obra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  medicao_obra_id uuid NOT NULL REFERENCES public.medicoes_obra(id) ON DELETE CASCADE,
  etapa_id uuid,
  subetapa_id uuid,
  descricao text NOT NULL,
  percentual numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicao_obra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own moi" ON public.medicao_obra_itens FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all moi" ON public.medicao_obra_itens FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ CONTAS A RECEBER ============
CREATE TABLE public.contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid,
  empresa_id uuid,
  medicao_obra_id uuid REFERENCES public.medicoes_obra(id),
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  recebido_em date,
  valor_recebido numeric DEFAULT 0,
  conta_bancaria_id uuid,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado','parcial')),
  origem text NOT NULL DEFAULT 'manual',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own ar" ON public.contas_receber FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all ar" ON public.contas_receber FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cr_upd BEFORE UPDATE ON public.contas_receber FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.contas_receber (customer_id, status, vencimento);

-- ============ LANÇAMENTOS ============
CREATE TABLE public.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  conta_bancaria_id uuid NOT NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id),
  obra_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  descricao text NOT NULL,
  conta_pagar_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  conta_receber_id uuid REFERENCES public.contas_receber(id) ON DELETE SET NULL,
  transferencia_id uuid,
  conciliado boolean NOT NULL DEFAULT false,
  estorno_token uuid,
  estornado boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own lanc" ON public.lancamentos FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all lanc" ON public.lancamentos FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE INDEX ON public.lancamentos (customer_id, conta_bancaria_id, data);

-- ============ TRANSFERÊNCIAS ============
CREATE TABLE public.transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  conta_origem_id uuid NOT NULL,
  conta_destino_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  descricao text,
  estorno_token uuid NOT NULL DEFAULT gen_random_uuid(),
  estornada boolean NOT NULL DEFAULT false,
  estornada_em timestamptz,
  estornada_por uuid,
  motivo_estorno text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own transf" ON public.transferencias FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all transf" ON public.transferencias FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ CONCILIAÇÃO ============
CREATE TABLE public.conciliacao_extratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  conta_bancaria_id uuid NOT NULL,
  arquivo_nome text,
  formato text NOT NULL DEFAULT 'ofx',
  periodo_inicio date,
  periodo_fim date,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliacao_extratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own cext" ON public.conciliacao_extratos FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all cext" ON public.conciliacao_extratos FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.conciliacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  extrato_id uuid NOT NULL REFERENCES public.conciliacao_extratos(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text,
  valor numeric NOT NULL,
  tipo text NOT NULL,
  lancamento_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own citens" ON public.conciliacao_itens FOR ALL TO authenticated USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all citens" ON public.conciliacao_itens FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ TRIGGERS DE INTEGRAÇÃO ============

-- Compra parcela -> conta a pagar
CREATE OR REPLACE FUNCTION public.parcela_to_conta_pagar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_compra record;
BEGIN
  SELECT obra_id, fornecedor_id, descricao, cartao_id, forma_pagamento INTO v_compra FROM public.compras WHERE id = NEW.compra_id;
  -- Se for cartão de crédito, NÃO gera conta a pagar individual (vai pela fatura)
  IF v_compra.forma_pagamento = 'cartao' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.contas_pagar (
    customer_id, obra_id, fornecedor_id, compra_id, compra_parcela_id,
    descricao, valor, vencimento, status, origem
  ) VALUES (
    NEW.customer_id, v_compra.obra_id, v_compra.fornecedor_id, NEW.compra_id, NEW.id,
    COALESCE(v_compra.descricao,'Compra') || ' - parcela ' || NEW.numero,
    NEW.valor, NEW.vencimento, 'pendente', 'compra'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_parcela_ap AFTER INSERT ON public.compra_parcelas
FOR EACH ROW EXECUTE FUNCTION public.parcela_to_conta_pagar();

-- Fatura de cartão fechada -> conta a pagar única
CREATE OR REPLACE FUNCTION public.fatura_to_conta_pagar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cartao_nome text;
BEGIN
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    SELECT nome INTO v_cartao_nome FROM public.cartoes WHERE id = NEW.cartao_id;
    IF NOT EXISTS (SELECT 1 FROM public.contas_pagar WHERE fatura_cartao_id = NEW.id) THEN
      INSERT INTO public.contas_pagar (
        customer_id, fatura_cartao_id, descricao, valor, vencimento, status, origem
      ) VALUES (
        NEW.customer_id, NEW.id,
        'Fatura ' || COALESCE(v_cartao_nome,'Cartão') || ' - ' || NEW.competencia,
        NEW.valor_total, NEW.dt_vencimento, 'pendente', 'fatura_cartao'
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fatura_ap AFTER UPDATE ON public.faturas_cartao
FOR EACH ROW EXECUTE FUNCTION public.fatura_to_conta_pagar();

-- Baixa de conta a pagar -> lançamento de saída
CREATE OR REPLACE FUNCTION public.cp_baixa_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') AND NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.lancamentos (
      customer_id, conta_bancaria_id, categoria_id, obra_id,
      tipo, valor, data, descricao, conta_pagar_id, created_by
    ) VALUES (
      NEW.customer_id, NEW.conta_bancaria_id, NEW.categoria_id, NEW.obra_id,
      'saida', COALESCE(NEW.valor_pago, NEW.valor), COALESCE(NEW.pago_em, CURRENT_DATE),
      NEW.descricao, NEW.id, NEW.created_by
    );
    UPDATE public.contas_bancarias SET saldo_atual = saldo_atual - COALESCE(NEW.valor_pago, NEW.valor)
      WHERE id = NEW.conta_bancaria_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cp_baixa AFTER UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.cp_baixa_to_lancamento();

-- Baixa de conta a receber -> lançamento de entrada
CREATE OR REPLACE FUNCTION public.cr_baixa_to_lancamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') AND NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.lancamentos (
      customer_id, conta_bancaria_id, categoria_id, obra_id,
      tipo, valor, data, descricao, conta_receber_id, created_by
    ) VALUES (
      NEW.customer_id, NEW.conta_bancaria_id, NEW.categoria_id, NEW.obra_id,
      'entrada', COALESCE(NEW.valor_recebido, NEW.valor), COALESCE(NEW.recebido_em, CURRENT_DATE),
      NEW.descricao, NEW.id, NEW.created_by
    );
    UPDATE public.contas_bancarias SET saldo_atual = saldo_atual + COALESCE(NEW.valor_recebido, NEW.valor)
      WHERE id = NEW.conta_bancaria_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cr_baixa AFTER UPDATE ON public.contas_receber
FOR EACH ROW EXECUTE FUNCTION public.cr_baixa_to_lancamento();

-- Transferência -> dois lançamentos com mesmo token
CREATE OR REPLACE FUNCTION public.transferencia_to_lancamentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.lancamentos (customer_id, conta_bancaria_id, tipo, valor, data, descricao, transferencia_id, estorno_token, created_by)
  VALUES (NEW.customer_id, NEW.conta_origem_id, 'saida', NEW.valor, NEW.data, COALESCE(NEW.descricao,'Transferência'), NEW.id, NEW.estorno_token, NEW.created_by);
  INSERT INTO public.lancamentos (customer_id, conta_bancaria_id, tipo, valor, data, descricao, transferencia_id, estorno_token, created_by)
  VALUES (NEW.customer_id, NEW.conta_destino_id, 'entrada', NEW.valor, NEW.data, COALESCE(NEW.descricao,'Transferência'), NEW.id, NEW.estorno_token, NEW.created_by);
  UPDATE public.contas_bancarias SET saldo_atual = saldo_atual - NEW.valor WHERE id = NEW.conta_origem_id;
  UPDATE public.contas_bancarias SET saldo_atual = saldo_atual + NEW.valor WHERE id = NEW.conta_destino_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_transf_lanc AFTER INSERT ON public.transferencias
FOR EACH ROW EXECUTE FUNCTION public.transferencia_to_lancamentos();
