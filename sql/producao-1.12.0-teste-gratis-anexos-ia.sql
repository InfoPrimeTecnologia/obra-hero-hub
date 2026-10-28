-- Mestre 360 v1.12.0 — Teste grátis de 5 dias + anexos no assistente de IA
-- Idempotente: pode rodar mais de uma vez no SQL Editor do Supabase de produção.

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.trial_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  credits integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trial_registrations_email_uniq ON public.trial_registrations (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS trial_registrations_customer_uniq ON public.trial_registrations (customer_id) WHERE customer_id IS NOT NULL;

GRANT SELECT ON public.trial_registrations TO authenticated;
GRANT ALL ON public.trial_registrations TO service_role;
ALTER TABLE public.trial_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read trials" ON public.trial_registrations;
CREATE POLICY "Admins read trials" ON public.trial_registrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.12.0',
  true,
  '["Teste grátis de 5 dias no plano mais completo com 100 créditos de IA","Cada e-mail só pode fazer um teste grátis","Painel admin: nova página Testes grátis","Assistente de IA aceita fotos, PDFs e arquivos de texto/CSV"]'::jsonb,
  now()
)
ON CONFLICT (version) DO UPDATE SET highlight = EXCLUDED.highlight, items = EXCLUDED.items;
