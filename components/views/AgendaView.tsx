import React, { useState, useMemo } from 'react';
import { Agendamento, Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';

interface AgendaViewProps {
    agendamentos: Agendamento[];
    pdfs: SavedPDF[];
    clients: Client[];
    onEditAgendamento: (agendamento: Agendamento) => void;
    onCreateNewAgendamento: (date: Date) => void;
}

type AgendamentoWithStatus = Agendamento & { status?: SavedPDF['status'] };

const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status = 'pending' }) => {
    const statusInfo = {
        approved: { text: 'Aprovado', classes: 'bg-green-100 text-green-800' },
        revised: { text: 'Revisar', classes: 'bg-yellow-100 text-yellow-800' },
        pending: { text: 'Pendente', classes: 'bg-slate-200 text-slate-800' }
    };
    const { text, classes } = statusInfo[status];
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes}`}>{text}</span>;
};

const getStatusColor = (status?: SavedPDF['status']) => {
    switch (status) {
        case 'approved':
            return 'bg-green-500';
        case 'revised':
            return 'bg-yellow-400';
        case 'pending':
        default:
            return 'bg-slate-400';
    }
};

const formatFullAddress = (client?: Client): string => {
    if (!client) return '';
    const parts = [
        client.logradouro,
        client.numero,
        client.bairro,
        client.cidade,
        client.uf
    ];
    return parts.filter(Boolean).join(', ');
};


const AgendaView: React.FC<AgendaViewProps> = ({ agendamentos, pdfs, clients, onEditAgendamento, onCreateNewAgendamento }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDayOfWeek = startOfMonth.getDay(); // 0 (Sun) - 6 (Sat)

    const daysInMonth = useMemo(() => {
        const days: (Date | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        for (let i = 1; i <= endOfMonth.getDate(); i++) {
            days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
        }
        return days;
    }, [currentDate, startDayOfWeek, endOfMonth]);

    const pdfStatusMap = useMemo(() => {
        const map = new Map<number, SavedPDF['status']>();
        pdfs.forEach(pdf => {
            if (pdf.id && pdf.status) {
                map.set(pdf.id, pdf.status);
            }
        });
        return map;
    }, [pdfs]);

    const clientsById = useMemo(() => {
        return new Map(clients.map(client => [client.id, client]));
    }, [clients]);

    const agendamentosByDate = useMemo(() => {
        const map = new Map<string, AgendamentoWithStatus[]>();
        agendamentos.forEach(ag => {
            const dateKey = new Date(ag.start).toDateString();
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            const agWithStatus: AgendamentoWithStatus = {
                ...ag,
                status: ag.pdfId ? pdfStatusMap.get(ag.pdfId) : 'pending'
            };
            map.get(dateKey)!.push(agWithStatus);
        });
        // Sort appointments within each day by start time
        for (const value of map.values()) {
            value.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        }
        return map;
    }, [agendamentos, pdfStatusMap]);

    const selectedDayAgendamentos = useMemo(() => {
        if (!selectedDate) return [];
        return agendamentosByDate.get(selectedDate.toDateString()) || [];
    }, [agendamentosByDate, selectedDate]);

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
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
    }

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b'];

    const selectedDateString = useMemo(() => {
        const dateString = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const parts = dateString.split(', ');
        const weekday = parts[0].split('-').map(capitalize).join('-');
        const dayAndMonthParts = parts[1].split(' de ');
        const day = dayAndMonthParts[0];
        const month = capitalize(dayAndMonthParts[1]);
        return `${weekday}, ${day} De ${month}`;
    }, [selectedDate]);


    return (
        <div className="p-1 lg:flex lg:gap-8 lg:items-start">
            <div className="lg:flex-1">
                <header className="flex items-center justify-between mb-4">
                    <button onClick={() => changeMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <i className="fas fa-chevron-left"></i>
                    </button>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 capitalize">
                        {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={() => changeMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </header>

                <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-slate-500 mb-2">
                    {weekDays.map(day => <div key={day}>{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {daysInMonth.map((day, index) => {
                        const dayAgendamentos = day ? agendamentosByDate.get(day.toDateString()) || [] : [];
                        return (
                            <div
                                key={index}
                                onClick={() => day && setSelectedDate(day)}
                                className={`relative pt-[100%] rounded-md transition-colors duration-200 ${day ? 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700' : 'bg-transparent'}`}
                            >
                                {day && (
                                    <div className="absolute inset-0 p-1.5 flex flex-col items-center overflow-hidden">
                                        <span className={getDayNumberClasses(day)}>
                                            {day.getDate()}
                                        </span>
                                        {dayAgendamentos.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap justify-center items-center gap-1">
                                                {dayAgendamentos.slice(0, 3).map(ag => (
                                                    <div key={ag.id} className={`w-2 h-2 rounded-full ${getStatusColor(ag.status)}`} title={ag.clienteNome}></div>
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
            </div>

            <div className="mt-8 lg:mt-0 lg:w-96 lg:sticky lg:top-4">
                <div className="flex justify-between items-center pb-2 mb-4 border-b border-slate-200">
                    <div>
                        <span className="text-sm font-semibold text-slate-500">Agenda:</span>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">
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

                {selectedDayAgendamentos.length > 0 ? (
                    <div className="space-y-3">
                        {selectedDayAgendamentos.map(ag => {
                            const client = clientsById.get(ag.clienteId);
                            const bairro = client?.bairro;
                            return (
                                <button
                                    key={ag.id}
                                    onClick={() => onEditAgendamento(ag)}
                                    className="w-full text-left p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 hover:shadow-md"
                                >
                                    <div className="flex justify-between items-center gap-4">
                                        <div className="flex-grow min-w-0">
                                            <p className="font-bold text-lg text-slate-800 dark:text-slate-200 truncate">{ag.clienteNome}</p>
                                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                <StatusBadge status={ag.status} />
                                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium flex items-center gap-2">
                                                    <i className="far fa-clock text-slate-400"></i>
                                                    <span>
                                                        {new Date(ag.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        {' - '}
                                                        {new Date(ag.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </p>
                                                {bairro && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium flex items-center gap-2" title={formatFullAddress(client)}>
                                                        <i className="fas fa-map-marker-alt text-slate-400"></i>
                                                        <span>{bairro}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <i className="fas fa-chevron-right text-slate-400 flex-shrink-0"></i>
                                    </div>
                                    {ag.notes && (
                                        <p className="mt-3 text-sm text-slate-600 border-t border-slate-100 pt-3 whitespace-pre-wrap">{ag.notes}</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                        <ContentState
                            compact
                            iconClassName="fas fa-calendar-check"
                            title="Nenhum serviço agendado"
                            description="Crie um agendamento para o dia selecionado e acompanhe seus horários aqui."
                            actionLabel="Novo Agendamento"
                            actionIconClassName="fas fa-plus"
                            onAction={() => onCreateNewAgendamento(selectedDate)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgendaView;
