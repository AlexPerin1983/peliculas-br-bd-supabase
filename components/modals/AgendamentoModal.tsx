import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { Agendamento, AgendamentoEventType, AgendamentoServiceStatus, Client, QuickClientDraft, UserInfo, SavedPDF, SchedulingInfo } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';
import SearchableSelect from '../ui/SearchableSelect';
import * as db from '../../services/db';
import { getAgendamentoSlotError } from '../../src/lib/agendamentoRules';
import { isClientAddress, pickProposalToLink, withLocalNote } from '../../src/lib/voiceClientMatch';
import { buildMultiDayAgendamentos, formatDayLabel, moveToDay, nextDayKey, normalizeExtraDays } from '../../src/lib/multiDaySchedule';
import { DEFAULT_EVENT_TYPE, EVENT_COLOR_PALETTE, EVENT_TYPES, getAgendamentoColor, getEventTypeMeta } from '../../src/lib/agendamentoEventTypes';

const COLOR_NAMES: Record<string, string> = {
    '#7c3aed': 'Violeta',
    '#0891b2': 'Azul-piscina',
    '#ea580c': 'Laranja',
    '#db2777': 'Rosa',
    '#0d9488': 'Verde-água',
    '#4f46e5': 'Anil',
    '#65a30d': 'Verde',
    '#64748b': 'Cinza',
};

interface AgendamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Vários dias do mesmo atendimento chegam como lista (um agendamento por dia).
    onSave: (agendamento: Omit<Agendamento, 'id'> | Agendamento | Array<Omit<Agendamento, 'id'>>) => Promise<void>;
    onDelete: (agendamento: Agendamento) => void;
    schedulingInfo: SchedulingInfo;
    clients: Client[];
    savedPdfs: SavedPDF[];
    onAddNewClient: (clientName: string) => void;
    // Cria o cadastro simples do cliente ditado por voz (só nome e local).
    onCreateQuickClient?: (values: { nome: string; local: string }, draft?: QuickClientDraft) => Promise<Client>;
    userInfo: UserInfo | null;
    agendamentos: Agendamento[];
}

