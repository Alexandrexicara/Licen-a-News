BEGIN;
ALTER TABLE public.license_orders DROP CONSTRAINT IF EXISTS license_orders_status_check;
ALTER TABLE public.license_orders ADD CONSTRAINT license_orders_status_check CHECK(status IN ('pending','accepted','declined','paid','failed','refunded','disputed','cancelled'));
ALTER TABLE public.license_orders ADD COLUMN IF NOT EXISTS buyer_message TEXT;
ALTER TABLE public.license_orders ADD COLUMN IF NOT EXISTS publisher_response TEXT;

CREATE TABLE IF NOT EXISTS public.publisher_pix_accounts(
 user_id TEXT PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
 pix_key_encrypted TEXT NOT NULL,
 pix_key_iv TEXT NOT NULL,
 pix_key_tag TEXT NOT NULL,
 pix_key_type TEXT NOT NULL CHECK(pix_key_type IN ('CPF','CNPJ','EMAIL','PHONE','EVP')),
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.license_orders
 ADD COLUMN IF NOT EXISTS sicoob_txid TEXT UNIQUE,
 ADD COLUMN IF NOT EXISTS sicoob_status TEXT,
 ADD COLUMN IF NOT EXISTS sicoob_payload JSONB,
 ADD COLUMN IF NOT EXISTS sicoob_end_to_end_id TEXT,
 ADD COLUMN IF NOT EXISTS sicoob_br_code TEXT,
 ADD COLUMN IF NOT EXISTS sicoob_qr_code_image TEXT;
CREATE TABLE IF NOT EXISTS public.sicoob_webhook_events(
 id BIGSERIAL PRIMARY KEY,
 provider_event_id TEXT UNIQUE NOT NULL,
 event_type TEXT NOT NULL,
 txid TEXT,
 payload JSONB NOT NULL,
 processed_at TIMESTAMPTZ,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
