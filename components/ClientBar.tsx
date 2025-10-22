import React from 'react';
import { Client } from '../types';
import Tooltip from './ui/Tooltip';

interface ClientBarProps {
    selectedClient: Client | null;
    onSelectClientClick: () => void;
    onAddClient: () => void;
    onEditClient: () => void;
    onDeleteClient: () => void;
}

const formatAddress = (client: Client): string => {
    const parts = [
        client.logradouro,
        client.numero,
        client.bairro,
        client.cidade,
        client.uf,
    ];
    return parts.filter(Boolean).join(', ');
}

const ClientBar: React.FC<ClientBarProps> = ({
    selectedClient,
    onSelectClientClick,
    onAddClient,
    onEditClient,
    onDeleteClient,
}) => {
    
    const ActionButton: React.FC<{
        onClick: () => void;
        icon: string;
        tooltip: string;
        className?: string;
        disabled?: boolean;
    }> = ({ onClick, icon, tooltip, className = '', disabled = false }) => (
        <Tooltip text={tooltip}>
            <button
                onClick={onClick}
                disabled={disabled}
                className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition duration-200 ${
                    disabled
                        ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                        : `text-slate-600 bg-white hover:bg-slate-200 hover:text-slate-800 ${className}`
                }`}
                aria-label={tooltip}
            >
                <i className={icon}></i>
            </button>
        </Tooltip>
    );

    const fullAddress = selectedClient ? formatAddress(selectedClient) : '';

    return (
        <div className="flex items-center justify-between mb-4">
            <div 
                onClick={onSelectClientClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                className="text-left flex-grow pr-4 py-2 rounded-lg hover:bg-slate-50 transition-colors min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Trocar de cliente"
            >
                {selectedClient ? (
                    <>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Cliente:</span>
                            {selectedClient.telefone && (
                                <span className="font-medium text-sm text-slate-600">
                                    {selectedClient.telefone}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight truncate mt-0.5">
                            {selectedClient.nome}
                        </h2>
                        {fullAddress && (
                             <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 group flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                                aria-label={`Abrir endereço no mapa: ${fullAddress}`}
                            >
                                <i className="fas fa-map-marker-alt text-slate-400 group-hover:text-blue-500 flex-shrink-0"></i>
                                <span className="truncate group-hover:underline">{fullAddress}</span>
                            </a>
                        )}
                    </>
                ) : (
                    <>
                        <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Cliente</span>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight truncate mt-1">
                            Nenhum cliente selecionado
                        </h2>
                    </>
                )}
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
                <ActionButton
                    onClick={onAddClient}
                    icon="fas fa-plus"
                    tooltip="Adicionar Novo Cliente"
                />
                <ActionButton
                    onClick={onEditClient}
                    icon="fas fa-pen"
                    tooltip="Editar Cliente Atual"
                    disabled={!selectedClient}
                />
                <ActionButton
                    onClick={onDeleteClient}
                    icon="fas fa-trash-alt"
                    tooltip="Excluir Cliente Atual"
                    className="hover:bg-red-100 hover:text-red-600"
                    disabled={!selectedClient}
                />
            </div>
        </div>
    );
};

export default React.memo(ClientBar);