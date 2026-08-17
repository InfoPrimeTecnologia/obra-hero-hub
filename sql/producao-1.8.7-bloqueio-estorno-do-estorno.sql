-- =============================================================================
-- Mestre 360 — Produção — v1.8.7
-- Bloqueio definitivo de estorno do estorno
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS estorno_de_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'lancamentos_estorno_de_id_fkey'
       AND conrelid = 'public.lancamentos'::regclass
  ) THEN
    ALTER TABLE public.lancamentos
      ADD CONSTRAINT lancamentos_estorno_de_id_fkey
      FOREIGN KEY (estorno_de_id)
      REFERENCES public.lancamentos(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Reconhece e protege os contralancamentos criados pelas versões anteriores.
UPDATE public.lancamentos contra
   SET estorno_de_id = original.id
  FROM public.lancamentos original
 WHERE contra.estorno_de_id IS NULL
   AND contra.id <> original.id
   AND contra.estorno_token IS NOT NULL
   AND contra.estorno_token = original.estorno_token
   AND COALESCE(original.estornado, false) = true
   AND COALESCE(contra.estornado, false) = false
   AND contra.customer_id = original.customer_id
   AND contra.conta_bancaria_id IS NOT DISTINCT FROM original.conta_bancaria_id
   AND contra.tipo <> original.tipo
   AND contra.valor = original.valor
   AND contra.descricao LIKE 'ESTORNO:%';

CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_um_estorno_por_original_uidx
  ON public.lancamentos (estorno_de_id)
  WHERE estorno_de_id IS NOT NULL;

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

  -- O contralancamento corrige o original e nunca pode gerar nova devolução.
  -- A descrição também protege registros antigos ainda não vinculados.
  IF v_lanc.estorno_de_id IS NOT NULL
     OR v_lanc.descricao LIKE 'ESTORNO:%' THEN
    RAISE EXCEPTION 'Não é permitido estornar um lançamento de estorno';
  END IF;
  IF COALESCE(v_lanc.estornado, false) THEN
    RAISE EXCEPTION 'Este lançamento já foi estornado';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.lancamentos l
     WHERE l.estorno_de_id = v_lanc.id
  ) THEN
    RAISE EXCEPTION 'Este lançamento já possui um estorno';
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
    tipo, valor, data, descricao, estorno_token, estorno_de_id, created_by
  ) VALUES (
    v_lanc.customer_id, v_lanc.conta_bancaria_id, v_lanc.categoria_id, v_lanc.obra_id,
    CASE WHEN v_lanc.tipo = 'saida' THEN 'entrada' ELSE 'saida' END,
    v_lanc.valor, CURRENT_DATE,
    'ESTORNO: ' || COALESCE(v_lanc.descricao, 'Lançamento') || ' - ' || trim(_motivo),
    v_token, v_lanc.id, v_uid
  ) RETURNING id INTO v_contra_id;

  RETURN QUERY SELECT v_token, v_contra_id;
END;
$$;

REVOKE ALL ON FUNCTION public.estornar_lancamento(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estornar_lancamento(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid, text) TO service_role;

INSERT INTO public.app_releases (version, released_at, highlight, items)
SELECT
  '1.8.7',
  now(),
  'Bloqueio definitivo de estorno do estorno',
  '["Lançamentos gerados por estorno não podem mais ser estornados novamente","Cada estorno passa a manter vínculo explícito com o lançamento original","Registros antigos de contralancamento são reconhecidos e protegidos"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_releases WHERE version = '1.8.7'
);