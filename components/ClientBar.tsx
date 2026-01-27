import React, { useState, useRef } from 'react';
import { Drawer } from 'vaul';
import { Client } from '../types';
import Tooltip from './ui/Tooltip';

interface ClientBarProps {
    selectedClient: Client | null;
    onSelectClientClick: () => void;
    onAddClient: () => void;
    onAddClientAI?: () => void;
    onEditClient: () => void;
    onDeleteClient: () => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
}

const formatAddress = (client: Client): string => {
    const parts = [
        client.logradouro,
        client.numero,
        client.bairro,
        client.cidade,
        client.uf
    ].filter(Boolean);
    return parts.join(', ');
};

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

const ClientBar: React.FC<ClientBarProps> = ({
    selectedClient,
    onSelectClientClick,
    onAddClient,
    onAddClientAI,
    onEditClient,
    onDeleteClient,
    onSwipeLeft,
    onSwipeRight,
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe || isRightSwipe) {
            if (isLeftSwipe) {
                onSwipeLeft();
            } else {
                onSwipeRight();
            }
        }
    };

    const handleOpenWhatsApp = () => {
        if (!selectedClient || !selectedClient.telefone) return;
        let phoneNumber = selectedClient.telefone.replace(/\D/g, '');
        if (!phoneNumber.startsWith('55')) {
            phoneNumber = '55' + phoneNumber;
        }
        const message = `Olá ${selectedClient.nome}, estou entrando em contato sobre o orçamento de películas.`;
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleCall = () => {
        if (!selectedClient || !selectedClient.telefone) return;
        window.open(`tel:${selectedClient.telefone}`, '_self');
    };

    const handleOpenMaps = () => {
        if (!fullAddress) return;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
        window.open(mapsUrl, '_blank');
    };

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
                className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition duration-200 ${disabled
                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                    : `text-slate-600 bg-white hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white ${className}`
                    }`}
                aria-label={tooltip}
            >
                <i className={`${icon} text-sm`}></i>
            </button>
        </Tooltip>
    );

    const fullAddress = selectedClient ? formatAddress(selectedClient) : '';

    const MenuItem: React.FC<{
        onClick: () => void;
        icon: string;
        label: string;
        isDestructive?: boolean;
        disabled?: boolean;
        isWhatsApp?: boolean;
        description?: string;
    }> = ({ onClick, icon, label, isDestructive = false, disabled = false, isWhatsApp = false, description }) => (
        <button
            onClick={() => {
                onClick();
                setIsMenuOpen(false);
            }}
            disabled={disabled}
            className={`w-full flex items-center gap-4 px-4 py-4 sm:py-3 text-left transition-colors 
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:bg-slate-100 dark:active:bg-slate-700 sm:hover:bg-slate-50 dark:sm:hover:bg-slate-700'}
                ${isDestructive ? 'text-red-600' : isWhatsApp ? 'text-green-600' : 'text-slate-700 dark:text-slate-200'}
            `}
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 
                ${isDestructive ? 'bg-red-50 dark:bg-red-900/20' : isWhatsApp ? 'bg-green-50 dark:bg-green-900/20' : 'bg-slate-100 dark:bg-slate-100'}
            `}>
                <i className={`${icon} text-lg`}></i>
            </div>
            <div className="flex-1">
                <span className="font-semibold block text-base">{label}</span>
                {description && <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{description}</span>}
            </div>
            <i className="fas fa-chevron-right text-slate-300 text-xs sm:hidden"></i>
        </button>
    );

    return (
        <div className="mb-4">
            {/* Mobile Layout */}
            <div
                className="sm:hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'pan-y' }}
            >
                {selectedClient ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 animate-fade-in-scale relative overflow-hidden">
                        <div
                            onClick={() => setIsMenuOpen(true)}
                            className="flex items-start gap-4 cursor-pointer active:opacity-70 transition-opacity"
                        >
                            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600">
                                <span className="text-xl font-bold text-slate-600 dark:text-slate-300">
                                    {getInitials(selectedClient.nome)}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5 pr-8">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight truncate mb-1">
                                    {selectedClient.nome}
                                </h2>
                                <div className="flex flex-col gap-1">
                                    {selectedClient.telefone && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                            <i className="fas fa-phone text-xs text-slate-400 w-4 text-center"></i>
                                            <span>{selectedClient.telefone}</span>
                                        </div>
                                    )}
                                    {fullAddress && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                                            <i className="fas fa-map-marker-alt text-xs text-slate-400 w-4 text-center flex-shrink-0"></i>
                                            <span className="truncate">{fullAddress}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            {onAddClientAI && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddClientAI();
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                    aria-label="Cadastrar Cliente com IA"
                                >
                                    <i className="fas fa-wand-magic-sparkles text-sm"></i>
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectClientClick();
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                aria-label="Trocar cliente"
                            >
                                <i className="fas fa-exchange-alt text-sm"></i>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={onSelectClientClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors animate-fade-in"
                    >
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                            <i className="fas fa-user-plus"></i>
                        </div>
                        <span className="font-medium text-slate-600 dark:text-slate-300">Selecionar Cliente</span>
                    </div>
                )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                <div
                    onClick={onSelectClientClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                    className="text-left flex-grow pr-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                    aria-label="Trocar de cliente"
                >
                    {selectedClient ? (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Cliente:</span>
                                {selectedClient.telefone && (
                                    <span className="font-medium text-sm text-slate-600 dark:text-slate-300">
                                        {selectedClient.telefone}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight truncate mt-0.5">
                                {selectedClient.nome}
                            </h2>
                            {fullAddress && (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 group flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors"
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
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight truncate mt-1">
                                Nenhum cliente selecionado
                            </h2>
                        </>
                    )}
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                    {selectedClient && selectedClient.telefone && (
                        <ActionButton
                            onClick={handleOpenWhatsApp}
                            icon="fab fa-whatsapp"
                            tooltip="Abrir WhatsApp"
                            className="text-green-600 hover:bg-green-100"
                        />
                    )}
                    <ActionButton
                        onClick={handleOpenMaps}
                        icon="fas fa-map-marker-alt"
                        tooltip="Ver no Mapa"
                        className="text-blue-600 hover:bg-blue-100"
                        disabled={!fullAddress}
                    />
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

            {/* Mobile Bottom Sheet */}
            <Drawer.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]" />
                    <Drawer.Content className="sm:hidden fixed bottom-0 left-0 right-0 z-[9999] flex flex-col bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl max-h-[85vh] outline-none">
                        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                        </div>
                        <div className="px-4 pb-4 pt-2 overflow-y-auto overscroll-contain">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 px-2">Ações do Cliente</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 px-2 mb-4">O que deseja fazer com {selectedClient?.nome}?</p>
                            <div className="space-y-1">
                                <MenuItem
                                    onClick={handleOpenWhatsApp}
                                    icon="fab fa-whatsapp"
                                    label="Enviar WhatsApp"
                                    description="Iniciar conversa direta"
                                    isWhatsApp
                                    disabled={!selectedClient?.telefone}
                                />
                                <MenuItem
                                    onClick={handleCall}
                                    icon="fas fa-phone"
                                    label="Ligar"
                                    description="Fazer uma chamada de voz"
                                    disabled={!selectedClient?.telefone}
                                />
                                <MenuItem
                                    onClick={handleOpenMaps}
                                    icon="fas fa-map-marker-alt"
                                    label="Ver Endereço"
                                    description="Abrir no Google Maps"
                                    disabled={!fullAddress}
                                />
                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                                <MenuItem
                                    onClick={onEditClient}
                                    icon="fas fa-pen"
                                    label="Editar Dados"
                                    description="Alterar informações do cliente"
                                />
                                <MenuItem
                                    onClick={onAddClient}
                                    icon="fas fa-user-plus"
                                    label="Novo Cliente"
                                    description="Cadastrar outra pessoa"
                                />
                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                                <MenuItem
                                    onClick={onDeleteClient}
                                    icon="fas fa-trash-alt"
                                    label="Excluir Cliente"
                                    description="Remover permanentemente"
                                    isDestructive
                                />
                            </div>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="w-full mt-6 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl"
                            >
                                Cancelar
                            </button>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            <style jsx>{`
                @keyframes fade-in-scale {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.3s ease-out forwards;
                }
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

export default React.memo(ClientBar);