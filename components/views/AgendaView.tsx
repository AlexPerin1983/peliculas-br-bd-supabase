import React, { useMemo, useState } from 'react';
import { Agendamento, AgendamentoServiceStatus, Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import AgendaPushReminderControl from './AgendaPushReminderControl';

interface AgendaViewProps {
    agendamentos: Agendamento[];
    pdfs: SavedPDF[];
    clients: Client[];
    onEditAgendamento: (agendamento: Agendamento) => void;
    onUpdateServiceStatus: (agendamento: Agendamento, serviceStatus: AgendamentoServiceStatus) => void;
    onCreateNewAgendamento: (date: Date) => void;
}

type AgendamentoWithStatus = Agendamento & { status?: SavedPDF['status'] };

const SERVICE_STATUS_META: Record<AgendamentoServiceStatus, {
    text: string;
    iconClassName: string;
    badgeClasses: string;
}> = {
    scheduled: {
        text: 'Agendado',
        iconClassName: 'far fa-clock',
        badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-950/35 dark:text-blue-200',
    },
    completed: {
        text: 'Concluído',
        iconClassName: 'fas fa-check-circle',
        badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200',
    },
    cancelled: {
        text: 'Cancelado',
        iconClassName: 'fas fa-ban',
        badgeClasses: 'bg-rose-100 text-rose-800 dark:bg-rose-950/35 dark:text-rose-200',
    },
    no_show: {
        text: 'Não compareceu',
        iconClassName: 'fas fa-user-slash',
        badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200',
    },
};

const ServiceStatusBadge: React.FC<{ status: AgendamentoServiceStatus }> = ({ status }) => {
    const meta = SERVICE_STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${meta.badgeClasses}`}>
            <i className={`${meta.iconClassName} text-[10px]`} aria-hidden="true"></i>
            {meta.text}
        </span>
    );
};

const STATUS_META: Record<NonNullable<SavedPDF['status']>, {
    text: string;
    badgeClasses: string;
    dotClasses: string;
    railClasses: string;
}> = {
    approved: {
        text: 'Aprovado',
        badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200',
        dotClasses: 'bg-emerald-500',
        railClasses: 'bg-emerald-500',
    },
    revised: {
        text: 'Revisar',
        badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200',
        dotClasses: 'bg-amber-400',
        railClasses: 'bg-amber-400',
    },
    pending: {
        text: 'Pendente',
        badgeClasses: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        dotClasses: 'bg-slate-400',
        railClasses: 'bg-slate-300 dark:bg-slate-600',
    },
};

const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status = 'pending' }) => {
    const meta = STATUS_META[status] || STATUS_META.pending;

    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${meta.badgeClasses}`}>{meta.text}</span>;
};

const getStatusColor = (status?: SavedPDF['status']) => {
    return (STATUS_META[status || 'pending'] || STATUS_META.pending).dotClasses;
};

const formatFullAddress = (client?: Client): string => {
    if (!client) return '';
    const legacyAddress = (client as Client & { endereco?: string }).endereco?.trim();
    const parts = [client.logradouro, client.numero, client.complemento, client.bairro, client.cidade, client.uf, client.cep];
    const structuredAddress = parts
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');

    return structuredAddress || legacyAddress || '';
};

const getMapsDirectionsUrl = (address: string) => (
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`
);

const normalizePhone = (phone?: string) => {
    const digits = phone?.replace(/\D/g, '') || '';
    if (!digits) return '';

    return digits.startsWith('55') ? digits : `55${digits}`;
};

const getWhatsappUrl = (phone?: string) => {
    const normalizedPhone = normalizePhone(phone);
    return normalizedPhone ? `https://wa.me/${normalizedPhone}` : '';
};

const getTelUrl = (phone?: string) => {
    const digits = phone?.replace(/\D/g, '') || '';
    return digits ? `tel:${digits}` : '';
};

const formatTime = (value: string) => (
    new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
);

const getDurationLabel = (start: string, end: string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const minutes = Math.max(0, Math.round((endTime - startTime) / 60000));
    if (minutes === 0) return '0min';
    if (minutes < 60) return `${minutes}min`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes ? `${hours}h${String(remainingMinutes).padStart(2, '0')}` : `${hours}h`;
};

