CREATE TABLE public.auth_email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  token_hash text NOT NULL,
  type text NOT NULL CHECK (type IN ('signup','recovery','magic_link')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_email_tokens_hash_type ON public.auth_email_tokens(token_hash, type);
CREATE INDEX idx_auth_email_tokens_email_type ON public.auth_email_tokens(lower(email), type, created_at DESC);

ALTER TABLE public.auth_email_tokens ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy: apenas service role acessa (que bypassa RLS)
