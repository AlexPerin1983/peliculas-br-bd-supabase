-- Links publicos mais curtos para propostas.
-- O token antigo continua valido para preservar todos os links ja enviados.

ALTER TABLE public.proposal_portals
    ADD COLUMN IF NOT EXISTS share_code text;

UPDATE public.proposal_portals
SET share_code = translate(rtrim(encode(extensions.gen_random_bytes(18), 'base64'), '='), '+/', '-_')
WHERE share_code IS NULL OR btrim(share_code) = '';

ALTER TABLE public.proposal_portals
    ALTER COLUMN share_code SET DEFAULT translate(rtrim(encode(extensions.gen_random_bytes(18), 'base64'), '='), '+/', '-_'),
    ALTER COLUMN share_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS proposal_portals_share_code_uidx
    ON public.proposal_portals (share_code);

