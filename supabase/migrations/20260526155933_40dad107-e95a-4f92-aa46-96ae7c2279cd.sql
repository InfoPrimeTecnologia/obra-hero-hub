
CREATE TABLE public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  rdo_id uuid,
  obra_id uuid,
  phone_number text NOT NULL,
  message text,
  file_name text,
  provider text NOT NULL DEFAULT 'primesync',
  status text NOT NULL,
  response jsonb,
  error text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own customer whatsapp logs"
ON public.whatsapp_send_log FOR SELECT TO authenticated
USING (customer_id = public.current_user_customer_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users insert own customer whatsapp logs"
ON public.whatsapp_send_log FOR INSERT TO authenticated
WITH CHECK (customer_id = public.current_user_customer_id() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_whatsapp_send_log_customer ON public.whatsapp_send_log(customer_id, created_at DESC);
CREATE INDEX idx_whatsapp_send_log_rdo ON public.whatsapp_send_log(rdo_id);
