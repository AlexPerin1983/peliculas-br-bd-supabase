import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const DEFAULT_REMINDER_MINUTES = 30;
const DEFAULT_DAILY_SUMMARY_TIME = '18:00';
const SERVICE_WORKER_READY_TIMEOUT_MS = 8000;

export interface AgendaPushState {
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    hasPublicKey: boolean;
    subscribed: boolean;
    reminderMinutes: number;
    dailySummaryEnabled: boolean;
    dailySummaryTime: string;
}

export const MIN_REMINDER_MINUTES = 1;
export const MAX_REMINDER_MINUTES = 10080;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

export function isAgendaPushSupported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && typeof Notification !== 'undefined';
}

async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
    if (!isAgendaPushSupported()) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;

    return registration.pushManager.getSubscription();
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Service worker ainda nao esta pronto.')), SERVICE_WORKER_READY_TIMEOUT_MS);
    });

    return Promise.race([navigator.serviceWorker.ready, timeout]);
}

async function persistSubscription(subscription: PushSubscription, enabled: boolean): Promise<void> {
    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
        throw new Error('Nao foi possivel ler os dados da notificacao deste dispositivo.');
    }

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error('Faça login para ativar os alertas da agenda.');
    }

    // reminder_minutes is intentionally omitted so toggling alerts never resets
    // a previously chosen reminder time (new rows fall back to the DB default).
    const { error } = await supabase
        .from('agenda_push_subscriptions')
        .upsert(
            {
                user_id: user.id,
                endpoint,
                p256dh,
                auth,
                enabled,
                user_agent: navigator.userAgent,
                last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'endpoint' }
        );

    if (error) {
        throw new Error(error.message || 'Nao foi possivel salvar este dispositivo para alertas.');
    }
}

async function getStoredSubscriptionPreferences(subscription: PushSubscription | null): Promise<Pick<AgendaPushState, 'reminderMinutes' | 'dailySummaryEnabled' | 'dailySummaryTime'>> {
    const defaults = {
        reminderMinutes: DEFAULT_REMINDER_MINUTES,
        dailySummaryEnabled: false,
        dailySummaryTime: DEFAULT_DAILY_SUMMARY_TIME,
    };

    if (!subscription) return defaults;

    const { data, error } = await supabase
        .from('agenda_push_subscriptions')
        .select('reminder_minutes,daily_summary_enabled,daily_summary_time')
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();

    if (error || !data) return defaults;

    return {
        reminderMinutes: Number.isFinite(Number(data.reminder_minutes))
            ? Number(data.reminder_minutes)
            : DEFAULT_REMINDER_MINUTES,
        dailySummaryEnabled: Boolean(data.daily_summary_enabled),
        dailySummaryTime: typeof data.daily_summary_time === 'string'
            ? data.daily_summary_time.slice(0, 5)
            : DEFAULT_DAILY_SUMMARY_TIME,
    };
}

function validateSummaryTime(time: string): string {
    if (!/^\d{2}:\d{2}$/.test(time)) {
        throw new Error('Escolha um horario valido para o resumo.');
    }

    const [hours, minutes] = time.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('Escolha um horario valido para o resumo.');
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export async function getAgendaPushState(): Promise<AgendaPushState> {
    if (!isAgendaPushSupported()) {
        return {
            supported: false,
            permission: 'unsupported',
            hasPublicKey: Boolean(VAPID_PUBLIC_KEY),
            subscribed: false,
            reminderMinutes: DEFAULT_REMINDER_MINUTES,
            dailySummaryEnabled: false,
            dailySummaryTime: DEFAULT_DAILY_SUMMARY_TIME,
        };
    }

    const subscription = await getCurrentPushSubscription();
    const preferences = await getStoredSubscriptionPreferences(subscription);

    return {
        supported: true,
        permission: Notification.permission,
        hasPublicKey: Boolean(VAPID_PUBLIC_KEY),
        subscribed: Boolean(subscription),
        ...preferences,
    };
}

export async function enableAgendaPushNotifications(): Promise<AgendaPushState> {
    if (!isAgendaPushSupported()) {
        throw new Error('Este navegador nao suporta notificacoes push.');
    }

    if (!VAPID_PUBLIC_KEY) {
        throw new Error('A chave publica de notificacao ainda nao foi configurada.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Permissao de notificacao nao concedida.');
    }

    const registration = await getReadyServiceWorkerRegistration();
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await persistSubscription(subscription, true);
    return getAgendaPushState();
}

export async function disableAgendaPushNotifications(): Promise<AgendaPushState> {
    const subscription = await getCurrentPushSubscription();

    if (subscription) {
        await persistSubscription(subscription, false);
        await subscription.unsubscribe();
    }

    return getAgendaPushState();
}

export async function updateAgendaPushReminderMinutes(minutes: number): Promise<AgendaPushState> {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) {
        throw new Error('Ative os alertas da agenda antes de escolher o tempo.');
    }

    const normalizedMinutes = Math.round(Number(minutes));
    if (!Number.isFinite(normalizedMinutes) || normalizedMinutes < MIN_REMINDER_MINUTES || normalizedMinutes > MAX_REMINDER_MINUTES) {
        throw new Error('Escolha um tempo de antecedencia valido.');
    }

    const { error } = await supabase
        .from('agenda_push_subscriptions')
        .update({
            reminder_minutes: normalizedMinutes,
            last_seen_at: new Date().toISOString(),
        })
        .eq('endpoint', subscription.endpoint);

    if (error) {
        throw new Error(error.message || 'Nao foi possivel salvar o tempo de antecedencia.');
    }

    return getAgendaPushState();
}

export async function updateAgendaPushDailySummary(enabled: boolean, time: string): Promise<AgendaPushState> {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) {
        throw new Error('Ative os alertas da agenda antes de configurar o resumo.');
    }

    const normalizedTime = validateSummaryTime(time);
    const { error } = await supabase
        .from('agenda_push_subscriptions')
        .update({
            daily_summary_enabled: enabled,
            daily_summary_time: normalizedTime,
            last_seen_at: new Date().toISOString(),
        })
        .eq('endpoint', subscription.endpoint);

    if (error) {
        throw new Error(error.message || 'Nao foi possivel salvar o resumo diario.');
    }

    return getAgendaPushState();
}

export async function sendAgendaPushTest(): Promise<void> {
    const { data, error } = await supabase.functions.invoke('agenda-push-reminders', {
        body: { type: 'test' },
    });

    if (error) {
        throw new Error(error.message || 'Nao foi possivel enviar o teste.');
    }

    if (!data?.success) {
        throw new Error(data?.error || 'Nao foi possivel enviar o teste.');
    }

    if (!data.sent) {
        throw new Error('Nenhum dispositivo ativo encontrado para testar.');
    }
}

export async function sendAgendaPushDailySummaryTest(): Promise<void> {
    const { data, error } = await supabase.functions.invoke('agenda-push-reminders', {
        body: { type: 'daily-summary-test' },
    });

    if (error) {
        throw new Error(error.message || 'Nao foi possivel enviar o resumo de teste.');
    }

    if (!data?.success) {
        throw new Error(data?.error || 'Nao foi possivel enviar o resumo de teste.');
    }

    if (!data.sent) {
        throw new Error('Nenhum dispositivo ativo recebeu o resumo de teste.');
    }
}
