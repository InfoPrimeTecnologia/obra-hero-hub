-- =============================================================================
-- Mestre 360 — Produção — v1.8.1
-- Fatura de cartão rateada por obra + correção do envio de foto da obra
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- Substitui/complementa o script 1.8.0 (pode rodar mesmo se o 1.8.0 já rodou).
-- =============================================================================

-- 1) Fatura fechada gera UMA conta a pagar POR OBRA (empresa = soma das obras)
CREATE OR REPLACE FUNCTION public.fatura_to_conta_pagar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cartao_nome text;
  r record;
BEGIN
  IF NEW.status = 'fechada' AND (OLD.status IS DISTINCT FROM 'fechada') THEN
    SELECT nome INTO v_cartao_nome FROM public.cartoes WHERE id = NEW.cartao_id;

    FOR r IN
      SELECT c.obra_id AS obra_id, SUM(p.valor) AS valor
        FROM public.compra_parcelas p
        JOIN public.compras c ON c.id = p.compra_id
       WHERE p.fatura_cartao_id = NEW.id
       GROUP BY c.obra_id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.contas_pagar
         WHERE fatura_cartao_id = NEW.id
           AND obra_id IS NOT DISTINCT FROM r.obra_id
      ) THEN
        UPDATE public.contas_pagar
           SET valor = r.valor, vencimento = NEW.dt_vencimento
         WHERE fatura_cartao_id = NEW.id
           AND obra_id IS NOT DISTINCT FROM r.obra_id
           AND status = 'pendente';
      ELSE
        INSERT INTO public.contas_pagar (
          customer_id, obra_id, fatura_cartao_id, descricao, valor, vencimento, status, origem
        ) VALUES (
          NEW.customer_id, r.obra_id, NEW.id,
          'Fatura ' || COALESCE(v_cartao_nome,'Cartão') || ' - ' || NEW.competencia,
          r.valor, NEW.dt_vencimento, 'pendente', 'fatura_cartao'
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Backfill: refaz as contas a pagar das faturas ainda totalmente pendentes
DO $$
DECLARE f record; r record; v_nome text;
BEGIN
  FOR f IN
    SELECT fc.* FROM public.faturas_cartao fc
     WHERE EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.fatura_cartao_id = fc.id)
       AND NOT EXISTS (SELECT 1 FROM public.contas_pagar cp
                        WHERE cp.fatura_cartao_id = fc.id AND cp.status <> 'pendente')
  LOOP
    DELETE FROM public.contas_pagar WHERE fatura_cartao_id = f.id;
    SELECT nome INTO v_nome FROM public.cartoes WHERE id = f.cartao_id;
    FOR r IN
      SELECT c.obra_id AS obra_id, SUM(p.valor) AS valor
        FROM public.compra_parcelas p
        JOIN public.compras c ON c.id = p.compra_id
       WHERE p.fatura_cartao_id = f.id
       GROUP BY c.obra_id
    LOOP
      INSERT INTO public.contas_pagar (
        customer_id, obra_id, fatura_cartao_id, descricao, valor, vencimento, status, origem
      ) VALUES (
        f.customer_id, r.obra_id, f.id,
        'Fatura ' || COALESCE(v_nome,'Cartão') || ' - ' || f.competencia,
        r.valor, f.dt_vencimento, 'pendente', 'fatura_cartao'
      );
    END LOOP;
  END LOOP;
END $$;

-- 3) Evita duplicidade de conta a pagar por fatura + obra
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_fatura_obra_uidx
    ON public.contas_pagar (fatura_cartao_id, COALESCE(obra_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE fatura_cartao_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Indice fatura+obra nao criado: %', SQLERRM;
END $$;

-- 4) Fotos da obra: permissões para qualquer usuário com acesso à empresa da obra
DROP POLICY IF EXISTS "Owners read own obra fotos"   ON storage.objects;
DROP POLICY IF EXISTS "Owners upload own obra fotos" ON storage.objects;
DROP POLICY IF EXISTS "Owners update own obra fotos" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete own obra fotos" ON storage.objects;
DROP POLICY IF EXISTS "Members read obra fotos"      ON storage.objects;
DROP POLICY IF EXISTS "Members upload obra fotos"    ON storage.objects;
DROP POLICY IF EXISTS "Members update obra fotos"    ON storage.objects;
DROP POLICY IF EXISTS "Members delete obra fotos"    ON storage.objects;

CREATE POLICY "Members read obra fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'obra-fotos'
     AND public.user_has_customer_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Members upload obra fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'obra-fotos'
     AND public.user_has_customer_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Members update obra fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'obra-fotos'
     AND public.user_has_customer_access(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'obra-fotos'
     AND public.user_has_customer_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Members delete obra fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'obra-fotos'
     AND public.user_has_customer_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- 5) Changelog
INSERT INTO public.app_releases (version, highlight, items, released_at)
SELECT '1.8.1',
       'Fatura do cartão por obra e correção da foto da obra',
       '[
         "Dentro da obra, a fatura do cartão mostra apenas a parte daquela obra",
         "Na empresa, a fatura continua com o total do cartão e o detalhamento por obra",
         "Faturas já pagas não aparecem mais junto das pendentes na obra",
         "Correção do erro ao anexar/trocar a foto da obra"
       ]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.app_releases WHERE version = '1.8.1');
