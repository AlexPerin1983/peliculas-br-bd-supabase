-- Indices de baixo risco para as leituras mais frequentes do aplicativo.
-- O schema legado pode variar entre ambientes. Cada indice e criado somente
-- quando a tabela e todas as colunas necessarias existem.

DO $$
BEGIN
    IF to_regclass('public.clients') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'pinned')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'nome') THEN
        CREATE INDEX IF NOT EXISTS idx_clients_user_pinned_name ON public.clients (user_id, pinned DESC, nome);
    END IF;

    IF to_regclass('public.saved_pdfs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_pdfs' AND column_name = 'user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_pdfs' AND column_name = 'date') THEN
        CREATE INDEX IF NOT EXISTS idx_saved_pdfs_user_date ON public.saved_pdfs (user_id, date DESC);
    END IF;

    IF to_regclass('public.agendamentos') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'start') THEN
        CREATE INDEX IF NOT EXISTS idx_agendamentos_user_start ON public.agendamentos (user_id, start);
    END IF;

    IF to_regclass('public.bobinas') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bobinas' AND column_name = 'user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bobinas' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bobinas' AND column_name = 'data_cadastro') THEN
        CREATE INDEX IF NOT EXISTS idx_bobinas_user_status_created ON public.bobinas (user_id, status, data_cadastro DESC);
    END IF;

    IF to_regclass('public.retalhos') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retalhos' AND column_name = 'user_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retalhos' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retalhos' AND column_name = 'data_cadastro') THEN
        CREATE INDEX IF NOT EXISTS idx_retalhos_user_status_created ON public.retalhos (user_id, status, data_cadastro DESC);
    END IF;
END
$$;
