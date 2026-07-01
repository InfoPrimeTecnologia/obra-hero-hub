-- Fluxo de aprovação de compras
-- Rodar no SQL Editor do Supabase de produção.
-- Idempotente: pode ser executado múltiplas vezes.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS limite_aprovacao_compra numeric NOT NULL DEFAULT 0;

ALTER TABLE public.customer_members
  ADD COLUMN IF NOT EXISTS pode_aprovar_compras boolean NOT NULL DEFAULT false;

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'nao_requer',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS rejeicao_motivo text;

ALTER TABLE public.compras
  DROP CONSTRAINT IF EXISTS compras_aprovacao_status_check;
ALTER TABLE public.compras
  ADD CONSTRAINT compras_aprovacao_status_check
    CHECK (aprovacao_status IN ('nao_requer','pendente','aprovada','rejeitada'));

CREATE OR REPLACE FUNCTION public.compra_check_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_limite numeric;
BEGIN
  SELECT COALESCE(limite_aprovacao_compra, 0) INTO v_limite
    FROM public.customers WHERE id = NEW.customer_id;
  IF NEW.aprovacao_status IN ('aprovada','rejeitada') THEN
    RETURN NEW;
  END IF;
  IF v_limite > 0 AND COALESCE(NEW.valor_total, 0) > v_limite THEN
    NEW.aprovacao_status := 'pendente';
  ELSE
    NEW.aprovacao_status := 'nao_requer';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_compra_check_aprovacao ON public.compras;
CREATE TRIGGER trg_compra_check_aprovacao
  BEFORE INSERT OR UPDATE OF valor_total, customer_id
  ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.compra_check_aprovacao();

CREATE OR REPLACE FUNCTION public.pode_aprovar_compra(_customer_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.customers
             WHERE id = _customer_id AND owner_user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.customer_members
                WHERE customer_id = _customer_id
                  AND user_id = _user_id
                  AND status = 'ativo'
                  AND pode_aprovar_compras = true)
    OR public.has_role(_user_id, 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.decidir_compra(_compra_id uuid, _aprovar boolean, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust uuid;
  v_status text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT customer_id, aprovacao_status INTO v_cust, v_status
    FROM public.compras WHERE id = _compra_id;
  IF v_cust IS NULL THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;

  IF NOT public.pode_aprovar_compra(v_cust, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar compras';
  END IF;

  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Compra não está pendente de aprovação';
  END IF;

  UPDATE public.compras
     SET aprovacao_status = CASE WHEN _aprovar THEN 'aprovada' ELSE 'rejeitada' END,
         aprovado_por = v_uid,
         aprovado_em = now(),
         rejeicao_motivo = CASE WHEN _aprovar THEN NULL ELSE _motivo END
   WHERE id = _compra_id;
END $$;

GRANT EXECUTE ON FUNCTION public.pode_aprovar_compra(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_compra(uuid, boolean, text) TO authenticated;
