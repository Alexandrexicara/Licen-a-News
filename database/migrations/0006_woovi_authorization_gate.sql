ALTER TABLE user_woovi_accounts
  ADD COLUMN IF NOT EXISTS consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_destination_hint text,
  ADD COLUMN IF NOT EXISTS payout_permission_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_permission_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_test_correlation_id text,
  ADD COLUMN IF NOT EXISTS payout_test_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS woovi_authorization_audit (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  action text NOT NULL,
  consent_version text,
  destination_hint text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS woovi_authorization_audit_user_created_idx
  ON woovi_authorization_audit(user_id, created_at DESC);
