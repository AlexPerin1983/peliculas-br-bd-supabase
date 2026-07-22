import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { Agendamento, AgendamentoServiceStatus, Client, UserInfo, SavedPDF, SchedulingInfo } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';
import SearchableSelect from '../ui/SearchableSelect';
import * as db from '../../services/db';

interface AgendamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (agendamento: Omit<Agendamento, 'id'> | Agendamento) => Promise<void>;
    onDelete: (agendamento: Agendamento) => void;
    schedulingInfo: SchedulingInfo;
    clients: Client[];
    savedPdfs: SavedPDF[];
    onAddNewClient: (clientName: string) => void;
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

const timeToMinutes = (value: string): number => {
    const [hours = '0', minutes = '0'] = value.split(':');
    return Number(hours) * 60 + Number(minutes);
};

const isWithinWorkingHours = (
    startTime: string,
    endTime: string,
    scheduleStart: string,
    scheduleEnd: string
): boolean => {
    const appointmentStart = timeToMinutes(startTime);
    const appointmentEnd = timeToMinutes(endTime);
    const workingStart = timeToMinutes(scheduleStart);
    let workingEnd = timeToMinutes(scheduleEnd);

    if (workingEnd <= workingStart) {
        workingEnd += 24 * 60;
    }

    return appointmentStart >= workingStart && appointmentEnd <= workingEnd;
};

const getWorkingEndLabel = (scheduleStart: string, scheduleEnd: string): string => {
    if (timeToMinutes(scheduleEnd) <= timeToMinutes(scheduleStart)) {
        return `${scheduleEnd} (meia-noite)`;
    }

    return scheduleEnd;
};

const AgendamentoModal: React.FC<AgendamentoModalProps> = ({ isOpen, onClose, onSave, onDelete, schedulingInfo, clients, savedPdfs, onAddNewClient, userInfo, agendamentos }) => {
    const agendamento = schedulingInfo.agendamento;
    const pdf = 'pdf' in schedulingInfo ? schedulingInfo.pdf : undefined;

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

            if (isEditing && agendamento?.start && agendamento?.end) {
                const startDate = new Date(agendamento.start);
                const endDate = new Date(agendamento.end);
                setDate(startDate.toISOString().split('T')[0]);
                setStartTime(startDate.toTimeString().split(' ')[0].substring(0, 5));
                setEndTime(endDate.toTimeString().split(' ')[0].substring(0, 5));
                setNotes(agendamento.notes || '');
            } else if (agendamento?.start) {
                const startDate = new Date(agendamento.start);
                setDate(startDate.toISOString().split('T')[0]);
                setStartTime(startDate.toTimeString().split(' ')[0].substring(0, 5));
                const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
                setEndTime(endDate.toTimeString().split(' ')[0].substring(0, 5));
                setNotes(agendamento.notes || '');
            } else {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setDate(tomorrow.toISOString().split('T')[0]);
                setStartTime('09:00');
                setEndTime('11:00');
                setNotes('');
            }
        }
    }, [isOpen, agendamento, pdf, isEditing]);

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

        if (!selectedClientId) {
            setValidationError("Por favor, selecione um cliente.");
            return;
        }

        const client = clients.find(c => c.id === selectedClientId);
        if (!client) {
            setValidationError("Cliente selecionado é inválido.");
            return;
        }

        const [year, month, day] = date.split('-').map(Number);
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        const startDateTime = new Date(year, month - 1, day, startHours, startMinutes);
        const endDateTime = new Date(year, month - 1, day, endHours, endMinutes);

        if (!userInfo || !userInfo.workingHours) {
            setValidationError("Configure o horário de funcionamento da empresa nas Configurações para agendar.");
            return;
        }

        // Capacidade = colaboradores ativos da organização (mínimo 1 = o dono).
        const maxAppointments = teamCapacity;

        if (startDateTime >= endDateTime) {
            setValidationError('O horário de término deve ser posterior ao de início.');
            return;
        }

        const selectedDayOfWeek = startDateTime.getDay();
        if (!userInfo.workingHours.days.includes(selectedDayOfWeek)) {
            setValidationError('A data selecionada não é um dia de trabalho.');
            return;
        }

        const scheduleStart = userInfo.workingHours.start;
        const scheduleEnd = userInfo.workingHours.end;
        if (!isWithinWorkingHours(startTime, endTime, scheduleStart, scheduleEnd)) {
            setValidationError(`O horário deve ser entre ${scheduleStart} e ${getWorkingEndLabel(scheduleStart, scheduleEnd)}.`);
            return;
        }

        const conflictingAppointments = agendamentos.filter(ag => {
            if (isEditing && ag.id === agendamento?.id) return false;
            // Cancelados / não comparecidos não ocupam colaborador, então liberam o horário.
            if (ag.serviceStatus === 'cancelled' || ag.serviceStatus === 'no_show') return false;
            const existingStart = new Date(ag.start);
            const existingEnd = new Date(ag.end);
            return startDateTime < existingEnd && endDateTime > existingStart;
        });

        if (conflictingAppointments.length >= maxAppointments) {
            setValidationError(`Todos os ${maxAppointments} colaboradores já estão ocupados neste horário.`);
            return;
        }
        const proposalIds = selectedProposalIds.filter((id, index, ids) => ids.indexOf(id) === index);


        const agendamentoPayload: Omit<Agendamento, 'id'> | Agendamento = {
            clienteId: client.id!,
            clienteNome: client.nome,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            notes: notes,
            pdfId: proposalIds[0],
            pdfIds: proposalIds,
            serviceStatus,
        };

        if (isEditing) {
            (agendamentoPayload as Agendamento).id = agendamento!.id;
        }

        setIsSaving(true);
        try {
            await onSave(agendamentoPayload);
        } catch (err: any) {
            setValidationError(err.message || 'Erro ao salvar agendamento. Tente novamente.');
            setIsSaving(false);
        }
    };

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
            `SUMMARY:Instalação de Película: ${client.nome}`,
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
                {isEditing ? 'Salvar' : 'Agendar'}
            </ActionButton>
        </>
    );

    const inputClassName = "bg-slate-100/70 border-slate-200 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-slate-400 focus:ring-1 dark:bg-slate-700 dark:border-slate-600 dark:placeholder:text-slate-500 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:border-slate-500";
    const textareaClassName = `${inputClassName} min-h-[120px] resize-none`;

    return (
        <Modal isOpen={isOpen} onClose={isSaving ? () => {} : onClose} title={modalTitle} footer={footerContent} disableClose={isSaving} fullScreenOnMobile>
            <form id="agendamentoForm" onSubmit={handleSubmit} className="space-y-5">
                <fieldset disabled={isSaving} className="space-y-5">
                    <div>
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
                            autoFocus={!isClientLocked}
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
                                            onClick={() => setServiceStatus(option.value)}
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
