import React, { useState, useEffect, FormEvent } from 'react';
import { Agendamento, Client, UserInfo, SavedPDF } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import SearchableSelect from '../ui/SearchableSelect';
import ConfirmationModal from './ConfirmationModal';
import { SchedulingInfo } from '../../App'; // Importando o tipo do App.tsx

interface AgendamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (agendamento: Omit<Agendamento, 'id'> | Agendamento) => void;
    onDelete: (agendamento: Agendamento) => void;
    schedulingInfo: SchedulingInfo | null;
    clients: Client[];
    onAddNewClient: (clientName: string) => void;
    userInfo: UserInfo | null;
    agendamentos: Agendamento[];
}

const AgendamentoModal: React.FC<AgendamentoModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    schedulingInfo,
    clients,
    onAddNewClient,
    userInfo,
    agendamentos
}) => {
    const [formData, setFormData] = useState<Agendamento | Omit<Agendamento, 'id'>>({
        clienteId: 0,
        clienteNome: '',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        notes: '',
        pdfId: null,
    });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && schedulingInfo) {
            const initialAgendamento = schedulingInfo.agendamento;
            setFormData(initialAgendamento);
            
            const client = clients.find(c => c.id === initialAgendamento.clienteId);
            setClientSearchTerm(client?.nome || initialAgendamento.clienteNome || '');
        }
    }, [isOpen, schedulingInfo, clients]);

    if (!isOpen || !schedulingInfo) return null;
    
    const isEditMode = !!(formData as Agendamento).id;
    const currentPdf = schedulingInfo.pdf;

    const handleClientSelect = (clientId: number | null) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setFormData(prev => ({
                ...prev,
                clienteId: client.id!,
                clienteNome: client.nome,
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                clienteId: 0,
                clienteNome: '',
            }));
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        const isStart = id === 'start-date' || id === 'start-time';
        
        const currentStart = new Date(formData.start);
        const currentEnd = new Date(formData.end);
        
        let newDate = isStart ? currentStart : currentEnd;
        
        if (id.includes('date')) {
            const [year, month, day] = value.split('-').map(Number);
            newDate.setFullYear(year, month - 1, day);
        } else if (id.includes('time')) {
            const [hour, minute] = value.split(':').map(Number);
            newDate.setHours(hour, minute);
        }
        
        if (isStart) {
            // If start time changes, ensure end time is at least 1 hour later
            if (currentEnd.getTime() <= newDate.getTime()) {
                const newEnd = new Date(newDate.getTime() + 60 * 60 * 1000);
                setFormData(prev => ({ ...prev, start: newDate.toISOString(), end: newEnd.toISOString() }));
            } else {
                setFormData(prev => ({ ...prev, start: newDate.toISOString() }));
            }
        } else {
            setFormData(prev => ({ ...prev, end: newDate.toISOString() }));
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!formData.clienteId) {
            alert("Por favor, selecione um cliente.");
            return;
        }
        if (new Date(formData.start).getTime() >= new Date(formData.end).getTime()) {
            alert("A hora de início deve ser anterior à hora de término.");
            return;
        }
        
        // Basic validation for working hours (if configured)
        if (userInfo?.workingHours) {
            const startDay = new Date(formData.start).getDay();
            if (!userInfo.workingHours.days.includes(startDay)) {
                alert("O agendamento está fora dos dias de trabalho configurados.");
                return;
            }
            // More complex time validation omitted for brevity, assuming basic checks are enough for now.
        }
        
        onSave(formData);
    };
    
    const handleDelete = () => {
        setIsDeleteModalOpen(true);
    };
    
    const handleConfirmDelete = () => {
        onDelete(formData as Agendamento);
        setIsDeleteModalOpen(false);
    };

    const footer = (
        <>
            {isEditMode && (
                <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-red-50 text-red-600 hover:bg-red-100 mr-auto"
                >
                    Excluir
                </button>
            )}
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Cancelar
            </button>
            <button
                type="submit"
                form="agendamentoForm"
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                {isEditMode ? 'Salvar Alterações' : 'Agendar'}
            </button>
        </>
    );
    
    const startDate = new Date(formData.start).toISOString().split('T')[0];
    const startTime = new Date(formData.start).toTimeString().slice(0, 5);
    const endDate = new Date(formData.end).toISOString().split('T')[0];
    const endTime = new Date(formData.end).toTimeString().slice(0, 5);

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Editar Agendamento' : 'Novo Agendamento'} footer={footer}>
                <form id="agendamentoForm" onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Cliente Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                        <SearchableSelect
                            options={clients}
                            value={formData.clienteId}
                            onChange={handleClientSelect}
                            displayField="nome"
                            valueField="id"
                            placeholder="Buscar ou selecionar cliente..."
                            renderNoResults={(searchTerm) => (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onAddNewClient(searchTerm);
                                        onClose();
                                    }}
                                    className="w-full p-3 text-sm text-blue-600 hover:bg-blue-50 text-left"
                                >
                                    <i className="fas fa-plus mr-2"></i> Adicionar "{searchTerm}"
                                </button>
                            )}
                        />
                    </div>
                    
                    {/* PDF Link */}
                    {currentPdf && (
                        <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-1">Orçamento Vinculado:</p>
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-slate-800 font-medium">{currentPdf.proposalOptionName || currentPdf.nomeArquivo}</p>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${currentPdf.status === 'approved' ? 'bg-green-100 text-green-800' : currentPdf.status === 'revised' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-200 text-slate-800'}`}>
                                    {currentPdf.status === 'approved' ? 'Aprovado' : currentPdf.status === 'revised' ? 'Revisar' : 'Pendente'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Data and Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            id="start-date"
                            label="Data Início"
                            type="date"
                            value={startDate}
                            onChange={handleDateChange}
                            required
                        />
                        <Input
                            id="start-time"
                            label="Hora Início"
                            type="time"
                            value={startTime}
                            onChange={handleDateChange}
                            required
                        />
                        <Input
                            id="end-date"
                            label="Data Fim"
                            type="date"
                            value={endDate}
                            onChange={handleDateChange}
                            required
                        />
                        <Input
                            id="end-time"
                            label="Hora Fim"
                            type="time"
                            value={endTime}
                            onChange={handleDateChange}
                            required
                        />
                    </div>
                    
                    {/* Notes */}
                    <Input
                        as="textarea"
                        id="notes"
                        label="Notas do Agendamento"
                        value={formData.notes || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: (e.target as HTMLTextAreaElement).value }))}
                        placeholder="Detalhes da instalação, observações importantes..."
                    />
                </form>
            </Modal>
            
            {isDeleteModalOpen && (
                <ConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Confirmar Exclusão"
                    message="Tem certeza que deseja excluir este agendamento?"
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
        </>
    );
};

export default AgendamentoModal;