-- Licença News: schema PostgreSQL versionado a partir do banco Neon existente.
-- Aplicar somente em banco novo; não executar sobre o banco já provisionado.
BEGIN;

CREATE TABLE IF NOT EXISTS public."publisher_profiles" (
  "id" BIGSERIAL NOT NULL,
  "user_id" TEXT NOT NULL,
  "account_type" TEXT NOT NULL,
  "organization_name" TEXT,
  "document_number_encrypted" TEXT,
  "website_url" TEXT,
  "contact_phone" TEXT,
  "verification_status" TEXT NOT NULL DEFAULT 'pending'::text,
  "verification_notes" TEXT,
  "rights_declaration" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "publisher_profiles_account_type_check" CHECK ((account_type = ANY (ARRAY['journalist'::text, 'publisher'::text, 'influencer'::text, 'buyer'::text, 'both'::text]))),
  CONSTRAINT "publisher_profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "publisher_profiles_user_id_key" UNIQUE (user_id),
  CONSTRAINT "publisher_profiles_verification_status_check" CHECK ((verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])))
);

CREATE TABLE IF NOT EXISTS public."publisher_payment_accounts" (
  "id" BIGSERIAL NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe'::text,
  "provider_account_id" TEXT NOT NULL,
  "country_code" CHARACTER NOT NULL DEFAULT 'BR'::bpchar,
  "default_currency" CHARACTER NOT NULL DEFAULT 'BRL'::bpchar,
  "account_type" TEXT NOT NULL DEFAULT 'express'::text,
  "details_submitted" BOOLEAN NOT NULL DEFAULT false,
  "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
  "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
  "onboarding_status" TEXT NOT NULL DEFAULT 'pending'::text,
  "requirements_due" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "last_provider_event_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "publisher_payment_accounts_onboarding_status_check" CHECK ((onboarding_status = ANY (ARRAY['pending'::text, 'restricted'::text, 'enabled'::text, 'rejected'::text]))),
  CONSTRAINT "publisher_payment_accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "publisher_payment_accounts_provider_account_id_key" UNIQUE (provider_account_id),
  CONSTRAINT "publisher_payment_accounts_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public."content_items" (
  "id" BIGSERIAL NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "canonical_url" TEXT,
  "asset_url" TEXT,
  "source_name" TEXT,
  "author_name" TEXT,
  "rights_evidence_url" TEXT,
  "rights_declaration" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_review'::text,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "content_items_content_type_check" CHECK ((content_type = ANY (ARRAY['article'::text, 'photo'::text, 'video'::text, 'audio'::text]))),
  CONSTRAINT "content_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "content_items_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])))
);
CREATE INDEX IF NOT EXISTS content_items_owner_status_idx ON public.content_items USING btree (owner_user_id, status);

