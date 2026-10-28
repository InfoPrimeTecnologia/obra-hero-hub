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