alter table public.saved_pdfs
    add column if not exists payment_config jsonb;

alter table public.proposal_portal_messages
    add column if not exists payment_selection jsonb;

comment on column public.saved_pdfs.payment_config is
    'Snapshot das condições de pagamento vigentes quando a proposta foi gerada.';

comment on column public.proposal_portal_messages.payment_selection is
    'Condição de pagamento escolhida pelo cliente e recalculada pelo servidor.';
