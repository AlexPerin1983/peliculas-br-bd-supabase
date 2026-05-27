CREATE OR REPLACE FUNCTION public.sync_agendamento_time_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.start := COALESCE(NEW.start, NEW.start_time);
    NEW."end" := COALESCE(NEW."end", NEW.end_time);
    NEW.start_time := COALESCE(NEW.start_time, NEW.start);
    NEW.end_time := COALESCE(NEW.end_time, NEW."end");

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agendamento_time_columns
    ON public.agendamentos;

CREATE TRIGGER trg_sync_agendamento_time_columns
    BEFORE INSERT OR UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_agendamento_time_columns();

UPDATE public.agendamentos
   SET start = COALESCE(start, start_time),
       "end" = COALESCE("end", end_time),
       start_time = COALESCE(start_time, start),
       end_time = COALESCE(end_time, "end")
 WHERE start IS NULL
    OR "end" IS NULL
    OR start_time IS NULL
    OR end_time IS NULL;
