-- 1) Trigger: fatura fechada gera uma conta a pagar POR OBRA
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
           SET valor = r.valor,
               vencimento = NEW.dt_vencimento
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

-- 2) Backfill: refaz as contas a pagar de faturas ainda totalmente pendentes
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

-- 3) Evita duplicidade de conta a pagar por fatura+obra
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_fatura_obra_uidx
      ON public.contas_pagar (fatura_cartao_id, COALESCE(obra_id, '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE fatura_cartao_id IS NOT NULL;
  EXCEPTION WHEN unique_violation OR duplicate_table THEN
    RAISE NOTICE 'Indice de fatura+obra nao criado (registros duplicados existentes)';
  END;
END $$;

-- 4) Permite substituir a foto da obra (upsert no storage precisa de UPDATE)
DROP POLICY IF EXISTS "Owners update own obra fotos" ON storage.objects;
CREATE POLICY "Owners update own obra fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'obra-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text)
  WITH CHECK (bucket_id = 'obra-fotos' AND (storage.foldername(name))[1] = (public.current_user_customer_id())::text);