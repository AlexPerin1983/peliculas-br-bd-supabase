
import React, { useState, useEffect, FormEvent } from 'react';
import { Agendamento, Client, UserInfo, SavedPDF } from '../../types';
import { SchedulingInfo } from '../../App';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import SearchableSelect from '../ui/SearchableSelect';
import { GoogleGenAI, Type } from "@google/genai";

interface AgendamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (agendamento: Omit<Agendamento, 'id'> | Agendamento) => void;
    onDelete: (agendamento: Agendamento) => void;
    schedulingInfo: SchedulingInfo;
    clients: Client[];
    onAddNewClient: (clientName: string) => void;
    userInfo: UserInfo | null;
    agendamentos: Agendamento[];
}

type AISuggestion = {
    startTime: string;
    endTime: string;
    reason: string;
};

const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status = 'pending' }) => {
    const statusInfo = {
        approved: { text: 'Aprovado', classes: 'bg-green-100 text-green-800' },
        revised: { text: 'Revisar', classes: 'bg-yellow-100 text-yellow-800' },
        pending: { text: 'Pendente', classes: 'bg-slate-200 text-slate-800' }
    };
    const { text, classes } = statusInfo[status];
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes}`}>{text}</span>;
};

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// FIX: Added a helper function to construct a full address from the Client object's
// structured address fields, resolving the error where 'client.endereco' was used
// after being refactored.
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

const AgendamentoModal: React.FC<AgendamentoModalProps> = ({ isOpen, onClose, onSave, onDelete, schedulingInfo, clients, onAddNewClient, userInfo, agendamentos }) => {
    const agendamento = schedulingInfo.agendamento;
    const pdf = 'pdf' in schedulingInfo ? schedulingInfo.pdf : undefined;
    
    const isEditing = !!agendamento?.id;
    const isClientLocked = !!pdf?.clienteId || !!agendamento?.pdfId;

    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('11:00');
    const [notes, setNotes] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[] | null>(null);

    useEffect(() => {
        if (isOpen) {
            setValidationError(null);
            setAiSuggestions(null);
            const initialClientId = agendamento?.clienteId || pdf?.clienteId || null;
            setSelectedClientId(initialClientId);

            if (isEditing && agendamento?.start && agendamento?.end) {
                const startDate = new Date(agendamento.start);
                const endDate = new Date(agendamento.end);
                setDate(startDate.toISOString().split('T')[0]);
                setStartTime(startDate.toTimeString().split(' ')[0].substring(0, 5));
                setEndTime(endDate.toTimeString().split(' ')[0].substring(0, 5));
                setNotes(agendamento.notes || '');
            } else if(agendamento?.start) {
                const startDate = new Date(agendamento.start);
                setDate(startDate.toISOString().split('T')[0]);
                setStartTime(startDate.toTimeString().split(' ')[0].substring(0, 5));
                const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours later
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

    const handleClientMagicClick = (clientName: string) => {
        alert(`Recurso de IA para o cliente "${clientName}" ainda não implementado.`);
    };

    const handleAISuggestion = async () => {
        setIsSuggesting(true);
        setValidationError(null);
        setAiSuggestions(null);

        if (!userInfo?.aiConfig?.apiKey || userInfo.aiConfig.provider !== 'gemini') {
            setValidationError("A sugestão por IA requer uma chave de API do Gemini configurada na aba 'Empresa'.");
            setIsSuggesting(false);
            return;
        }
        if (!selectedClientId || !date) {
            setValidationError("Selecione um cliente e uma data para obter sugestões.");
            setIsSuggesting(false);
            return;
        }

        const client = clients.find(c => c.id === selectedClientId);
        // FIX: The 'Client' type's 'endereco' property was refactored into structured fields.
        // This creates a full address string for use in the AI prompt.
        const clientAddress = client ? formatClientAddress(client) : '';
        if (!client || !clientAddress.trim()) {
             setValidationError("O cliente selecionado precisa ter um endereço cadastrado para a otimização de rota.");
             setIsSuggesting(false);
             return;
        }

        try {
            // FIX: Add optional chaining to prevent runtime error if userInfo is null.
            const companyAddress = userInfo?.endereco || 'Endereço da empresa não configurado';
            const newClientAddress = clientAddress;
            // FIX: Ensure Map is correctly typed to prevent type inference issues.
            const clientsById: Map<number, Client> = new Map(clients.filter(c => c.id != null).map(c => [c.id!, c]));

            const appointmentsOnDate = agendamentos
                .filter(ag => new Date(ag.start).toDateString() === new Date(date + 'T12:00:00Z').toDateString())
                .map(ag => {
                    const agClient = clientsById.get(ag.clienteId);
                    return {
                        start: new Date(ag.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        end: new Date(ag.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        address: agClient ? formatClientAddress(agClient) : 'Endereço desconhecido'
                    };
                });
            
            const prompt = `
                Você é um especialista em logística e agendamento. Sua tarefa é encontrar os melhores horários para um novo agendamento para minimizar o tempo total de deslocamento do dia.

                **Contexto:**
                - A base da empresa fica em: "${companyAddress}".
                - O horário de trabalho é das ${userInfo.workingHours?.start || '08:00'} às ${userInfo.workingHours?.end || '18:00'}.
                - O novo agendamento é para um cliente no endereço: "${newClientAddress}". A duração do serviço será de aproximadamente 2 horas.
                - A data do agendamento é ${new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR')}.

                **Agenda existente para este dia:**
                ${appointmentsOnDate.length > 0 ? appointmentsOnDate.map(ag => `- Das ${ag.start} às ${ag.end} em "${ag.address}"`).join('\n') : 'Nenhum agendamento para este dia.'}

                **Sua Tarefa:**
                1. Analise a localização geográfica da base da empresa, dos agendamentos existentes e do novo agendamento.
                2. Sugira 3 horários ideais (início e fim) para o novo agendamento de 2 horas.
                3. Priorize horários que agrupem agendamentos em locais próximos para criar uma rota lógica e eficiente. Considere o deslocamento a partir da base no início do dia, entre agendamentos, e de volta para a base no final do dia.
                4. Para cada sugestão, forneça uma breve justificativa (ex: "Logo após o agendamento no bairro vizinho", "Primeiro horário para otimizar a rota da manhã").

                **Formato da Resposta:**
                Responda APENAS com um objeto JSON válido que corresponda ao schema fornecido.
            `;

            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        startTime: { type: Type.STRING, description: 'Horário de início sugerido no formato "HH:mm".' },
                        endTime: { type: Type.STRING, description: 'Horário de término sugerido no formato "HH:mm".' },
                        reason: { type: Type.STRING, description: 'Breve justificativa para a sugestão.' },
                    },
                    required: ['startTime', 'endTime', 'reason']
                }
            };
            
            const ai = new GoogleGenAI({ apiKey: userInfo.aiConfig.apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema }
            });
            
            const suggestions = JSON.parse(response.text.trim());
            setAiSuggestions(suggestions);

        } catch (error) {
            console.error("Erro ao obter sugestões da IA:", error);
            setValidationError(`Ocorreu um erro ao comunicar com a IA. Detalhes: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleApplySuggestion = (suggestion: AISuggestion) => {
        setStartTime(suggestion.startTime);
        setEndTime(suggestion.endTime);
        setAiSuggestions(null); // Clear suggestions after applying one
    };


    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
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

        if (!userInfo || !userInfo.workingHours || !userInfo.employees) {
            setValidationError("Configurações da empresa (horário, equipe) não encontradas. Por favor, configure na aba 'Empresa'.");
            return;
        }
        
        const maxAppointments = userInfo.employees.length;
        if (maxAppointments === 0) {
            setValidationError('Não há colaboradores cadastrados para realizar agendamentos. Adicione um colaborador na aba "Empresa".');
            return;
        }

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
        if (startTime < scheduleStart || endTime > scheduleEnd) {
            setValidationError(`O horário deve ser entre ${scheduleStart} e ${scheduleEnd}.`);
            return;
        }

        const conflictingAppointments = agendamentos.filter(ag => {
            if (isEditing && ag.id === agendamento?.id) return false;
            const existingStart = new Date(ag.start);
            const existingEnd = new Date(ag.end);
            return startDateTime < existingEnd && endDateTime > existingStart;
        });

        if (conflictingAppointments.length >= maxAppointments) {
            setValidationError(`Todos os ${maxAppointments} colaboradores já estão ocupados neste horário.`);
            return;
        }
        
        const agendamentoPayload: Omit<Agendamento, 'id'> | Agendamento = {
            clienteId: client.id!,
            clienteNome: client.nome,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            notes: notes,
            pdfId: pdf?.id || agendamento?.pdfId,
        };

        if (isEditing) {
            (agendamentoPayload as Agendamento).id = agendamento!.id;
        }

        onSave(agendamentoPayload);
    };
    
    const handleDelete = () => {
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
    
    const footerContent = (
        <>
            <div className="flex items-center gap-2 mr-auto">
                {isEditing && (
                    <>
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                            Excluir
                        </button>
                         <button
                            type="button"
                            onClick={handleExportToCalendar}
                            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <i className="fas fa-file-export"></i>
                            Exportar
                        </button>
                    </>
                )}
            </div>
            <button
                type="button"
                onClick={onClose}
                className="font-semibold text-slate-700 px-4 py-2 hover:bg-slate-100 rounded-md"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="agendamentoForm"
                className="font-semibold text-white bg-slate-800 px-5 py-2.5 rounded-lg shadow-sm hover:bg-slate-700"
            >
                {isEditing ? 'Salvar' : 'Agendar'}
            </button>
        </>
    );

    const inputClassName = "bg-slate-100/70 border-slate-200 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-slate-400 focus:ring-1";
    const textareaClassName = `${inputClassName} min-h-[120px] resize-none`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Editar Agendamento" : "Novo Agendamento"} footer={footerContent}>
            <form id="agendamentoForm" onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                    <SearchableSelect
                        options={clients}
                        value={selectedClientId}
                        onChange={(id) => setSelectedClientId(id as number | null)}
                        displayField="nome"
                        valueField="id"
                        placeholder="Selecione ou digite um nome"
                        disabled={isClientLocked}
                        autoFocus={!isClientLocked}
                        onMagicClick={handleClientMagicClick}
                        renderNoResults={(searchTerm) => (
                            <li className="p-3 text-center">
                                <p className="text-sm text-slate-500 mb-3">
                                    Nenhum cliente encontrado.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => onAddNewClient(searchTerm)}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition text-sm flex items-center justify-center gap-2 mx-auto"
                                >
                                    <i className="fas fa-plus"></i>
                                    Adicionar "{searchTerm}"
                                </button>
                            </li>
                        )}
                    />
                </div>

                {pdf && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold text-slate-600">Orçamento Associado</h4>
                            <StatusBadge status={pdf.status} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                             <span className="text-slate-500">{new Date(pdf.date).toLocaleDateString('pt-BR')}</span>
                             <span className="font-semibold text-slate-700">{formatCurrency(pdf.totalPreco)}</span>
                        </div>
                    </div>
                )}
                
                <div>
                    <div className="flex justify-between items-center mb-1">
                         <label htmlFor="date" className="block text-sm font-medium text-slate-700">Data</label>
                         <button 
                            type="button" 
                            onClick={handleAISuggestion}
                            disabled={isSuggesting || !date || !selectedClientId}
                            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSuggesting ? (
                                <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                                <i className="fas fa-magic-sparkles"></i>
                            )}
                            Sugerir com IA
                        </button>
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

                {aiSuggestions && aiSuggestions.length > 0 && (
                     <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <h4 className="text-sm font-semibold text-blue-800">Sugestões da IA:</h4>
                        {aiSuggestions.map((sug, index) => (
                             <button
                                key={index}
                                type="button"
                                onClick={() => handleApplySuggestion(sug)}
                                className="w-full text-left p-2 bg-white rounded-md border border-blue-200 hover:bg-blue-100 transition-colors"
                             >
                                <p className="font-semibold text-slate-800">{sug.startTime} - {sug.endTime}</p>
                                <p className="text-xs text-slate-600">{sug.reason}</p>
                             </button>
                        ))}
                    </div>
                )}
               
                <div className="grid grid-cols-2 gap-4">
                    <Input id="startTime" label="Início" type="time" value={startTime} onChange={(e) => setStartTime((e.target as HTMLInputElement).value)} required className={inputClassName}/>
                    <Input id="endTime" label="Término" type="time" value={endTime} onChange={(e) => setEndTime((e.target as HTMLInputElement).value)} required className={inputClassName} />
                </div>
                
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
            </form>
        </Modal>
    );
};

export default AgendamentoModal;
