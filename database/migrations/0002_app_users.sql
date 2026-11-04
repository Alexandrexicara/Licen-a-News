-- Identidades e autenticação do Licença News.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_users (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
 disabled_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.license_orders ALTER COLUMN stripe_account_id DROP NOT NULL;
COMMIT;
