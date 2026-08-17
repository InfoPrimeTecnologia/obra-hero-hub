-- =============================================================================
-- Mestre 360 — Produção — v1.8.5
-- Correção definitiva do saldo bancário após estorno
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

-- O lançamento original continua compondo o histórico contábil.
-- O contra-lançamento criado no estorno é o único responsável pela devolução.
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

-- Saldo alterado somente ao criar ou excluir uma movimentação.
-- Atualizar estornado=true nunca volta a mexer no saldo.
CREATE OR REPLACE FUNCTION public.lancamento_aplicar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual, 0)
             + public.lancamento_valor_assinado(NEW.tipo, NEW.valor, NEW.estornado)
       WHERE id = NEW.conta_bancaria_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.conta_bancaria_id IS NOT NULL THEN
      UPDATE public.contas_bancarias
         SET saldo_atual = COALESCE(saldo_atual, 0)
             - public.lancamento_valor_assinado(OLD.tipo, OLD.valor, OLD.estornado)
       WHERE id = OLD.conta_bancaria_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Neutraliza a função antiga caso ainda exista em produção.
CREATE OR REPLACE FUNCTION public.lancamento_ajusta_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Remove qualquer trigger legado que altere saldo_atual, mesmo que tenha
-- recebido outro nome em uma versão anterior do sistema.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname = 'lancamentos'
       AND (
         p.proname IN ('lancamento_aplicar_saldo', 'lancamento_ajusta_saldo')
         OR pg_get_functiondef(p.oid) ILIKE '%saldo_atual%'
       )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.lancamentos', r.tgname);
  END LOOP;
END $$;

CREATE TRIGGER trg_lancamento_saldo
AFTER INSERT OR DELETE ON public.lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.lancamento_aplicar_saldo();

-- Em bancos de produção antigos, estas funções também atualizavam saldo_atual
-- diretamente. Agora elas apenas criam o lançamento; o trigger único acima
-- é o único responsável por alterar o saldo.
CREATE OR REPLACE FUNCTION public.cp_baixa_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pago'
     AND OLD.status IS DISTINCT FROM 'pago'
     AND NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.lancamentos (
      customer_id, conta_bancaria_id, categoria_id, obra_id,
      tipo, valor, data, descricao, conta_pagar_id, created_by
    ) VALUES (
      NEW.customer_id, NEW.conta_bancaria_id, NEW.categoria_id, NEW.obra_id,
      'saida', COALESCE(NEW.valor_pago, NEW.valor),
      COALESCE(NEW.pago_em, CURRENT_DATE), NEW.descricao, NEW.id, NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cr_baixa_to_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'recebido'
     AND OLD.status IS DISTINCT FROM 'recebido'
     AND NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.lancamentos (
      customer_id, conta_bancaria_id, categoria_id, obra_id,
      tipo, valor, data, descricao, conta_receber_id, created_by
    ) VALUES (
      NEW.customer_id, NEW.conta_bancaria_id, NEW.categoria_id, NEW.obra_id,
      'entrada', COALESCE(NEW.valor_recebido, NEW.valor),
      COALESCE(NEW.recebido_em, CURRENT_DATE), NEW.descricao, NEW.id, NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transferencia_to_lancamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.lancamentos (
    customer_id, conta_bancaria_id, tipo, valor, data, descricao,
    transferencia_id, estorno_token, created_by
  ) VALUES (
    NEW.customer_id, NEW.conta_origem_id, 'saida', NEW.valor, NEW.data,
    COALESCE(NEW.descricao, 'Transferência'), NEW.id, NEW.estorno_token, NEW.created_by
  );

  INSERT INTO public.lancamentos (
    customer_id, conta_bancaria_id, tipo, valor, data, descricao,
    transferencia_id, estorno_token, created_by
  ) VALUES (
    NEW.customer_id, NEW.conta_destino_id, 'entrada', NEW.valor, NEW.data,
    COALESCE(NEW.descricao, 'Transferência'), NEW.id, NEW.estorno_token, NEW.created_by
  );
  RETURN NEW;
END;
$$;

-- Corrige imediatamente todos os saldos que já tenham ficado divergentes.
UPDATE public.contas_bancarias cb
   SET saldo_atual = COALESCE(cb.saldo_inicial, 0) + COALESCE((
     SELECT SUM(public.lancamento_valor_assinado(l.tipo, l.valor, l.estornado))
       FROM public.lancamentos l
      WHERE l.conta_bancaria_id = cb.id
   ), 0);

-- Changelog
INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT
  '1.8.5',
  now(),
  'Correção definitiva do saldo após estorno',
  '["Estornos passam a devolver o valor uma única vez, sem duplicidade causada por gatilhos antigos","Gatilhos legados de saldo são removidos mesmo quando possuem nomes diferentes","Saldos bancários divergentes são recalculados automaticamente a partir do histórico completo"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_releases WHERE version = '1.8.5'
);