const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status = 'pending' }) => {
    const statusInfo = {
        approved: { text: 'Aprovado', classes: 'bg-green-100 text-green-800' },
        revised: { text: 'Revisar', classes: 'bg-yellow-100 text-yellow-800' },
        pending: { text: 'Pendente', classes: 'bg-slate-200 text-slate-800' }
    };
    const { text, classes } = statusInfo[status];
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes}`}>{text}</span>;
};

const SERVICE_STATUS_OPTIONS: {
    value: AgendamentoServiceStatus;
    label: string;
    iconClassName: string;
    activeClasses: string;
}[] = [
    { value: 'scheduled', label: 'Agendado', iconClassName: 'far fa-clock', activeClasses: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' },
    { value: 'completed', label: 'Concluído', iconClassName: 'fas fa-check-circle', activeClasses: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' },
    { value: 'partial', label: 'Parcial', iconClassName: 'fas fa-hourglass-half', activeClasses: 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200' },
    { value: 'cancelled', label: 'Cancelado', iconClassName: 'fas fa-ban', activeClasses: 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200' },
    { value: 'no_show', label: 'Não compareceu', iconClassName: 'fas fa-user-slash', activeClasses: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200' },
];

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatClientAddress = (client: Client): string => {
    const parts = [
        client.logradouro,
        client.numero,
        client.bairro,
        client.cidade,
        client.uf
    ];
    return parts.filter(Boolean).join(', ');
};

// --- Avatar do cliente no seletor (iniciais + cor estável pelo nome) ---
const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'];
const clientInitials = (nome: string): string =>
    (nome || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
const colorForName = (nome: string): string =>
    AVATAR_COLORS[[...(nome || '?')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

// Linha secundária: telefone + cidade/UF (o que estiver preenchido).
const clientSubtitle = (client: Client): string =>
    [client.telefone, [client.cidade, client.uf].filter(Boolean).join('/')].filter(Boolean).join('  ·  ');

// Data e hora locais para os inputs. toISOString usaria UTC e trocaria o dia à noite.
const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toTimeInputValue = (date: Date) => date.toTimeString().split(' ')[0].substring(0, 5);

const AgendamentoModal: React.FC<AgendamentoModalProps> = ({ isOpen, onClose, onSave, onDelete, schedulingInfo, clients, savedPdfs, onAddNewClient, onCreateQuickClient, userInfo, agendamentos }) => {
    const agendamento = schedulingInfo.agendamento;
    const pdf = 'pdf' in schedulingInfo ? schedulingInfo.pdf : undefined;
    const quickClient = 'quickClient' in schedulingInfo ? schedulingInfo.quickClient : undefined;
    const initialExtraDays = 'extraDays' in schedulingInfo ? schedulingInfo.extraDays : undefined;

    const isEditing = !!agendamento?.id;
    const isClientLocked = !!pdf?.clienteId || !!agendamento?.pdfId;

    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('11:00');
    const [notes, setNotes] = useState('');
    const [serviceStatus, setServiceStatus] = useState<AgendamentoServiceStatus>('scheduled');
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [selectedProposalIds, setSelectedProposalIds] = useState<number[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    // Cliente ditado por voz: nome e local digitáveis no lugar da busca na lista.
    const [isQuickClient, setIsQuickClient] = useState(false);
    const [quickName, setQuickName] = useState('');
    const [quickLocal, setQuickLocal] = useState('');
    // Outros dias do mesmo atendimento, no mesmo horário (só em agendamento novo).
    const [extraDays, setExtraDays] = useState<string[]>([]);
    // Organização: tipo, título opcional e cor (vazia = a do tipo).
    const [eventType, setEventType] = useState<AgendamentoEventType | undefined>(undefined);
    const [title, setTitle] = useState('');
    const [color, setColor] = useState('');
    const [isColorOpen, setIsColorOpen] = useState(false);
    // Capacidade = nº de colaboradores ATIVOS da organização (dono + convidados).
    // Org-wide e igual em qualquer conta logada (corrige a antiga contagem por
    // "Equipe" manual, que não crescia ao convidar e variava por conta).
    const [teamSize, setTeamSize] = useState(0);

    // Carrega o tamanho da equipe ativa ao abrir (fonte de verdade da capacidade).
    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        db.getActiveTeamSize()
            .then(n => { if (active) setTeamSize(n); })
            .catch(() => { /* offline/erro: cai no piso mínimo de 1 (o próprio dono) */ });
        return () => { active = false; };
    }, [isOpen]);

    // Piso de 1 (o dono sempre conta). Mantém a "Equipe" manual como reforço para
    // quem cadastra instaladores sem login.
    const teamCapacity = Math.max(teamSize, userInfo?.employees?.length ?? 0, 1);

    // Ordem inteligente do seletor de clientes: favoritos primeiro, depois os mais
    // recentes (última atualização) e por fim em ordem alfabética.
    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0);
            const la = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const lb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            if (la !== lb) return lb - la;
            return (a.nome || '').localeCompare(b.nome || '');
        });
    }, [clients]);
    const clientProposals = useMemo(() => (
        savedPdfs
            .filter((item) => item.clienteId === selectedClientId && typeof item.id === 'number')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    ), [savedPdfs, selectedClientId]);

    const proposalIdsScheduledElsewhere = useMemo(() => {
        const ids = new Set<number>();
        agendamentos.forEach((item) => {
            if (isEditing && item.id === agendamento?.id) return;
            const linkedIds = item.pdfIds?.length ? item.pdfIds : (item.pdfId ? [item.pdfId] : []);
            linkedIds.forEach((id) => ids.add(id));
        });
        return ids;
    }, [agendamentos, agendamento?.id, isEditing]);


    useEffect(() => {
        if (isOpen) {
            setValidationError(null);
            setIsSaving(false);
            const initialClientId = agendamento?.clienteId || pdf?.clienteId || null;
            setSelectedClientId(initialClientId);
            const initialProposalIds = agendamento?.pdfIds?.length
                ? agendamento.pdfIds
                : (pdf?.id ? [pdf.id] : (agendamento?.pdfId ? [agendamento.pdfId] : []));
            setSelectedProposalIds(initialProposalIds);

            setServiceStatus(agendamento?.serviceStatus || 'scheduled');

            setIsQuickClient(!!quickClient && !initialClientId);
            setQuickName(quickClient?.nome || '');
            setQuickLocal(quickClient?.local || '');
            setExtraDays(isEditing ? [] : (initialExtraDays || []));
            // Agendamento antigo sem tipo continua sem tipo; o novo começa como Instalação.
            setEventType(agendamento?.eventType ?? (isEditing ? undefined : DEFAULT_EVENT_TYPE));
            setTitle(agendamento?.title || '');
            setColor(agendamento?.color || '');
            setIsColorOpen(false);

            if (isEditing && agendamento?.start && agendamento?.end) {
                const startDate = new Date(agendamento.start);
                const endDate = new Date(agendamento.end);
                setDate(toDateInputValue(startDate));
                setStartTime(toTimeInputValue(startDate));
                setEndTime(toTimeInputValue(endDate));
                setNotes(agendamento.notes || '');
            } else if (agendamento?.start) {
                const startDate = new Date(agendamento.start);
                setDate(toDateInputValue(startDate));
                setStartTime(toTimeInputValue(startDate));
                // Término sugerido (ex.: "das 9 às 12" ditado por voz); sem ele, 2 horas.
                const suggestedEnd = agendamento.end ? new Date(agendamento.end) : null;
                const endDate = suggestedEnd && suggestedEnd > startDate
                    ? suggestedEnd
                    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
                setEndTime(toTimeInputValue(endDate));
                setNotes(agendamento.notes || '');
            } else {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setDate(toDateInputValue(tomorrow));
                setStartTime('09:00');
                setEndTime('11:00');
                setNotes('');
            }
        }
    }, [isOpen, agendamento, pdf, isEditing, quickClient, initialExtraDays]);

    // Disponibilidade ao vivo: quantos colaboradores ficam livres no horário escolhido.
    // Usado para avisar antes de salvar (ex.: reagendar/continuar num dia já cheio).
    const availability = useMemo(() => {
        if (!date || !startTime || !endTime) return null;

        const [year, month, day] = date.split('-').map(Number);
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        if ([year, month, day, startHours, startMinutes, endHours, endMinutes].some(Number.isNaN)) return null;

        const startDateTime = new Date(year, month - 1, day, startHours, startMinutes);
        const endDateTime = new Date(year, month - 1, day, endHours, endMinutes);
        if (startDateTime >= endDateTime) return null;

        const busy = agendamentos.filter(ag => {
            if (isEditing && ag.id === agendamento?.id) return false;
            if (ag.serviceStatus === 'cancelled' || ag.serviceStatus === 'no_show') return false;
            const existingStart = new Date(ag.start);
            const existingEnd = new Date(ag.end);
            return startDateTime < existingEnd && endDateTime > existingStart;
        }).length;

        return { capacity: teamCapacity, busy, free: teamCapacity - busy };
    }, [agendamentos, date, startTime, endTime, isEditing, agendamento?.id, teamCapacity]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setValidationError(null);

        const quickNameValue = quickName.trim();
        let selectedClient: Client | undefined;
        if (isQuickClient) {
            if (!quickNameValue) {
                setValidationError('Informe o nome do cliente.');
                return;
            }
        } else {
            if (!selectedClientId) {
                setValidationError("Por favor, selecione um cliente.");
                return;
            }

            selectedClient = clients.find(c => c.id === selectedClientId);
            if (!selectedClient) {
                setValidationError("Cliente selecionado é inválido.");
                return;
            }
        }

        const [year, month, day] = date.split('-').map(Number);
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        const startDateTime = new Date(year, month - 1, day, startHours, startMinutes);
        const endDateTime = new Date(year, month - 1, day, endHours, endMinutes);

        const slotError = getAgendamentoSlotError({
            start: startDateTime,
            end: endDateTime,
            workingHours: userInfo?.workingHours,
            agendamentos,
            // Capacidade = colaboradores ativos da organização (mínimo 1 = o dono).
            capacity: teamCapacity,
            ignoreId: isEditing ? agendamento?.id : undefined,
        });
        if (slotError) {
            setValidationError(slotError);
            return;
        }

        // Cada dia extra passa pelas mesmas regras (dia de trabalho, expediente, equipe livre).
        const daysToAdd = isEditing ? [] : normalizeExtraDays(date, extraDays);
        for (const day of daysToAdd) {
            const dayError = getAgendamentoSlotError({
                start: new Date(moveToDay(startDateTime.toISOString(), day)),
                end: new Date(moveToDay(endDateTime.toISOString(), day)),
                workingHours: userInfo?.workingHours,
                agendamentos,
                capacity: teamCapacity,
            });
            if (dayError) {
                setValidationError(`${formatDayLabel(day)}: ${dayError}`);
                return;
            }
        }
        const proposalIds = selectedProposalIds.filter((id, index, ids) => ids.indexOf(id) === index);

        const buildPayload = (client: Client) => {
            const agendamentoPayload: Omit<Agendamento, 'id'> | Agendamento = {
                clienteId: client.id!,
                clienteNome: client.nome,
                start: startDateTime.toISOString(),
                end: endDateTime.toISOString(),
                notes: notes,
                pdfId: proposalIds[0],
                pdfIds: proposalIds,
                serviceStatus,
                valorFinal: agendamento?.valorFinal,
                receiptDescription: agendamento?.receiptDescription,
                stockStatus: agendamento?.stockStatus,
                stockConsumedAt: agendamento?.stockConsumedAt,
                stockSourcePdfIds: agendamento?.stockSourcePdfIds,
                eventType,
                title: title.trim() || undefined,
                color: color || undefined,
            };

            if (isEditing) {
                (agendamentoPayload as Agendamento).id = agendamento!.id;
            }
            return agendamentoPayload;
        };

        setIsSaving(true);
        let createdClient: Client | null = null;
        try {
            // O cadastro simples só nasce aqui, depois de validar data e horário.
            if (isQuickClient) {
                if (!onCreateQuickClient) throw new Error('Não foi possível cadastrar o cliente. Escolha um cliente da lista.');
                createdClient = await onCreateQuickClient({ nome: quickNameValue, local: quickLocal.trim() }, quickClient);
            }
            const firstDay = buildPayload(createdClient || selectedClient!);
            const allDays = daysToAdd.length ? buildMultiDayAgendamentos(firstDay, daysToAdd) : null;
            await onSave(allDays || firstDay);
        } catch (err: any) {
            if (createdClient?.id) {
                // O cliente já foi cadastrado: a nova tentativa usa ele em vez de repetir o cadastro.
                setSelectedClientId(createdClient.id);
                setIsQuickClient(false);
            }
            setValidationError(err.message || 'Erro ao salvar agendamento. Tente novamente.');
            setIsSaving(false);
        }
    };

    // "Já é cliente?": volta para a busca na lista sem perder o local ditado.
    const handleChooseExistingClient = () => {
        const local = quickLocal.trim();
        if (local && !notes.includes(local)) {
            setNotes(current => (current.trim() ? `${current}\nLocal: ${local}` : `Local: ${local}`));
        }
        setIsQuickClient(false);
    };

    // Parecido tocado na lista: vira o cliente do agendamento, com a proposta que espera agenda.
    const handlePickCandidate = (client: Client) => {
        const clientPdfs = savedPdfs.filter(item => item.clienteId === client.id);
        const proposal = pickProposalToLink(clientPdfs, agendamentos);
        setSelectedClientId(client.id ?? null);
        setSelectedProposalIds(proposal?.id != null ? [proposal.id] : []);
        if (!isClientAddress(quickLocal, client)) setNotes(current => withLocalNote(current, quickLocal));
        setIsQuickClient(false);
    };

    // "Não é?": o nome falado vira um cliente novo em vez do cadastrado encontrado.
    const handleUseNewClient = () => {
        const localLine = `Local: ${quickLocal.trim()}`;
        setNotes(current => current.split('\n').filter(line => line.trim() !== localLine).join('\n'));
        setSelectedClientId(null);
        setSelectedProposalIds([]);
        setIsQuickClient(true);
    };

    const candidateClients = useMemo(() => (quickClient?.candidateIds || [])
        .map(id => clients.find(client => client.id === id))
        .filter((client): client is Client => Boolean(client)), [quickClient, clients]);
    const matchedClient = quickClient?.matchedClientId != null && selectedClientId === quickClient.matchedClientId
        ? clients.find(client => client.id === quickClient.matchedClientId)
        : undefined;

    const handleDelete = () => {
        if (isSaving) return;
        if (isEditing && agendamento) {
            onDelete(agendamento as Agendamento);
        }
    }

    const handleExportToCalendar = () => {
        if (!agendamento || !selectedClientId) return;
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return;

        const formatDateForICS = (date: Date) => {
            return date.toISOString().replace(/-|:|\.\d+/g, "");
        };

        const startDate = new Date(agendamento.start);
        const endDate = new Date(agendamento.end);
        const now = new Date();

        let description = `Serviço agendado para ${client.nome}.\\n`;
        if (client.telefone) {
            description += `Telefone: ${client.telefone}\\n`;
        }
        if (pdf) {
            description += `Referente ao orçamento #${pdf.id} no valor de ${formatCurrency(pdf.totalPreco)}.\\n`;
        }
        if (agendamento.notes) {
            description += `\\nObservações:\\n${agendamento.notes.replace(/\n/g, '\\n')}`;
        }

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CalculadoraPeliculas//EN',
            'BEGIN:VEVENT',
            `UID:${agendamento.id}@calculadorapeliculas.com`,
            `DTSTAMP:${formatDateForICS(now)}`,
            `DTSTART:${formatDateForICS(startDate)}`,
            `DTEND:${formatDateForICS(endDate)}`,
            `SUMMARY:${agendamento.title?.trim()
                ? `${agendamento.title.trim()} – ${client.nome}`
                : `${getEventTypeMeta(agendamento.eventType)?.label ?? 'Instalação de Película'}: ${client.nome}`}`,
            `DESCRIPTION:${description}`,
            `LOCATION:${formatClientAddress(client)}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `agendamento_${client.nome.replace(/\s+/g, '_')}.ics`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const modalTitle = (
        <div className="flex items-center gap-3">
            <span>{isEditing ? "Editar Agendamento" : "Novo Agendamento"}</span>
            {isEditing && (
                <button
                    type="button"
                    onClick={handleExportToCalendar}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Exportar para Calendário"
                >
                    <i className="fas fa-file-export text-sm"></i>
                </button>
            )}
        </div>
    );

    const footerContent = (
        <>
            {isEditing && (
                <ActionButton
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving}
                    variant="danger"
                    size="sm"
                >
                    Excluir
                </ActionButton>
            )}
            <div className="flex-grow"></div>
            <ActionButton
                type="submit"
                form="agendamentoForm"
                disabled={isSaving}
                loading={isSaving}
                loadingText="Salvando..."
                variant="primary"
                size="sm"
            >
                {isEditing ? 'Salvar' : (extraDays.length ? `Agendar ${extraDays.length + 1} dias` : 'Agendar')}
            </ActionButton>
        </>
    );

    const inputClassName = "bg-slate-100/70 border-slate-200 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-slate-400 focus:ring-1 dark:bg-slate-700 dark:border-slate-600 dark:placeholder:text-slate-500 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:border-slate-500";
    const textareaClassName = `${inputClassName} min-h-[120px] resize-none`;

    return (
        <Modal isOpen={isOpen} onClose={isSaving ? () => {} : onClose} title={modalTitle} footer={footerContent} disableClose={isSaving} fullScreenOnMobile>
            <form id="agendamentoForm" onSubmit={handleSubmit} className="space-y-5">
                <fieldset disabled={isSaving} className="space-y-5">
                    {quickClient?.reviewHints?.length ? (
                        <div role="status" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            <i className="fas fa-triangle-exclamation mt-0.5" aria-hidden="true"></i>
                            <div>
                                <p className="font-semibold">Confira antes de salvar</p>
                                <ul className="mt-0.5 space-y-0.5">
                                    {quickClient.reviewHints.map((hint) => <li key={hint}>{hint}</li>)}
                                </ul>
                            </div>
                        </div>
                    ) : null}

                    {isQuickClient ? (
                        <section aria-label="Cliente novo" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-600 dark:bg-slate-800/70">
                            {candidateClients.length > 0 ? (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Parecidos nos seus clientes</p>
                                    <ul className="space-y-1.5">
                                        {candidateClients.map((client) => {
                                            const subtitle = [client.telefone, client.bairro || client.cidade].filter(Boolean).join(' · ');
                                            return (
                                                <li key={client.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePickCandidate(client)}
                                                        aria-label={`Agendar para ${client.nome}`}
                                                        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-700"
                                                    >
                                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${colorForName(client.nome)}`}>
                                                            {clientInitials(client.nome)}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{client.nome}</span>
                                                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{subtitle || 'Sem telefone ou bairro'}</span>
                                                        </span>
                                                        <i className="fas fa-chevron-right text-xs text-slate-400" aria-hidden="true"></i>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <p className="pt-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Ou cadastre como cliente novo</p>
                                </div>
                            ) : null}
                            <Input
                                id="quickClientName"
                                label="Nome do cliente"
                                value={quickName}
                                onChange={(e) => setQuickName((e.target as HTMLInputElement).value)}
                                placeholder="Nome do cliente"
                                className={inputClassName}
                            />
                            <Input
                                id="quickClientLocal"
                                label="Local"
                                value={quickLocal}
                                onChange={(e) => setQuickLocal((e.target as HTMLInputElement).value)}
                                placeholder="Rua, número e bairro"
                                className={inputClassName}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Vira um cliente novo. Telefone e outros dados você completa depois.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleChooseExistingClient}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    Já é cliente? Escolher da lista
                                </button>
                            </div>
                        </section>
                    ) : (
                    <div>
                        {matchedClient ? (
                            <div role="status" className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                                <span className="flex items-center gap-2">
                                    <i className="fas fa-user-check" aria-hidden="true"></i>
                                    Achei {matchedClient.nome} nos seus clientes.
                                </span>
                                <button
                                    type="button"
                                    onClick={handleUseNewClient}
                                    className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                                >
                                    Não é? Cadastrar como cliente novo
                                </button>
                            </div>
                        ) : null}
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
                        <SearchableSelect
                            options={sortedClients}
                            value={selectedClientId}
                            onChange={(id) => {
                                const nextClientId = id as number | null;
                                setSelectedClientId(nextClientId);
                                setSelectedProposalIds((current) => current.filter((proposalId) => (
                                    savedPdfs.some((item) => item.id === proposalId && item.clienteId === nextClientId)
                                )));
                            }}
                            displayField="nome"
                            valueField="id"
                            placeholder="Selecione ou digite um nome"
                            disabled={isClientLocked}
                            autoFocus={!isClientLocked && !quickClient}
                            searchFields={['nome', 'telefone', 'cidade']}
                            listHeader="Favoritos e recentes"
                            renderOption={(client) => {
                                const subtitle = clientSubtitle(client);
                                return (
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${colorForName(client.nome)}`}>
                                            {clientInitials(client.nome)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{client.nome}</span>
                                                {client.pinned && <i className="fas fa-star text-[10px] text-amber-400" aria-hidden="true"></i>}
                                            </div>
                                            <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                                {subtitle || 'Sem telefone ou local informado'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            }}
                            renderSearchAction={(searchTerm) => (
                                <li className="sticky bottom-0 border-t border-blue-100 bg-blue-50/95 p-3 backdrop-blur dark:border-blue-900/60 dark:bg-slate-900/95">
                                    <p className="mb-2 text-center text-xs text-slate-600 dark:text-slate-300">
                                        Não é nenhum destes clientes?
                                    </p>
                                    <ActionButton
                                        type="button"
                                        onClick={() => onAddNewClient(searchTerm)}
                                        variant="secondary"
                                        size="sm"
                                        className="w-full border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300"
                                    >
                                        <i className="fas fa-user-plus" aria-hidden="true"></i>
                                        Cadastrar novo “{searchTerm}”
                                    </ActionButton>
                                </li>
                            )}
                            renderNoResults={(searchTerm) => (
                                <li className="p-3 text-center">
                                    <p className="text-sm text-slate-500 mb-3">
                                        Nenhum cliente encontrado.
                                    </p>
                                    <ActionButton
                                        type="button"
                                        onClick={() => onAddNewClient(searchTerm)}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        <i className="fas fa-user-plus" aria-hidden="true"></i>
                                        Cadastrar novo “{searchTerm}”
                                    </ActionButton>
                                </li>
                            )}
                        />
                    </div>
                    )}

                    {pdf && clientProposals.length === 0 && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 space-y-2">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Orçamento Associado</h4>
                                <StatusBadge status={pdf.status} />
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">{new Date(pdf.date).toLocaleDateString('pt-BR')}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(pdf.totalPreco)}</span>
                            </div>
                        </div>
                    )}
                    {selectedClientId ? (
                        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-600 dark:bg-slate-800/70">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Propostas do cliente</h4>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        Selecione uma ou mais para levar os dados para a agenda.
                                    </p>
                                </div>
                                {selectedProposalIds.length > 0 ? (
                                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                        {selectedProposalIds.length} selecionada{selectedProposalIds.length > 1 ? 's' : ''}
                                    </span>
                                ) : null}
                            </div>

                            {clientProposals.length > 0 ? (
                                <>
                                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-0.5">
                                        {clientProposals.map((proposal) => {
                                            const proposalId = proposal.id as number;
                                            const isSelected = selectedProposalIds.includes(proposalId);
                                            const isScheduledElsewhere = proposalIdsScheduledElsewhere.has(proposalId) && !isSelected;
                                            const proposalName = proposal.proposalOptionName || proposal.nomeArquivo || ('Proposta #' + proposalId);

                                            return (
                                                <label
                                                    key={proposalId}
                                                    className={'flex items-center gap-3 rounded-lg border p-3 transition-colors ' + (
                                                        isScheduledElsewhere
                                                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60 dark:border-slate-700 dark:bg-slate-900/40'
                                                            : isSelected
                                                                ? 'cursor-pointer border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                                                                : 'cursor-pointer border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60'
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={isScheduledElsewhere}
                                                        onChange={() => setSelectedProposalIds((current) => (
                                                            current.includes(proposalId)
                                                                ? current.filter((id) => id !== proposalId)
                                                                : [...current, proposalId]
                                                        ))}
                                                        aria-label={'Selecionar ' + proposalName}
                                                        className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{proposalName}</span>
                                                            <StatusBadge status={proposal.status} />
                                                        </div>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            {new Date(proposal.date).toLocaleDateString('pt-BR')} &middot; {formatCurrency(proposal.totalPreco)}
                                                        </p>
                                                        {isScheduledElsewhere ? (
                                                            <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">J&aacute; vinculada a outro agendamento</p>
                                                        ) : null}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {selectedProposalIds.length > 1 ? (
                                        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
                                            <span className="font-medium text-slate-500 dark:text-slate-400">Total das propostas</span>
                                            <strong className="text-slate-800 dark:text-slate-100">
                                                {formatCurrency(clientProposals
                                                    .filter((proposal) => selectedProposalIds.includes(proposal.id as number))
                                                    .reduce((total, proposal) => total + proposal.totalPreco, 0))}
                                            </strong>
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                                    Este cliente ainda n&atilde;o possui propostas geradas.
                                </p>
                            )}
                        </section>
                    ) : null}

                    <div className="space-y-3">
                        <div>
                            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</span>
                            <div role="radiogroup" aria-label="Tipo do agendamento" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {EVENT_TYPES.map((type) => {
                                    const isActive = eventType === type.value;
                                    return (
                                        <button
                                            key={type.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={isActive}
                                            onClick={() => setEventType(type.value)}
                                            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${isActive ? '' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                            style={isActive ? {
                                                borderColor: type.color,
                                                color: type.color,
                                                backgroundColor: `color-mix(in srgb, ${type.color} 10%, transparent)`,
                                            } : undefined}
                                        >
                                            <i className={`${type.iconClassName} text-xs`} aria-hidden="true"></i>
                                            {type.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                                <Input
                                    id="eventTitle"
                                    label="Título (opcional)"
                                    value={title}
                                    onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
                                    placeholder="Ex.: Película na fachada"
                                    maxLength={120}
                                    className={inputClassName}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsColorOpen((open) => !open)}
                                aria-expanded={isColorOpen}
                                className="flex h-[42px] shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100/70 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            >
                                <span
                                    className="h-4 w-4 rounded-full border border-black/10"
                                    style={{ backgroundColor: getAgendamentoColor({ eventType, color }) ?? '#94a3b8' }}
                                    aria-hidden="true"
                                />
                                {color ? 'Cor' : 'Cor padrão'}
                            </button>
                        </div>

                        {isColorOpen ? (
                            <div role="radiogroup" aria-label="Cor do agendamento" className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-800/70">
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={!color}
                                    onClick={() => { setColor(''); setIsColorOpen(false); }}
                                    className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${!color ? 'border-slate-500 bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100' : 'border-slate-200 text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300'}`}
                                >
                                    Padrão do tipo
                                </button>
                                {EVENT_COLOR_PALETTE.map((hex) => (
                                    <button
                                        key={hex}
                                        type="button"
                                        role="radio"
                                        aria-checked={color === hex}
                                        aria-label={COLOR_NAMES[hex] ?? hex}
                                        title={COLOR_NAMES[hex] ?? hex}
                                        onClick={() => { setColor(hex); setIsColorOpen(false); }}
                                        className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-slate-50 transition-transform active:scale-95 dark:ring-offset-slate-800 ${color === hex ? 'ring-2 ring-slate-500 dark:ring-slate-300' : ''}`}
                                        style={{ backgroundColor: hex }}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div>
                        <div className="mb-1">
                            <label htmlFor="date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Data</label>
                        </div>
                        <Input
                            id="date"
                            label=""
                            type="date"
                            value={date}
                            onChange={(e) => setDate((e.target as HTMLInputElement).value)}
                            required
                            className={inputClassName}
                        />
                        {!isEditing ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Outros dias do atendimento">
                                {extraDays.map((day) => (
                                    <span key={day} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 pl-3 pr-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                                        + {formatDayLabel(day)}
                                        <button
                                            type="button"
                                            onClick={() => setExtraDays((current) => current.filter((item) => item !== day))}
                                            aria-label={`Tirar ${formatDayLabel(day)}`}
                                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/60"
                                        >
                                            <i className="fas fa-xmark text-[11px]" aria-hidden="true"></i>
                                        </button>
                                    </span>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setExtraDays((current) => {
                                        const last = [date, ...current].filter(Boolean).sort().pop();
                                        return last ? [...current, nextDayKey(last)] : current;
                                    })}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-600 dark:text-slate-300"
                                >
                                    <i className="fas fa-plus text-[10px]" aria-hidden="true"></i>
                                    Mais um dia
                                </button>
                            </div>
                        ) : null}
                        {extraDays.length ? (
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                Mesmo horário em todos os dias. Os dias seguintes entram como continuação do atendimento.
                            </p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input id="startTime" label="Início" type="time" value={startTime} onChange={(e) => setStartTime((e.target as HTMLInputElement).value)} required className={inputClassName} />
                        <Input id="endTime" label="Término" type="time" value={endTime} onChange={(e) => setEndTime((e.target as HTMLInputElement).value)} required className={inputClassName} />
                    </div>

                    {availability && (
                        availability.free <= 0 ? (
                            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                                <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
                                <span>Horário cheio — todos os {availability.capacity} colaborador(es) já estão ocupados. Escolha outro horário.</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                                <i className="fas fa-user-check" aria-hidden="true"></i>
                                <span>{availability.free} de {availability.capacity} colaborador(es) livre(s) neste horário.</span>
                            </div>
                        )
                    )}

                    {isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status do atendimento</label>
                            <div className="grid grid-cols-2 gap-2">
                                {SERVICE_STATUS_OPTIONS.map((option) => {
                                    const isActive = serviceStatus === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                if (
                                                    option.value === 'completed'
                                                    && agendamento?.serviceStatus !== 'completed'
                                                ) {
                                                    setValidationError('Para concluir, use o botão "Concluído" na Agenda e confirme o material utilizado.');
                                                    return;
                                                }
                                                setValidationError(null);
                                                setServiceStatus(option.value);
                                            }}
                                            aria-pressed={isActive}
                                            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${isActive ? option.activeClasses : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        >
                                            <i className={`${option.iconClassName} text-xs`} aria-hidden="true"></i>
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <Input
                        as="textarea"
                        id="notes"
                        label="Observações"
                        value={notes}
                        onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
                        placeholder="Observação do serviço"
                        className={textareaClassName}
                    />

                    {validationError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md" role="alert">
                            {validationError}
                        </div>
                    )}
                </fieldset>
            </form>
        </Modal>
    );
};

export default AgendamentoModal;
