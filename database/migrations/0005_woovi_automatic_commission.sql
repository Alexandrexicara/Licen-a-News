-- Integração Woovi por jornalista: cobrança na conta do titular e comissão automática via Pix Out.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_woovi_accounts (
  user_id TEXT PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  app_id_encrypted TEXT NOT NULL,
  app_id_iv TEXT NOT NULL,
  app_id_tag TEXT NOT NULL,
  app_id_hint TEXT NOT NULL,
  webhook_hmac_encrypted TEXT NOT NULL,
  webhook_hmac_iv TEXT NOT NULL,
  webhook_hmac_tag TEXT NOT NULL,
  webhook_token_hash TEXT NOT NULL UNIQUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.license_orders
  ADD COLUMN IF NOT EXISTS woovi_charge_correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS woovi_charge_identifier TEXT,
  ADD COLUMN IF NOT EXISTS woovi_br_code TEXT,
  ADD COLUMN IF NOT EXISTS woovi_payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS woovi_paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS license_orders_woovi_correlation_uidx
  ON public.license_orders(woovi_charge_correlation_id)
  WHERE woovi_charge_correlation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.woovi_payouts (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES public.license_orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.app_users(id),
  correlation_id TEXT NOT NULL UNIQUE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','created','approved','confirmed','failed','needs_attention')),
  provider_reference TEXT,
  provider_end_to_end_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.woovi_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.app_users(id),
  event_type TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_type, correlation_id)
);

CREATE INDEX IF NOT EXISTS woovi_payouts_user_status_idx
  ON public.woovi_payouts(user_id, status, created_at DESC);

COMMIT;
