-- =============================================================================
-- Mestre 360 — Produção — v1.8.6
-- Estorno atômico: impede devolução duplicada e corrige saldos divergentes
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

-- O lançamento original e o contra-lançamento participam do histórico.
CREATE OR REPLACE FUNCTION public.lancamento_valor_assinado(
  _tipo text,
  _valor numeric,
  _estornado boolean
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _tipo = 'entrada' THEN COALESCE(_valor, 0)
    ELSE -COALESCE(_valor, 0)
  END;
$$;

-- Saldo alterado exclusivamente ao inserir ou excluir lançamentos.
CREATE OR REPLACE FUNCTION public.lancamento_aplicar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.conta_bancaria_id IS NOT NULL THEN
    UPDATE public.contas_bancarias
       SET saldo_atual = COALESCE(saldo_atual, 0)
           + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
     WHERE id = NEW.conta_bancaria_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.conta_bancaria_id IS NOT NULL THEN
    UPDATE public.contas_bancarias
       SET saldo_atual = COALESCE(saldo_atual, 0)
           - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
     WHERE id = OLD.conta_bancaria_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Remove TODOS os gatilhos de lançamentos e qualquer gatilho legado de outra
-- tabela cuja função escreva em saldo_atual. Isso cobre versões antigas em que
-- contas_pagar/contas_receber também alteravam o saldo diretamente.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND (
         c.relname = 'lancamentos'
         OR pg_get_functiondef(p.oid) ILIKE '%saldo_atual%'
       )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I.%I',
      r.tgname,
      r.schema_name,
      r.table_name
    );
  END LOOP;
END $$;

CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.lancamento_aplicar_saldo();

-- Uma única operação transacional marca o original e cria o inverso.
-- O bloqueio FOR UPDATE impede dois cliques/requisições de estornarem o mesmo item.
CREATE OR REPLACE FUNCTION public.estornar_lancamento(
  _lancamento_id uuid,
  _motivo text
)
RETURNS TABLE(estorno_token uuid, contra_lancamento_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lanc public.lancamentos%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_contra_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) < 3 THEN
    RAISE EXCEPTION 'Informe um motivo válido para o estorno';
  END IF;

  SELECT * INTO v_lanc
    FROM public.lancamentos
   WHERE id = _lancamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;
  IF NOT public.user_has_customer_access(v_uid, v_lanc.customer_id)
     AND NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para estornar este lançamento';
  END IF;
  IF COALESCE(v_lanc.estornado, false) THEN
    RAISE EXCEPTION 'Este lançamento já foi estornado';
  END IF;

  UPDATE public.lancamentos
     SET estornado = true, estorno_token = v_token
   WHERE id = v_lanc.id
     AND COALESCE(estornado, false) = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este lançamento já foi estornado';
  END IF;

  INSERT INTO public.lancamentos (
    customer_id, conta_bancaria_id, categoria_id, obra_id,
    tipo, valor, data, descricao, estorno_token, created_by
  ) VALUES (
    v_lanc.customer_id, v_lanc.conta_bancaria_id, v_lanc.categoria_id, v_lanc.obra_id,
    CASE WHEN v_lanc.tipo = 'saida' THEN 'entrada' ELSE 'saida' END,
    v_lanc.valor, CURRENT_DATE,
    'ESTORNO: ' || COALESCE(v_lanc.descricao, 'Lançamento') || ' - ' || trim(_motivo),
    v_token, v_uid
  ) RETURNING id INTO v_contra_id;

  RETURN QUERY SELECT v_token, v_contra_id;
END;
$$;

REVOKE ALL ON FUNCTION public.estornar_lancamento(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO service_role;

-- Corrige imediatamente contas que ficaram R$ 500 (ou outro valor) acima.
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
     SELECT SUM(public.lancamento_valor_assinado(l.tipo, l.valor, l.estornado))
       FROM public.lancamentos l
      WHERE l.conta_bancaria_id = cb.id
   ), 0);

INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT
  '1.8.6',
  now(),
  'Estorno financeiro atômico e protegido contra duplicidade',
  '["Estorno de pagamento passa a ser uma única operação transacional no banco","Cliques ou requisições simultâneas não conseguem mais devolver o mesmo pagamento duas vezes","Gatilhos antigos de lançamentos são removidos e os saldos bancários são recalculados pelo histórico"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_releases WHERE version = '1.8.6'
);