-- Organização da agenda: tipo do agendamento, título opcional e cor.
-- Sem cor gravada, a agenda usa a cor do tipo.
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS color text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.agendamentos'::regclass
          AND conname = 'agendamentos_event_type_check'
    ) THEN
        ALTER TABLE public.agendamentos
            ADD CONSTRAINT agendamentos_event_type_check
            CHECK (event_type IS NULL OR event_type IN ('consulta', 'instalacao', 'variado', 'outro'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.agendamentos'::regclass
          AND conname = 'agendamentos_title_length_check'
    ) THEN
        ALTER TABLE public.agendamentos
            ADD CONSTRAINT agendamentos_title_length_check
            CHECK (title IS NULL OR char_length(title) <= 120);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.agendamentos'::regclass
          AND conname = 'agendamentos_color_check'
    ) THEN
        ALTER TABLE public.agendamentos
            ADD CONSTRAINT agendamentos_color_check
            CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$');
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
