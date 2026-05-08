
-- ============ PLANS: modules + limits ============
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '["obras","financeiro","compras","estoque","rh","relatorios"]'::jsonb,
  ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{"max_obras":null,"max_colaboradores":null,"max_usuarios":null}'::jsonb;

-- ============ ESTOQUE ============
CREATE TABLE IF NOT EXISTS public.almoxarifados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid,
  nome text NOT NULL,
  descricao text,
  principal boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.almoxarifados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own almox" ON public.almoxarifados FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all almox" ON public.almoxarifados FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  codigo text,
  nome text NOT NULL,
  descricao text,
  unidade text NOT NULL DEFAULT 'un',
  categoria text,
  custo_medio numeric NOT NULL DEFAULT 0,
  estoque_minimo numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own produtos" ON public.produtos FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all produtos" ON public.produtos FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estoque_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  produto_id uuid NOT NULL,
  almoxarifado_id uuid NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  custo_medio numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, almoxarifado_id)
);
ALTER TABLE public.estoque_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own saldos" ON public.estoque_saldos FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all saldos" ON public.estoque_saldos FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  produto_id uuid NOT NULL,
  almoxarifado_id uuid NOT NULL,
  almoxarifado_destino_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','transferencia_saida','transferencia_entrada')),
  origem text NOT NULL DEFAULT 'manual',
  recebimento_id uuid,
  requisicao_id uuid,
  obra_id uuid,
  quantidade numeric NOT NULL,
  custo_unitario numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  estorno_token uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own mov" ON public.estoque_movimentacoes FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all mov" ON public.estoque_movimentacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.requisicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  almoxarifado_id uuid,
  numero integer NOT NULL DEFAULT 1,
  solicitante text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','aprovada','atendida','cancelada')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.requisicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own req" ON public.requisicoes FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all req" ON public.requisicoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.requisicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  requisicao_id uuid NOT NULL,
  produto_id uuid NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  qtd_atendida numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.requisicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own reqi" ON public.requisicao_itens FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all reqi" ON public.requisicao_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- vincular produto a item de compra (opcional)
ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS produto_id uuid;

-- ============ RH ============
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  empresa_id uuid,
  foto_url text,
  nome text NOT NULL,
  cpf text,
  ctps text,
  cargo text,
  vinculo text NOT NULL DEFAULT 'CLT' CHECK (vinculo IN ('CLT','PJ','MEI','Autonomo','Estagiario','Temporario','Terceirizado')),
  data_entrada date,
  data_saida date,
  telefone text,
  email text,
  endereco text,
  remuneracao numeric NOT NULL DEFAULT 0,
  pix text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own colabs" ON public.colaboradores FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all colabs" ON public.colaboradores FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.colaborador_obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  data_inicio date,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, obra_id)
);
ALTER TABLE public.colaborador_obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own co" ON public.colaborador_obras FOR ALL TO authenticated
  USING (customer_id = current_user_customer_id()) WITH CHECK (customer_id = current_user_customer_id());
