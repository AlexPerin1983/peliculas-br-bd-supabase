CREATE TABLE IF NOT EXISTS public.agenda_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    reminder_minutes INTEGER NOT NULL DEFAULT 30 CHECK (reminder_minutes BETWEEN 1 AND 10080),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_push_subscriptions_user_id
    ON public.agenda_push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_agenda_push_subscriptions_organization_id
    ON public.agenda_push_subscriptions(organization_id);

CREATE INDEX IF NOT EXISTS idx_agenda_push_subscriptions_enabled
    ON public.agenda_push_subscriptions(enabled)
    WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS public.agenda_push_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id BIGINT NOT NULL,
    subscription_id UUID NOT NULL REFERENCES public.agenda_push_subscriptions(id) ON DELETE CASCADE,
    reminder_minutes INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agendamento_id, subscription_id, reminder_minutes)
);

CREATE INDEX IF NOT EXISTS idx_agenda_push_deliveries_agendamento_id
    ON public.agenda_push_deliveries(agendamento_id);

CREATE OR REPLACE FUNCTION public.set_agenda_push_subscription_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.user_id := COALESCE(NEW.user_id, auth.uid());
        NEW.created_at := COALESCE(NEW.created_at, NOW());
    END IF;

    IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'agenda_push_subscriptions.user_id must match authenticated user';
    END IF;

    SELECT p.organization_id
      INTO NEW.organization_id
      FROM public.profiles p
     WHERE p.id = NEW.user_id;

    NEW.updated_at := NOW();
    NEW.last_seen_at := COALESCE(NEW.last_seen_at, NOW());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agenda_push_subscription_context
    ON public.agenda_push_subscriptions;

CREATE TRIGGER trg_set_agenda_push_subscription_context
    BEFORE INSERT OR UPDATE ON public.agenda_push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_agenda_push_subscription_context();

ALTER TABLE public.agenda_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_push_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agenda push subscriptions"
    ON public.agenda_push_subscriptions;
CREATE POLICY "Users can view own agenda push subscriptions"
    ON public.agenda_push_subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own agenda push subscriptions"
    ON public.agenda_push_subscriptions;
CREATE POLICY "Users can insert own agenda push subscriptions"
    ON public.agenda_push_subscriptions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own agenda push subscriptions"
    ON public.agenda_push_subscriptions;
CREATE POLICY "Users can update own agenda push subscriptions"
    ON public.agenda_push_subscriptions
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own agenda push subscriptions"
    ON public.agenda_push_subscriptions;
CREATE POLICY "Users can delete own agenda push subscriptions"
    ON public.agenda_push_subscriptions
    FOR DELETE
    USING (user_id = auth.uid());
