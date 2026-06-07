import React, { useEffect, useState } from 'react';
import {
    AgendaPushState,
    disableAgendaPushNotifications,
    enableAgendaPushNotifications,
    getAgendaPushState,
    sendAgendaPushDailySummaryTest,
    sendAgendaPushTest,
    updateAgendaPushDailySummary,
    updateAgendaPushReminderMinutes,
} from '../../services/agendaPushNotifications';

const REMINDER_OPTIONS: { value: number; label: string }[] = [
    { value: 10, label: '10 minutos antes' },
    { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' },
    { value: 45, label: '45 minutos antes' },
    { value: 60, label: '1 hora antes' },
    { value: 120, label: '2 horas antes' },
    { value: 180, label: '3 horas antes' },
    { value: 1440, label: '1 dia antes' },
];

const formatReminderLabel = (minutes: number): string => {
    if (minutes % 1440 === 0) {
        const days = minutes / 1440;
        return days === 1 ? '1 dia antes' : `${days} dias antes`;
    }
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        return hours === 1 ? '1h antes' : `${hours}h antes`;
    }
    return `${minutes}min antes`;
};

const getStatusText = (state: AgendaPushState | null, errorMessage: string | null, successMessage: string | null) => {
    if (errorMessage) return errorMessage;
    if (successMessage) return successMessage;
    if (!state) return 'Verificando';
    if (!state.supported) return 'Indisponivel neste navegador';
    if (!state.hasPublicKey) return 'Configuracao pendente';
    if (state.permission === 'denied') return 'Bloqueado no navegador';
    if (state.subscribed && state.dailySummaryEnabled) return `Ativo ${formatReminderLabel(state.reminderMinutes)} + resumo ${state.dailySummaryTime}`;
    if (state.subscribed) return `Ativo ${formatReminderLabel(state.reminderMinutes)}`;
    return 'Desativado';
};

