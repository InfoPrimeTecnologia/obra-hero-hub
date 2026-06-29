
-- Harden customer_invites: prevent token exposure via column-level revoke.
-- Only service_role can read/write the plaintext token (invite acceptance must run server-side).
REVOKE SELECT (token), UPDATE (token), INSERT (token) ON public.customer_invites FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invites TO service_role;

-- Prevent cross-tenant pivot via customer_members: a user can only be an active member of one tenant.
DELETE FROM public.customer_members a
USING public.customer_members b
WHERE a.user_id = b.user_id
  AND a.status = 'ativo' AND b.status = 'ativo'
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS customer_members_user_one_active
  ON public.customer_members(user_id)
  WHERE status = 'ativo';
