-- Mestre 360 — v1.11.0: Cupons de desconto (1ª mensalidade)
-- Idempotente: pode rodar mais de uma vez no SQL Editor.

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  percent numeric(5,2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  description text,
  expires_at date,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_key ON public.coupons (upper(code));

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subscription_id uuid,
  invoice_id uuid,
  plan_id uuid,
  code text NOT NULL,
  percent numeric(5,2) NOT NULL,
  original_amount numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL,
  final_amount numeric(12,2) NOT NULL,
  redeemed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, customer_id)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON public.coupon_redemptions (coupon_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins read redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.11.0','Cupons de desconto',
  '[{"type":"feature","description":"Cupons com porcentagem de desconto na 1ª mensalidade, criados no painel"},{"type":"feature","description":"Registro de cada uso do cupom: empresa, plano, data e valor do desconto"},{"type":"improvement","description":"Campo para aplicar cupom na tela de Assinatura"}]'::jsonb, now())
ON CONFLICT (version) DO UPDATE SET highlight=EXCLUDED.highlight, items=EXCLUDED.items;
