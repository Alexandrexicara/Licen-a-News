BEGIN;

CREATE TABLE IF NOT EXISTS public.publisher_sicoob_accounts (
  user_id TEXT PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  client_id_encrypted TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  pfx_encrypted TEXT NOT NULL,
  pfx_password_encrypted TEXT NOT NULL,
  pix_key_encrypted TEXT NOT NULL,
  pix_key_type TEXT NOT NULL CHECK (pix_key_type IN ('CPF','CNPJ','EMAIL','PHONE','EVP')),
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  webhook_token_hash TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  webhook_registered_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.license_orders
  ADD COLUMN IF NOT EXISTS sicoob_publisher_user_id TEXT,
  ADD COLUMN IF NOT EXISTS sicoob_payment_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS license_orders_sicoob_publisher_idx
  ON public.license_orders (sicoob_publisher_user_id, sicoob_txid);

COMMIT;
