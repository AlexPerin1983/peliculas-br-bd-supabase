-- Modelos editáveis do "Para acompanhar hoje": o mesmo cadastro de modelos da
-- proposta, marcando a qual situação do acompanhamento o texto pertence.
-- Sem modelo salvo para uma situação, o app usa o texto padrão.

ALTER TABLE proposal_message_templates
    ADD COLUMN IF NOT EXISTS follow_up_step text
    CHECK (follow_up_step IS NULL OR follow_up_step IN ('not_opened', 'hot', 'value', 'expiring', 'expired'));

CREATE INDEX IF NOT EXISTS idx_proposal_message_templates_follow_up
    ON proposal_message_templates (organization_id, follow_up_step)
    WHERE follow_up_step IS NOT NULL;
