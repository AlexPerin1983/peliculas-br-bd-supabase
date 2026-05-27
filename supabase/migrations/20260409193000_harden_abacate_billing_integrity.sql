DO $$
DECLARE
    activation_unique_constraint TEXT;
BEGIN
    SELECT conname
    INTO activation_unique_constraint
    FROM pg_constraint
    WHERE conrelid = 'module_activations'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%subscription_id, module_id%';

    IF activation_unique_constraint IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE module_activations DROP CONSTRAINT %I',
            activation_unique_constraint
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_activations_subscription_module_created
    ON module_activations(subscription_id, module_id, created_at DESC);

ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS payment_provider TEXT,
ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;

UPDATE payment_history
SET payment_provider = COALESCE(payment_provider, 'manual');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_provider_payment_unique
    ON payment_history(payment_provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;