const AgendaPushReminderControl: React.FC = () => {
    const [state, setState] = useState<AgendaPushState | null>(null);
    const [busyAction, setBusyAction] = useState<'toggle' | 'test' | 'reminder' | 'summary' | 'summaryTest' | null>(null);
    const [summaryTime, setSummaryTime] = useState('18:00');
    const [reminderMinutes, setReminderMinutes] = useState(30);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const refreshState = async () => {
        try {
            setState(await getAgendaPushState());
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel verificar alertas.');
        }
    };

    useEffect(() => {
        refreshState();
    }, []);

    useEffect(() => {
        if (state?.dailySummaryTime) {
            setSummaryTime(state.dailySummaryTime);
        }
    }, [state?.dailySummaryTime]);

    useEffect(() => {
        if (typeof state?.reminderMinutes === 'number') {
            setReminderMinutes(state.reminderMinutes);
        }
    }, [state?.reminderMinutes]);

    const handleToggle = async () => {
        setBusyAction('toggle');
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const nextState = state?.subscribed
                ? await disableAgendaPushNotifications()
                : await enableAgendaPushNotifications();
            setState(nextState);
            setSuccessMessage(nextState.subscribed ? `Ativo ${formatReminderLabel(nextState.reminderMinutes)}` : 'Alertas desativados');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar alertas.');
            await refreshState();
        } finally {
            setBusyAction(null);
        }
    };

    const handleTest = async () => {
        setBusyAction('test');
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            await sendAgendaPushTest();
            setSuccessMessage('Teste enviado para este celular');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel enviar o teste.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleReminderSave = async (minutes: number) => {
        setReminderMinutes(minutes);
        setBusyAction('reminder');
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const nextState = await updateAgendaPushReminderMinutes(minutes);
            setState(nextState);
            setSuccessMessage(`Alertas ${formatReminderLabel(nextState.reminderMinutes)}`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o tempo.');
            await refreshState();
        } finally {
            setBusyAction(null);
        }
    };

    const handleSummarySave = async (enabled: boolean) => {
        setBusyAction('summary');
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const nextState = await updateAgendaPushDailySummary(enabled, summaryTime);
            setState(nextState);
            setSuccessMessage(enabled
                ? `Resumo diario ativo as ${nextState.dailySummaryTime}`
                : 'Resumo diario desativado');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o resumo.');
            await refreshState();
        } finally {
            setBusyAction(null);
        }
    };

    const handleSummaryTest = async () => {
        setBusyAction('summaryTest');
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            await sendAgendaPushDailySummaryTest();
            setSuccessMessage('Resumo de teste enviado');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel enviar o resumo de teste.');
        } finally {
            setBusyAction(null);
        }
    };

    const isActionDisabled = Boolean(busyAction)
        || !state
        || !state.supported
        || !state.hasPublicKey
        || state.permission === 'denied';
    const isEnabled = Boolean(state?.subscribed);

    return (
        <div className="mb-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${isEnabled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'}`}>
                        <i className="far fa-bell text-sm" aria-hidden="true"></i>
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black leading-tight text-[var(--text-strong)]">Alertas</p>
                        <p className="truncate text-xs font-semibold text-[var(--text-muted)]">{getStatusText(state, errorMessage, successMessage)}</p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {isEnabled ? (
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isActionDisabled}
                            className="inline-flex h-8 items-center justify-center rounded-[var(--radius-control)] bg-emerald-600 px-3 text-xs font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            {busyAction === 'test' ? '...' : 'Testar'}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={handleToggle}
                        disabled={isActionDisabled}
                        className={`inline-flex h-8 items-center justify-center rounded-[var(--radius-control)] px-3 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${isEnabled ? 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-strong)] hover:bg-[var(--surface)]' : 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-strong)]'}`}
                    >
                        {busyAction === 'toggle' ? '...' : isEnabled ? 'Desativar' : 'Ativar'}
                    </button>
                    {isEnabled ? (
                        <button
                            type="button"
                            onClick={() => setIsExpanded((prev) => !prev)}
                            aria-label={isExpanded ? 'Recolher configuracoes de alerta' : 'Expandir configuracoes de alerta'}
                            aria-expanded={isExpanded}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-strong)]"
                        >
                            <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true"></i>
                        </button>
                    ) : null}
                </div>
            </div>

            {isEnabled && isExpanded ? (
                <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-[var(--text-muted)]">Antecedencia do alerta</p>
                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                            Quando avisar antes de cada atendimento
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <select
                            value={reminderMinutes}
                            onChange={(event) => handleReminderSave(Number(event.target.value))}
                            disabled={isActionDisabled}
                            className="h-9 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm font-black text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-55"
                            aria-label="Tempo de antecedencia do alerta"
                        >
                            {REMINDER_OPTIONS.some((option) => option.value === reminderMinutes)
                                ? null
                                : <option value={reminderMinutes}>{formatReminderLabel(reminderMinutes)}</option>}
                            {REMINDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        {busyAction === 'reminder' ? (
                            <span className="text-xs font-bold text-[var(--text-muted)]">...</span>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {isEnabled && isExpanded ? (
                <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-[var(--text-muted)]">Resumo de amanha</p>
                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                            {state?.dailySummaryEnabled
                                ? `Envia todo dia as ${state.dailySummaryTime}`
                                : 'Receba a lista de agendas do dia seguinte'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <input
                            type="time"
                            step="300"
                            value={summaryTime}
                            onChange={(event) => setSummaryTime(event.target.value)}
                            disabled={Boolean(busyAction)}
                            className="h-9 w-28 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm font-black text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] disabled:opacity-55"
                            aria-label="Horario do resumo diario"
                        />
                        <button
                            type="button"
                            onClick={() => handleSummarySave(true)}
                            disabled={isActionDisabled}
                            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-3 text-xs font-black text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            {busyAction === 'summary' ? '...' : state?.dailySummaryEnabled ? 'Salvar' : 'Ativar'}
                        </button>
                        {state?.dailySummaryEnabled ? (
                            <button
                                type="button"
                                onClick={() => handleSummarySave(false)}
                                disabled={isActionDisabled}
                                className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-xs font-black text-[var(--text-strong)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                Off
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={handleSummaryTest}
                            disabled={isActionDisabled}
                            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-emerald-500/40 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-55 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                            {busyAction === 'summaryTest' ? '...' : 'Testar resumo'}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default AgendaPushReminderControl;