CREATE TABLE IF NOT EXISTS public."license_offers" (
  "id" BIGSERIAL NOT NULL,
  "content_id" BIGINT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "price_cents" BIGINT NOT NULL,
  "currency" CHARACTER NOT NULL DEFAULT 'BRL'::bpchar,
  "territory" TEXT NOT NULL DEFAULT 'BR'::text,
  "duration_days" INTEGER NOT NULL,
  "exclusive" BOOLEAN NOT NULL DEFAULT false,
  "terms" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "license_offers_content_id_fkey" FOREIGN KEY (content_id) REFERENCES content_items(id),
  CONSTRAINT "license_offers_duration_days_check" CHECK (((duration_days >= 1) AND (duration_days <= 3650))),
  CONSTRAINT "license_offers_pkey" PRIMARY KEY (id),
  CONSTRAINT "license_offers_price_cents_check" CHECK ((price_cents > 0)),
  CONSTRAINT "license_offers_purpose_check" CHECK ((purpose = ANY (ARRAY['indexing'::text, 'summary'::text, 'snippet'::text, 'reproduction'::text, 'ai_training'::text])))
);
CREATE INDEX IF NOT EXISTS license_offers_catalog_idx ON public.license_offers USING btree (active, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS public."license_orders" (
  "id" BIGSERIAL NOT NULL,
  "offer_id" BIGINT NOT NULL,
  "buyer_user_id" TEXT NOT NULL,
  "publisher_user_id" TEXT NOT NULL,
  "stripe_account_id" TEXT NOT NULL,
  "currency" CHARACTER NOT NULL DEFAULT 'BRL'::bpchar,
  "gross_amount_cents" BIGINT NOT NULL,
  "platform_fee_cents" BIGINT NOT NULL,
  "creator_net_cents" BIGINT NOT NULL,
  "stripe_payment_intent_id" TEXT,
  "stripe_checkout_session_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "accepted_terms_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "paid_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "license_orders_check" CHECK (((platform_fee_cents + creator_net_cents) = gross_amount_cents)),
  CONSTRAINT "license_orders_creator_net_cents_check" CHECK ((creator_net_cents >= 0)),
  CONSTRAINT "license_orders_gross_amount_cents_check" CHECK ((gross_amount_cents > 0)),
  CONSTRAINT "license_orders_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES license_offers(id),
  CONSTRAINT "license_orders_pkey" PRIMARY KEY (id),
  CONSTRAINT "license_orders_platform_fee_cents_check" CHECK ((platform_fee_cents >= 0)),
  CONSTRAINT "license_orders_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'disputed'::text, 'cancelled'::text]))),
  CONSTRAINT "license_orders_stripe_checkout_session_id_key" UNIQUE (stripe_checkout_session_id),
  CONSTRAINT "license_orders_stripe_payment_intent_id_key" UNIQUE (stripe_payment_intent_id)
);
CREATE INDEX IF NOT EXISTS license_orders_buyer_idx ON public.license_orders USING btree (buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS license_orders_publisher_idx ON public.license_orders USING btree (publisher_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public."issued_licenses" (
  "id" BIGSERIAL NOT NULL,
  "order_id" BIGINT NOT NULL,
  "license_code" TEXT NOT NULL,
  "content_id" BIGINT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "buyer_user_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "territory" TEXT NOT NULL,
  "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "issued_licenses_content_id_fkey" FOREIGN KEY (content_id) REFERENCES content_items(id),
  CONSTRAINT "issued_licenses_license_code_key" UNIQUE (license_code),
  CONSTRAINT "issued_licenses_order_id_fkey" FOREIGN KEY (order_id) REFERENCES license_orders(id),
  CONSTRAINT "issued_licenses_order_id_key" UNIQUE (order_id),
  CONSTRAINT "issued_licenses_pkey" PRIMARY KEY (id),
  CONSTRAINT "issued_licenses_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'suspended'::text])))
);
CREATE INDEX IF NOT EXISTS issued_licenses_buyer_idx ON public.issued_licenses USING btree (buyer_user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS issued_licenses_owner_idx ON public.issued_licenses USING btree (owner_user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS public."stripe_webhook_events" (
  "id" BIGSERIAL NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "connected_account_id" TEXT,
  "payload" JSONB NOT NULL,
  "processed_at" TIMESTAMP WITH TIME ZONE,
  "processing_error" TEXT,
  "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "stripe_webhook_events_provider_event_id_key" UNIQUE (provider_event_id)
);

CREATE TABLE IF NOT EXISTS public."api_credentials" (
  "id" BIGSERIAL NOT NULL,
  "user_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "last_used_at" TIMESTAMP WITH TIME ZONE,
  "revoked_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "api_credentials_key_hash_key" UNIQUE (key_hash),
  CONSTRAINT "api_credentials_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."platform_ledger" (
  "id" BIGSERIAL NOT NULL,
  "order_id" BIGINT NOT NULL,
  "entry_type" TEXT NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "currency" CHARACTER NOT NULL DEFAULT 'BRL'::bpchar,
  "provider_reference" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "platform_ledger_entry_type_check" CHECK ((entry_type = ANY (ARRAY['application_fee'::text, 'refund'::text, 'chargeback'::text, 'adjustment'::text]))),
  CONSTRAINT "platform_ledger_order_id_fkey" FOREIGN KEY (order_id) REFERENCES license_orders(id),
  CONSTRAINT "platform_ledger_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."audit_logs" (
  "id" BIGSERIAL NOT NULL,
  "actor_user_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);
COMMIT;

-- Auth identity tables will be added with the chosen authentication provider.