const sameMonth = (date: Date, reference: Date) => (
    date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
);

const AgendaActionLink: React.FC<{
    href: string;
    label: string;
    ariaLabel: string;
    iconClassName: string;
    tone?: 'neutral' | 'green' | 'blue';
    className?: string;
}> = ({ href, label, ariaLabel, iconClassName, tone = 'neutral', className = '' }) => {
    const toneClasses = {
        neutral: 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/25 dark:text-emerald-200 dark:hover:bg-emerald-900/35',
        blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/25 dark:text-blue-200 dark:hover:bg-blue-900/35',
    }[tone];

    return (
        <a
            href={href}
            target={href.startsWith('tel:') ? undefined : '_blank'}
            rel={href.startsWith('tel:') ? undefined : 'noreferrer'}
            onClick={(event) => event.stopPropagation()}
            aria-label={ariaLabel}
            className={`inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-xs font-bold transition-colors ${toneClasses} ${className}`}
        >
            <i className={`${iconClassName} text-[11px]`} aria-hidden="true"></i>
            <span className="truncate">{label}</span>
        </a>
    );
};

const RouteActionLink: React.FC<{
    address: string;
    clientName: string;
}> = ({ address, clientName }) => (
    <AgendaActionLink
        href={getMapsDirectionsUrl(address)}
        label="Navegar até endereço"
        ariaLabel={`Navegar até endereço de ${clientName}`}
        iconClassName="fas fa-location-arrow"
        tone="green"
        className="col-span-2 sm:col-span-1"
    />
);

