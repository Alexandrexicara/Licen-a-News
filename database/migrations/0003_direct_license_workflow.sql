-- Fluxo de autorização direta entre comprador e titular, sem pagamentos na plataforma.
BEGIN;
ALTER TABLE public.license_orders ALTER COLUMN stripe_account_id DROP NOT NULL;
ALTER TABLE public.license_orders DROP CONSTRAINT IF EXISTS license_orders_status_check;
ALTER TABLE public.license_orders ADD CONSTRAINT license_orders_status_check
 CHECK (status = ANY (ARRAY['pending','accepted','declined','cancelled','paid','failed','refunded','disputed']));
ALTER TABLE public.license_orders ADD COLUMN IF NOT EXISTS buyer_message TEXT;
ALTER TABLE public.license_orders ADD COLUMN IF NOT EXISTS publisher_response TEXT;
COMMIT;
