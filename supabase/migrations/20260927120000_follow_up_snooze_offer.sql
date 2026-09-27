-- "Lembrar depois" (o cliente pediu para chamar em outra data) e registro da
-- condição especial oferecida, no histórico de acompanhamento do link.
ALTER TABLE public.proposal_portal_follow_ups ADD COLUMN IF NOT EXISTS remind_at timestamptz;

ALTER TABLE public.proposal_portal_follow_ups DROP CONSTRAINT IF EXISTS proposal_portal_follow_ups_kind_check;
ALTER TABLE public.proposal_portal_follow_ups ADD CONSTRAINT proposal_portal_follow_ups_kind_check
    CHECK (kind IN ('contact', 'lost', 'reopened', 'snooze', 'offer'));

ALTER TABLE public.proposal_portal_follow_ups DROP CONSTRAINT IF EXISTS proposal_portal_follow_ups_snooze_check;
ALTER TABLE public.proposal_portal_follow_ups ADD CONSTRAINT proposal_portal_follow_ups_snooze_check
    CHECK (kind <> 'snooze' OR remind_at IS NOT NULL);
