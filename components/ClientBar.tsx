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
                    <div className="glass dark:bg-slate-900/60 rounded-xl border border-white/20 dark:border-white/5 shadow-lg p-3 animate-fade-in-scale relative overflow-hidden group">
                        {/* Subtle background gradient for depth */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>

                        <div className="flex items-center justify-between gap-3 relative z-10">
                            {/* Clickable Area for Menu */}
                            <div
                                onClick={() => setIsMenuOpen(true)}
                                className="flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity flex items-center gap-3"
                            >
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-md border border-white/10">
                                    <span className="text-sm font-bold text-white tracking-tight">
                                        {getInitials(selectedClient.nome)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight truncate tracking-tight">
                                        {selectedClient.nome}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {selectedClient.telefone && (
                                            <span className="text-xs font-medium text-blue-500 dark:text-blue-400 whitespace-nowrap">
                                                {selectedClient.telefone}
                                            </span>
                                        )}
                                        {fullAddress && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0"></span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                                    {selectedClient.bairro || selectedClient.cidade}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Icons */}
                            <div className="flex items-center gap-1">
                                {onAddClientAI && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddClientAI();
                                        }}
                                        className="w-11 h-11 flex items-center justify-center rounded-xl text-blue-500 dark:text-blue-400 active:bg-blue-500/10 transition-all"
                                        aria-label="IA"
                                    >
                                        <i className="fas fa-wand-magic-sparkles text-sm"></i>
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectClientClick();
                                    }}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 active:bg-slate-500/10 transition-all"
                                    aria-label="Trocar"
                                >
                                    <i className="fas fa-exchange-alt text-sm"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={onSelectClientClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                        className="glass dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 flex items-center justify-center gap-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group animate-fade-in"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all">
                            <i className="fas fa-user-plus text-lg"></i>
                        </div>
                        <span className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">Selecionar Cliente</span>
                    </div>
                )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between glass dark:bg-slate-900/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

                <div
                    onClick={onSelectClientClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                    className="text-left flex-grow pr-6 py-1 rounded-xl hover:bg-white/40 dark:hover:bg-slate-800/40 transition-all min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 relative z-10 group"
                    aria-label="Trocar de cliente"
                >
                    {selectedClient ? (
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20 border border-white/10 group-hover:scale-105 transition-transform">
                                <span className="text-xl font-bold text-white tracking-tight">
                                    {getInitials(selectedClient.nome)}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-[10px] font-bold uppercase text-blue-500 dark:text-blue-400 tracking-[0.2em]">Cliente Selecionado</span>
                                    {selectedClient.telefone && (
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            {selectedClient.telefone}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight truncate tracking-tight">
                                    {selectedClient.nome}
                                </h2>
                                {fullAddress && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1.5 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors"
                                        aria-label={`Abrir endereço no mapa: ${fullAddress}`}
                                    >
                                        <i className="fas fa-map-marker-alt text-[10px]"></i>
                                        <span className="truncate hover:underline">{fullAddress}</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                <i className="fas fa-user-plus text-xl"></i>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em]">Aguardando</span>
                                <h2 className="text-2xl font-bold text-slate-400 dark:text-600 leading-tight truncate tracking-tight">
                                    Nenhum cliente selecionado
                                </h2>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0 relative z-10">
                    {selectedClient && selectedClient.telefone && (
                        <ActionButton
                            onClick={handleOpenWhatsApp}
                            icon="fab fa-whatsapp"
                            tooltip="Abrir WhatsApp"
                            className="!w-11 !h-11 !rounded-xl text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                        />
                    )}
                    <ActionButton
                        onClick={handleOpenMaps}
                        icon="fas fa-map-marker-alt"
                        tooltip="Ver no Mapa"
                        className="!w-11 !h-11 !rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        disabled={!fullAddress}
                    />
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <ActionButton
                        onClick={onAddClient}
                        icon="fas fa-plus"
                        tooltip="Adicionar Novo Cliente"
                        className="!w-11 !h-11 !rounded-xl bg-slate-100 dark:bg-slate-800"
                    />
                    <ActionButton
                        onClick={onEditClient}
                        icon="fas fa-pen"
                        tooltip="Editar Cliente Atual"
                        className="!w-11 !h-11 !rounded-xl bg-slate-100 dark:bg-slate-800"
                        disabled={!selectedClient}
                    />
                    <ActionButton
                        onClick={onDeleteClient}
                        icon="fas fa-trash-alt"
                        tooltip="Excluir Cliente Atual"
                        className="!w-11 !h-11 !rounded-xl text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                        disabled={!selectedClient}
                    />
                </div>
            </div>

            {/* Mobile Bottom Sheet */}
            <Drawer.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]" />
                    <Drawer.Content className="sm:hidden fixed bottom-0 left-0 right-0 z-[9999] flex flex-col bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl max-h-[85vh] outline-none border-t border-white/10">
                        <div className="flex justify-center pt-4 pb-2 flex-shrink-0">
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                        </div>
                        <div className="px-6 pb-8 pt-4 overflow-y-auto overscroll-contain">
                            <div className="mb-6 px-2">
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Ações do Cliente</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">O que deseja fazer com <span className="font-bold text-blue-500">{selectedClient?.nome}</span>?</p>
                            </div>

                            <div className="space-y-2">
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
                                <div className="py-2">
                                    <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                                </div>
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
                                <div className="py-2">
                                    <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                                </div>
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
                                className="w-full mt-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            <style jsx>{`
                @keyframes fade-in-scale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default React.memo(ClientBar);
