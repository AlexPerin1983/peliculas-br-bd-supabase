import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client } from '../../types';

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};


interface ClientSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onClientSelect: (id: number | null) => void;
    isLoading: boolean;
    onAddNewClient: (clientName: string) => void;
}

const ClientSelectionModal: React.FC<ClientSelectionModalProps> = ({
    isOpen,
    onClose,
    clients,
    onClientSelect,
    isLoading,
    onAddNewClient
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 200);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredClients = useMemo(() => {
        if (isLoading) return [];
        if (!debouncedSearchTerm) {
            return clients;
        }
        return clients.filter(client =>
            client.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
    }, [clients, debouncedSearchTerm, isLoading]);

    if (!isOpen) return null;

    const handleSelectClient = (id: number) => {
        onClientSelect(id);
        onClose();
    };

    const handleAddNew = () => {
        onAddNewClient(searchTerm);
    };
    
    const handleAddNewEmpty = () => {
        onAddNewClient('');
    }

    return (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-white sticky top-0">
                <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold text-slate-800">Selecionar Cliente</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                 <div className="mt-4 max-w-3xl mx-auto relative">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar pelo nome do cliente..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-100 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        disabled={isLoading}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto space-y-2">
                    {isLoading ? (
                        <div className="text-center p-10 text-slate-500">
                            <i className="fas fa-spinner fa-spin text-2xl"></i>
                            <p className="mt-2">Carregando clientes...</p>
                        </div>
                    ) : (
                        <>
                            {filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleSelectClient(client.id!)}
                                    className="w-full text-left p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors duration-150 flex items-center justify-between"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-800">{client.nome}</p>
                                        <p className="text-sm text-slate-500 mt-1">{client.telefone || 'Sem telefone'}</p>
                                    </div>
                                    <i className="fas fa-chevron-right text-slate-400"></i>
                                </button>
                            ))}
                            {filteredClients.length === 0 && debouncedSearchTerm && (
                                <div className="text-center py-10 px-4">
                                    <p className="text-slate-500 mb-4">Nenhum cliente encontrado com o nome <strong className="text-slate-700">"{debouncedSearchTerm}"</strong>.</p>
                                    <button
                                        onClick={handleAddNew}
                                        className="px-5 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition duration-300 shadow-sm flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <i className="fas fa-plus"></i>
                                        Adicionar "{debouncedSearchTerm}"
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            {/* Footer */}
             <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white sticky bottom-0">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={handleAddNewEmpty}
                        className="w-full p-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-md flex items-center justify-center gap-2"
                        disabled={isLoading}
                    >
                         <i className="fas fa-plus"></i>
                        Adicionar Novo Cliente
                    </button>
                </div>
            </div>
             <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default ClientSelectionModal;