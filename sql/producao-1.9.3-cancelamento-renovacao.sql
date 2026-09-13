-- Mestre 360 — v1.9.3
-- Cancelamento somente da renovação automática, preservando o período pago.
-- Idempotente: pode ser executado mais de uma vez com segurança.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_until date;

UPDATE public.subscriptions
SET access_until = next_due_date
WHERE status = 'canceled'
  AND access_until IS NULL;

INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.9.3',
  true,
  '["Cancelamento da renovação automática da assinatura","Acesso preservado até o fim do período já pago","Confirmação e retorno visual ao cancelar o plano"]'::jsonb,
  now()
)
ON CONFLICT (version) DO UPDATE SET
  highlight = EXCLUDED.highlight,
  items = EXCLUDED.items,
  released_at = EXCLUDED.released_at;