-- profiles.user_id -> auth.users.id ON DELETE CASCADE
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_roles.user_id -> auth.users.id ON DELETE CASCADE
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- customers.owner_user_id -> auth.users.id ON DELETE CASCADE
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_owner_user_id_fkey;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;