CREATE POLICY "Admins manage all co" ON public.colaborador_obras FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- bucket público para fotos
INSERT INTO storage.buckets (id, name, public) VALUES ('colaborador-fotos','colaborador-fotos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read colab fotos" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'colaborador-fotos');
CREATE POLICY "Auth upload colab fotos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'colaborador-fotos');
CREATE POLICY "Auth update colab fotos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'colaborador-fotos');
CREATE POLICY "Auth delete colab fotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'colaborador-fotos');

-- ============ TRIGGERS ============
-- updated_at
CREATE TRIGGER trg_almox_upd BEFORE UPDATE ON public.almoxarifados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_produtos_upd BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_req_upd BEFORE UPDATE ON public.requisicoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_colab_upd BEFORE UPDATE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- aplicar movimentação no saldo (com custo médio ponderado em entradas)
CREATE OR REPLACE FUNCTION public.aplicar_movimentacao_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo record;
  v_qtd_assinada numeric;
  v_novo_saldo numeric;
  v_novo_custo numeric;
BEGIN
  -- determinar sinal
  IF NEW.tipo IN ('entrada','transferencia_entrada') THEN
    v_qtd_assinada := NEW.quantidade;
  ELSIF NEW.tipo IN ('saida','transferencia_saida') THEN
    v_qtd_assinada := -NEW.quantidade;
  ELSE -- ajuste: quantidade pode ser negativa
    v_qtd_assinada := NEW.quantidade;
  END IF;

  SELECT * INTO v_saldo FROM public.estoque_saldos
    WHERE produto_id = NEW.produto_id AND almoxarifado_id = NEW.almoxarifado_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.estoque_saldos (customer_id, produto_id, almoxarifado_id, quantidade, custo_medio)
    VALUES (NEW.customer_id, NEW.produto_id, NEW.almoxarifado_id,
            v_qtd_assinada,
            CASE WHEN NEW.tipo IN ('entrada','transferencia_entrada') THEN NEW.custo_unitario ELSE 0 END);
  ELSE
    v_novo_saldo := v_saldo.quantidade + v_qtd_assinada;
    IF NEW.tipo IN ('entrada','transferencia_entrada') AND v_novo_saldo > 0 THEN
      -- custo médio ponderado
      v_novo_custo := ((v_saldo.quantidade * v_saldo.custo_medio) + (NEW.quantidade * NEW.custo_unitario))
                      / NULLIF((v_saldo.quantidade + NEW.quantidade), 0);
    ELSE
      v_novo_custo := v_saldo.custo_medio;
    END IF;
    UPDATE public.estoque_saldos
      SET quantidade = v_novo_saldo, custo_medio = COALESCE(v_novo_custo, v_saldo.custo_medio), updated_at = now()
      WHERE id = v_saldo.id;
  END IF;

  -- atualizar custo médio do produto (média ponderada de todos almoxarifados)
  UPDATE public.produtos p SET custo_medio = COALESCE((
    SELECT CASE WHEN SUM(quantidade) > 0
      THEN SUM(quantidade * custo_medio) / SUM(quantidade) ELSE p.custo_medio END
    FROM public.estoque_saldos WHERE produto_id = p.id
  ), p.custo_medio), updated_at = now()
  WHERE id = NEW.produto_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_aplicar_mov AFTER INSERT ON public.estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimentacao_estoque();

REVOKE EXECUTE ON FUNCTION public.aplicar_movimentacao_estoque() FROM PUBLIC;

-- recebimento -> entrada estoque (somente se o item de compra tiver produto vinculado)
CREATE OR REPLACE FUNCTION public.recebimento_to_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra record;
  v_item record;
  v_almox uuid;
  v_custo numeric;
BEGIN
  SELECT ci.produto_id, ci.valor_unitario, c.obra_id
    INTO v_item
    FROM public.compra_itens ci
    JOIN public.compras c ON c.id = ci.compra_id
    WHERE ci.id = NEW.compra_item_id;

  IF v_item.produto_id IS NULL THEN
    RETURN NEW; -- sem produto vinculado, ignora
  END IF;

  -- almoxarifado principal da obra; se não existir, principal da empresa
  SELECT id INTO v_almox FROM public.almoxarifados
    WHERE customer_id = NEW.customer_id AND obra_id = v_item.obra_id AND ativo = true
    ORDER BY principal DESC, created_at ASC LIMIT 1;
  IF v_almox IS NULL THEN
    SELECT id INTO v_almox FROM public.almoxarifados
      WHERE customer_id = NEW.customer_id AND ativo = true
      ORDER BY principal DESC, created_at ASC LIMIT 1;
  END IF;
  IF v_almox IS NULL THEN
    -- cria principal automático
    INSERT INTO public.almoxarifados (customer_id, obra_id, nome, principal)
    VALUES (NEW.customer_id, v_item.obra_id, 'Almoxarifado Principal', true)
    RETURNING id INTO v_almox;
  END IF;

  v_custo := COALESCE(v_item.valor_unitario, 0);

  INSERT INTO public.estoque_movimentacoes (
    customer_id, produto_id, almoxarifado_id, tipo, origem, recebimento_id, obra_id,
    quantidade, custo_unitario, data, observacoes
  ) VALUES (
    NEW.customer_id, v_item.produto_id, v_almox, 'entrada', 'recebimento', NEW.recebimento_id, v_item.obra_id,
    NEW.quantidade, v_custo, CURRENT_DATE, 'Entrada por recebimento'
  );

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_recebimento_estoque AFTER INSERT ON public.recebimento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recebimento_to_estoque();

REVOKE EXECUTE ON FUNCTION public.recebimento_to_estoque() FROM PUBLIC;

-- index úteis
CREATE INDEX IF NOT EXISTS idx_mov_produto ON public.estoque_movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_almox ON public.estoque_movimentacoes(almoxarifado_id);
CREATE INDEX IF NOT EXISTS idx_saldo_almox ON public.estoque_saldos(almoxarifado_id);
CREATE INDEX IF NOT EXISTS idx_colab_obra ON public.colaborador_obras(obra_id);
