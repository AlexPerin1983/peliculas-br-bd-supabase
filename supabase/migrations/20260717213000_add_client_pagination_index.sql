-- Suporta a lista paginada de clientes: fixados primeiro e, em seguida,
-- os cadastros alterados mais recentemente.
DO $$
BEGIN
    IF to_regclass('public.clients') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'last_updated'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'pinned'
       ) THEN
        CREATE INDEX IF NOT EXISTS idx_clients_user_pinned_updated
            ON public.clients (user_id, pinned DESC, last_updated DESC, id DESC);
    END IF;
END
$$;