const AppointmentCard: React.FC<{
    agendamento: AgendamentoWithStatus;
    client?: Client;
    onEdit: (agendamento: Agendamento) => void;
    onUpdateServiceStatus: (agendamento: Agendamento, serviceStatus: AgendamentoServiceStatus) => void;
}> = ({ agendamento, client, onEdit, onUpdateServiceStatus }) => {
    const status = agendamento.status || 'pending';
    const meta = STATUS_META[status] || STATUS_META.pending;
    const serviceStatus = agendamento.serviceStatus || 'scheduled';
    const hasEnded = new Date(agendamento.end).getTime() < Date.now();
    const showEndedPrompt = serviceStatus === 'scheduled' && hasEnded;
    const bairro = client?.bairro;
    const clientAddress = formatFullAddress(client);
    const telUrl = getTelUrl(client?.telefone);
    const whatsappUrl = getWhatsappUrl(client?.telefone);
    const startTime = formatTime(agendamento.start);
    const endTime = formatTime(agendamento.end);
    const duration = getDurationLabel(agendamento.start, agendamento.end);
    const hasActions = Boolean(telUrl || whatsappUrl || clientAddress);

    return (
        <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] text-left shadow-[var(--shadow-hairline)] transition-all duration-200 hover:shadow-[var(--shadow-soft)]">
            <button
                type="button"
                onClick={() => onEdit(agendamento)}
                className="group w-full p-3 text-left transition-colors hover:bg-[var(--surface-muted)] sm:p-4"
            >
                <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-3">
                    <div className="flex min-h-[74px] flex-col items-center justify-between rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-2 py-2 text-center">
                        <span className="text-sm font-black leading-none text-[var(--text-strong)]">{startTime}</span>
                        <span className={`my-1 h-5 w-0.5 rounded-full ${meta.railClasses}`} aria-hidden="true"></span>
                        <span className="text-sm font-black leading-none text-[var(--text-strong)]">{endTime}</span>
                    </div>

                    <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                            <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dotClasses}`} aria-hidden="true"></div>
                            <div className="min-w-0">
                                <p className="truncate text-base font-black leading-tight text-[var(--text-strong)] sm:text-lg">
                                    {agendamento.clienteNome}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <StatusBadge status={status} />
                                    {serviceStatus !== 'scheduled' ? <ServiceStatusBadge status={serviceStatus} /> : null}
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]">
                                        <i className="far fa-clock text-[10px]" aria-hidden="true"></i>
                                        {duration}
                                    </span>
                                    {bairro ? (
                                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]" title={clientAddress}>
                                            <i className="fas fa-map-marker-alt text-[10px]" aria-hidden="true"></i>
                                            <span className="truncate">{bairro}</span>
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {agendamento.notes ? (
                            <p className="mt-3 line-clamp-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-5 text-[var(--text-muted)] whitespace-pre-wrap">
                                {agendamento.notes}
                            </p>
                        ) : null}
                    </div>

                    <i className="fas fa-chevron-right mt-1 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"></i>
                </div>
            </button>

            {showEndedPrompt ? (
                <div className="border-t border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                        <i className="fas fa-circle-exclamation text-[11px]" aria-hidden="true"></i>
                        Horário encerrado — como foi o atendimento?
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => onUpdateServiceStatus(agendamento, 'completed')}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-100 px-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-200 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                        >
                            <i className="fas fa-check text-[11px]" aria-hidden="true"></i>
                            <span className="truncate">Concluído</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onUpdateServiceStatus(agendamento, 'no_show')}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-amber-300 bg-white px-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/70 dark:bg-slate-800 dark:text-amber-200"
                        >
                            <i className="fas fa-user-slash text-[11px]" aria-hidden="true"></i>
                            <span className="truncate">Faltou</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onUpdateServiceStatus(agendamento, 'cancelled')}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-rose-300 bg-white px-2 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-800/70 dark:bg-slate-800 dark:text-rose-200"
                        >
                            <i className="fas fa-ban text-[11px]" aria-hidden="true"></i>
                            <span className="truncate">Cancelado</span>
                        </button>
                    </div>
                </div>
            ) : null}

            {hasActions ? (
                <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] p-2 sm:grid-cols-3">
                    {telUrl ? (
                        <AgendaActionLink
                            href={telUrl}
                            label="Ligar"
                            ariaLabel={`Ligar para ${agendamento.clienteNome}`}
                            iconClassName="fas fa-phone"
                        />
                    ) : null}
                    {whatsappUrl ? (
                        <AgendaActionLink
                            href={whatsappUrl}
                            label="WhatsApp"
                            ariaLabel={`Abrir WhatsApp de ${agendamento.clienteNome}`}
                            iconClassName="fab fa-whatsapp"
                            tone="blue"
                        />
                    ) : null}
                    {clientAddress ? (
                        <RouteActionLink address={clientAddress} clientName={agendamento.clienteNome} />
                    ) : null}
                </div>
            ) : null}
        </article>
    );
};

const DayAgendaSummary: React.FC<{
    agendamentos: AgendamentoWithStatus[];
}> = ({ agendamentos }) => {
    if (agendamentos.length === 0) return null;

    const first = agendamentos[0];
    const last = agendamentos[agendamentos.length - 1];
    const approvedCount = agendamentos.filter((item) => item.status === 'approved').length;
    const revisedCount = agendamentos.filter((item) => item.status === 'revised').length;
    const pendingCount = agendamentos.filter((item) => (item.status || 'pending') === 'pending').length;

    return (
        <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-hairline)]">
                <span className="block text-[10px] font-bold uppercase text-[var(--text-soft)]">Agenda</span>
                <span className="mt-0.5 block text-sm font-black text-[var(--text-strong)]">{agendamentos.length}</span>
            </div>
            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-hairline)]">
                <span className="block text-[10px] font-bold uppercase text-[var(--text-soft)]">Janela</span>
                <span className="mt-0.5 block truncate text-sm font-black text-[var(--text-strong)]">
                    {formatTime(first.start)}-{formatTime(last.end)}
                </span>
            </div>
            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-hairline)]">
                <span className="block text-[10px] font-bold uppercase text-[var(--text-soft)]">Status</span>
                <span className="mt-1 flex items-center gap-1.5">
                    <span title="Aprovados" className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-black text-[var(--text-strong)]">{approvedCount}</span>
                    <span title="Revisar" className="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
                    <span className="text-xs font-black text-[var(--text-strong)]">{revisedCount}</span>
                    <span title="Pendentes" className="inline-flex h-2 w-2 rounded-full bg-slate-400"></span>
                    <span className="text-xs font-black text-[var(--text-strong)]">{pendingCount}</span>
                </span>
            </div>
        </div>
    );
};

const CalendarMonthStats: React.FC<{
    total: number;
    approved: number;
    revised: number;
    pending: number;
}> = ({ total, approved, revised, pending }) => (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)]">
        <span className="inline-flex h-7 items-center rounded-full bg-[var(--surface-muted)] px-2.5">{total} no mês</span>
        <span className="hidden h-7 items-center gap-1 rounded-full bg-emerald-50 px-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            {approved}
        </span>
        <span className="hidden h-7 items-center gap-1 rounded-full bg-amber-50 px-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            {revised}
        </span>
        <span className="hidden h-7 items-center gap-1 rounded-full bg-slate-100 px-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            {pending}
        </span>
    </div>
);

const AgendaQuickButton: React.FC<{
    onClick: () => void;
    iconClassName: string;
    label: string;
}> = ({ onClick, iconClassName, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--text-strong)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)]"
    >
        <i className={`${iconClassName} text-[11px] text-[var(--text-muted)]`} aria-hidden="true"></i>
        {label}
    </button>
);

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const AgendaView: React.FC<AgendaViewProps> = ({ agendamentos, pdfs, clients, onEditAgendamento, onUpdateServiceStatus, onCreateNewAgendamento }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDayOfWeek = startOfMonth.getDay();

    const daysInMonth = useMemo(() => {
        const days: (Date | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i += 1) {
            days.push(null);
        }
        for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
            days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
        }
        return days;
    }, [currentDate, startDayOfWeek, endOfMonth]);

    const pdfStatusMap = useMemo(() => {
        const map = new Map<number, SavedPDF['status']>();
        pdfs.forEach((pdf) => {
            if (pdf.id && pdf.status) {
                map.set(pdf.id, pdf.status);
            }
        });
        return map;
    }, [pdfs]);

    const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

    const agendamentosWithStatus = useMemo<AgendamentoWithStatus[]>(() => (
        agendamentos
            .map((agendamento) => ({
                ...agendamento,
                status: agendamento.pdfId ? (pdfStatusMap.get(agendamento.pdfId) || 'pending') : 'pending',
            }))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    ), [agendamentos, pdfStatusMap]);

    const agendamentosByDate = useMemo(() => {
        const map = new Map<string, AgendamentoWithStatus[]>();
        agendamentosWithStatus.forEach((agendamento) => {
            const dateKey = new Date(agendamento.start).toDateString();
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(agendamento);
        });

        return map;
    }, [agendamentosWithStatus]);

    const monthAgendamentos = useMemo(() => (
        agendamentosWithStatus.filter((agendamento) => sameMonth(new Date(agendamento.start), currentDate))
    ), [agendamentosWithStatus, currentDate]);

    const monthStats = useMemo(() => ({
        total: monthAgendamentos.length,
        approved: monthAgendamentos.filter((item) => item.status === 'approved').length,
        revised: monthAgendamentos.filter((item) => item.status === 'revised').length,
        pending: monthAgendamentos.filter((item) => (item.status || 'pending') === 'pending').length,
    }), [monthAgendamentos]);

    const nextAppointment = useMemo(() => {
        const now = new Date().getTime();
        return agendamentosWithStatus.find((agendamento) => new Date(agendamento.end).getTime() >= now) || null;
    }, [agendamentosWithStatus]);

    const selectedDayAgendamentos = useMemo(() => {
        return agendamentosByDate.get(selectedDate.toDateString()) || [];
    }, [agendamentosByDate, selectedDate]);

    const changeMonth = (amount: number) => {
        setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const selectDate = (date: Date) => {
        setSelectedDate(date);
        setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    };

    const handleGoToday = () => {
        selectDate(new Date());
    };

    const handleGoNextAppointment = () => {
        if (!nextAppointment) return;
        selectDate(new Date(nextAppointment.start));
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date) => {
        return date.toDateString() === selectedDate.toDateString();
    };

    const getDayNumberClasses = (day: Date) => {
        const classes = ['flex', 'items-center', 'justify-center', 'h-6', 'w-6', 'text-sm', 'font-semibold', 'rounded-full', 'transition-colors'];
        if (isSelected(day)) {
            classes.push('bg-slate-800', 'dark:bg-slate-700', 'text-white');
        } else if (isToday(day)) {
            classes.push('bg-slate-200', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-slate-200');
        } else {
            classes.push('text-slate-700', 'dark:text-slate-300');
        }
        return classes.join(' ');
    };

    const getDayCellClasses = (day: Date) => {
        const classes = [
            'relative',
            'pt-[100%]',
            'rounded-[var(--radius-card)]',
            'border',
            'bg-[var(--surface)]',
            'shadow-[var(--shadow-hairline)]',
            'cursor-pointer',
            'transition-all',
            'duration-200',
            'hover:bg-[var(--surface-muted)]',
        ];

        if (isSelected(day)) {
            classes.push('border-blue-500', 'ring-2', 'ring-blue-500/20');
        } else if (isToday(day)) {
            classes.push('border-slate-300', 'dark:border-slate-600');
        } else {
            classes.push('border-[var(--border-subtle)]');
        }

        return classes.join(' ');
    };

    const selectedDateString = useMemo(() => {
        const dateString = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
        const parts = dateString.split(', ');
        const weekday = parts[0].split('-').map(capitalize).join('-');
        const dayAndMonthParts = parts[1].split(' de ');
        const day = dayAndMonthParts[0];
        const month = capitalize(dayAndMonthParts[1]);
        return `${weekday}, ${day} De ${month}`;
    }, [selectedDate]);

    const currentMonthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-5">
            <div className="space-y-5 lg:hidden">
                <section>
                    <header className="mb-4 flex items-center justify-between">
                        <button onClick={() => changeMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 capitalize">
                            {currentMonthLabel}
                        </h2>
                        <button onClick={() => changeMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </header>

                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
                            <AgendaQuickButton onClick={handleGoToday} iconClassName="far fa-calendar-check" label="Hoje" />
                            {nextAppointment ? (
                                <AgendaQuickButton onClick={handleGoNextAppointment} iconClassName="fas fa-map-pin" label="Próximo" />
                            ) : null}
                        </div>
                        <CalendarMonthStats {...monthStats} />
                    </div>

                    <AgendaPushReminderControl />

                    <div className="grid grid-cols-7 gap-1 mb-2 text-center text-sm font-semibold text-slate-500">
                        {weekDays.map((day) => <div key={day}>{day}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {daysInMonth.map((day, index) => {
                            const dayAgendamentos = day ? agendamentosByDate.get(day.toDateString()) || [] : [];
                            return (
                                <div
                                    key={day ? day.toISOString() : `mobile-empty-${index}`}
                                    onClick={() => day && selectDate(day)}
                                    className={day ? getDayCellClasses(day) : 'relative pt-[100%] bg-transparent'}
                                >
                                    {day && (
                                        <div className="absolute inset-0 p-1.5 flex flex-col items-center overflow-hidden">
                                            {dayAgendamentos.length > 0 ? (
                                                <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[9px] font-black text-white">
                                                    {dayAgendamentos.length}
                                                </span>
                                            ) : null}
                                            <span className={getDayNumberClasses(day)}>
                                                {day.getDate()}
                                            </span>
                                            {dayAgendamentos.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap justify-center items-center gap-1">
                                                    {dayAgendamentos.slice(0, 3).map((agendamento) => (
                                                        <div key={agendamento.id} className={`w-2 h-2 rounded-full ${getStatusColor(agendamento.status)}`} title={agendamento.clienteNome}></div>
                                                    ))}
                                                    {dayAgendamentos.length > 3 && (
                                                        <div className="w-2 h-2 rounded-full bg-slate-300" title={`${dayAgendamentos.length - 3} mais`}></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section>
                    <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-700">
                        <div>
                            <span className="text-sm font-semibold text-slate-500">Agenda:</span>
                            <h3 className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-200">
                                {selectedDateString}
                            </h3>
                        </div>
                        <ActionButton
                            onClick={() => onCreateNewAgendamento(selectedDate)}
                            variant="primary"
                            size="md"
                            iconOnly
                            iconClassName="fas fa-plus"
                            aria-label="Criar novo agendamento para o dia selecionado"
                            className="shadow-lg shadow-blue-900/20"
                        />
                    </div>

                    <DayAgendaSummary agendamentos={selectedDayAgendamentos} />

                    {selectedDayAgendamentos.length > 0 ? (
                        <div className="space-y-3">
                            {selectedDayAgendamentos.map((agendamento) => {
                                const client = clientsById.get(agendamento.clienteId);
                                return <AppointmentCard key={agendamento.id} agendamento={agendamento} client={client} onEdit={onEditAgendamento} onUpdateServiceStatus={onUpdateServiceStatus} />;
                            })}
                        </div>
                    ) : (
                        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                            <ContentState
                                compact
                                iconClassName="fas fa-calendar-check"
                                title="Nada agendado neste dia"
                                description="Crie um agendamento para organizar seu atendimento."
                                actionLabel="Novo agendamento"
                                actionIconClassName="fas fa-plus"
                                onAction={() => onCreateNewAgendamento(selectedDate)}
                            />
                        </div>
                    )}
                </section>
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-5 lg:items-start">
                <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                    <header className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <h2 className="text-xl font-bold text-[var(--text-strong)] capitalize">
                            {currentMonthLabel}
                        </h2>
                        <button onClick={() => changeMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </header>

                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <AgendaQuickButton onClick={handleGoToday} iconClassName="far fa-calendar-check" label="Hoje" />
                            {nextAppointment ? (
                                <AgendaQuickButton onClick={handleGoNextAppointment} iconClassName="fas fa-map-pin" label="Próximo" />
                            ) : null}
                        </div>
                        <CalendarMonthStats {...monthStats} />
                    </div>

                    <AgendaPushReminderControl />

                    <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-[var(--text-muted)] mb-2">
                        {weekDays.map((day) => <div key={day}>{day}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {daysInMonth.map((day, index) => {
                            const dayAgendamentos = day ? agendamentosByDate.get(day.toDateString()) || [] : [];
                            return (
                                <div
                                    key={day ? day.toISOString() : `desktop-empty-${index}`}
                                    onClick={() => day && selectDate(day)}
                                    className={day ? getDayCellClasses(day) : 'relative pt-[100%] bg-transparent'}
                                >
                                    {day && (
                                        <div className="absolute inset-0 p-1.5 flex flex-col items-center overflow-hidden">
                                            {dayAgendamentos.length > 0 ? (
                                                <span className="absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-black text-white">
                                                    {dayAgendamentos.length}
                                                </span>
                                            ) : null}
                                            <span className={getDayNumberClasses(day)}>
                                                {day.getDate()}
                                            </span>
                                            {dayAgendamentos.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap justify-center items-center gap-1">
                                                    {dayAgendamentos.slice(0, 3).map((agendamento) => (
                                                        <div key={agendamento.id} className={`w-2 h-2 rounded-full ${getStatusColor(agendamento.status)}`} title={agendamento.clienteNome}></div>
                                                    ))}
                                                    {dayAgendamentos.length > 3 && (
                                                        <div className="w-2 h-2 rounded-full bg-slate-300" title={`${dayAgendamentos.length - 3} mais`}></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <aside className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)] lg:sticky lg:top-4">
                    <div className="flex justify-between items-center pb-3 mb-4 border-b border-[var(--border-subtle)]">
                        <div>
                            <span className="text-sm font-semibold text-[var(--text-muted)]">Agenda:</span>
                            <h3 className="text-lg font-bold text-[var(--text-strong)] leading-tight">
                                {selectedDateString}
                            </h3>
                        </div>
                        <ActionButton
                            onClick={() => onCreateNewAgendamento(selectedDate)}
                            variant="primary"
                            size="md"
                            iconOnly
                            iconClassName="fas fa-plus"
                            aria-label="Criar novo agendamento para o dia selecionado"
                        />
                    </div>

                    <DayAgendaSummary agendamentos={selectedDayAgendamentos} />

                    {selectedDayAgendamentos.length > 0 ? (
                        <div className="space-y-3">
                            {selectedDayAgendamentos.map((agendamento) => {
                                const client = clientsById.get(agendamento.clienteId);
                                return <AppointmentCard key={agendamento.id} agendamento={agendamento} client={client} onEdit={onEditAgendamento} onUpdateServiceStatus={onUpdateServiceStatus} />;
                            })}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                            <ContentState
                                compact
                                iconClassName="fas fa-calendar-check"
                                title="Nada agendado neste dia"
                                description="Crie um agendamento para organizar seu atendimento."
                                actionLabel="Novo agendamento"
                                actionIconClassName="fas fa-plus"
                                onAction={() => onCreateNewAgendamento(selectedDate)}
                            />
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default AgendaView;
