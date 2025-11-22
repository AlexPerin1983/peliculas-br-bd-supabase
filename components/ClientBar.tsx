import React, { useState, useRef, useEffect } from 'react';
import { Client } from '../types';
import Tooltip from './ui/Tooltip';

interface ClientBarProps {
    selectedClient: Client | null;
    onSelectClientClick: () => void;
    onAddClient: () => void;
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
    onSwipeLeft,
    onSwipeRight,
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const isSwiping = useRef(false);
    const SWIPE_THRESHOLD = 50;
    const TIME_THRESHOLD = 500;

    // Sheet Swipe Logic
    const sheetTouchStartY = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    const handleSheetTouchStart = (e: React.TouchEvent) => {
        sheetTouchStartY.current = e.touches[0].clientY;
        // Disable transition during drag for instant response
        if (sheetRef.current) {
            sheetRef.current.style.transition = 'none';
        }
    };

    const handleSheetTouchMove = (e: React.TouchEvent) => {
        // We don't call preventDefault here to avoid 'passive event listener' warnings
        // Instead, we rely on CSS 'touch-action: none' on the handle

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - sheetTouchStartY.current;

        // Only allow dragging down (positive deltaY)
        if (deltaY > 0 && sheetRef.current) {
            sheetRef.current.style.transform = `translateY(${deltaY}px)`;
        }
    };

    const handleSheetTouchEnd = (e: React.TouchEvent) => {
        const currentY = e.changedTouches[0].clientY;
        const deltaY = currentY - sheetTouchStartY.current;

        if (deltaY > 100) { // Threshold to close
            setIsMenuOpen(false);
        } else if (sheetRef.current) {
            // Snap back if not dragged enough
            sheetRef.current.style.transition = 'transform 0.3s ease-out';
            sheetRef.current.style.transform = '';
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                // Only close if it's NOT the bottom sheet overlay (handled separately)
                if (window.innerWidth >= 640) { // sm breakpoint
                    setIsMenuOpen(false);
                }
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Prevent body scroll when menu is open on mobile
            if (window.innerWidth < 640) {
                document.body.style.overflow = 'hidden';
            }
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Ignora se o menu de opções estiver aberto
        if (isMenuOpen) return;

        // Ignora se o toque começar em um botão ou link
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) return;

        isSwiping.current = true;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY; // Inicializado touchStartY
        touchStartTime.current = Date.now();
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping.current) return;
        // Não previne o default aqui para permitir o scroll vertical
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!isSwiping.current) return;
        isSwiping.current = false;

        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current; // Usando touchStartY
        const deltaTime = Date.now() - touchStartTime.current;

        // Verifica se o movimento foi predominantemente horizontal (para evitar conflito com scroll vertical)
        if (Math.abs(deltaY) > Math.abs(deltaX)) return; // Se for mais vertical, ignora

        if (deltaTime < TIME_THRESHOLD && Math.abs(deltaX) > SWIPE_THRESHOLD) {
            if (deltaX > 0) {
                // Swipe Right (Cliente Anterior)
                onSwipeRight();
            } else {
                // Swipe Left (Próximo Cliente)
                onSwipeLeft();
            }
        }
    };

    const handleOpenWhatsApp = () => {
        if (!selectedClient || !selectedClient.telefone) return;

        // Remove todos os caracteres não numéricos, exceto o '+' se for o primeiro caractere
        let phoneNumber = selectedClient.telefone.replace(/\D/g, '');

        // Se o número não começar com 55 (código do Brasil), adicionamos
        if (!phoneNumber.startsWith('55')) {
            // Assumimos que o número já tem o DDD, então adicionamos '55'
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
                ${isDestructive ? 'bg-red-50 dark:bg-red-900/20' : isWhatsApp ? 'bg-green-50 dark:bg-green-900/20' : 'bg-slate-100 dark:bg-slate-700'}
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
                style={{ touchAction: 'pan-y' }} // Permite o scroll vertical, mas captura o horizontal
            >
                {selectedClient ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 animate-fade-in-scale">
                        <div className="flex items-start gap-3">
                            {/* Avatar - Agora clicável e com ícone de múltiplos clientes */}
                            <div
                                onClick={onSelectClientClick}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                                aria-label="Trocar de cliente"
                            >
                                <i className="fas fa-users text-white text-sm"></i>
                            </div>

                            {/* Client Info - Clicável */}
                            <div
                                onClick={onSelectClientClick}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                                className="flex-1 min-w-0 cursor-pointer"
                                aria-label="Trocar de cliente"
                            >
                                <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight truncate">
                                    {selectedClient.nome}
                                </h2>

                                {/* Info row */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 mt-1">
                                    {selectedClient.telefone && (
                                        <div className="flex items-center gap-1.5">
                                            <i className="fas fa-phone text-slate-400"></i>
                                            <span>{selectedClient.telefone}</span>
                                        </div>
                                    )}
                                    {fullAddress && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors min-w-0"
                                            aria-label={`Abrir endereço no mapa: ${fullAddress}`}
                                        >
                                            <i className="fas fa-map-marker-alt text-slate-400 flex-shrink-0"></i>
                                            <span className="truncate">{fullAddress}</span>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Menu button */}
                            <div className="relative flex-shrink-0" ref={menuRef}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(!isMenuOpen);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    aria-label="Menu de opções"
                                >
                                    <i className="fas fa-ellipsis-v"></i>
                                </button>

                                {/* Desktop Dropdown Only */}
                                {isMenuOpen && (
                                    <div className="hidden sm:block absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50">
                                        <MenuItem
                                            onClick={handleOpenWhatsApp}
                                            icon="fab fa-whatsapp"
                                            label="WhatsApp"
                                            isWhatsApp
                                            disabled={!selectedClient.telefone}
                                        />
                                        <MenuItem
                                            onClick={handleCall}
                                            icon="fas fa-phone"
                                            label="Ligar"
                                            disabled={!selectedClient.telefone}
                                        />
                                        <MenuItem
                                            onClick={handleOpenMaps}
                                            icon="fas fa-map-marker-alt"
                                            label="Endereço"
                                            disabled={!fullAddress}
                                        />
                                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                        <MenuItem
                                            onClick={onAddClient}
                                            icon="fas fa-plus"
                                            label="Novo Cliente"
                                        />
                                        <MenuItem
                                            onClick={onEditClient}
                                            icon="fas fa-pen"
                                            label="Editar"
                                        />
                                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                        <MenuItem
                                            onClick={onDeleteClient}
                                            icon="fas fa-trash-alt"
                                            label="Excluir"
                                            isDestructive
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={onSelectClientClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700 transition-colors animate-fade-in-scale"
                        aria-label="Selecionar cliente"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                    <i className="fas fa-users text-slate-400 text-sm"></i>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nenhum cliente selecionado</p>
                                    <p className="text-xs text-slate-400">Toque para selecionar</p>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddClient();
                                }}
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                aria-label="Adicionar cliente"
                            >
                                <i className="fas fa-plus text-sm"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop Layout - unchanged */}
            <div className="hidden sm:flex items-center justify-between">
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

            {/* Mobile Bottom Sheet - Rendered at root to avoid transform stacking context issues */}
            {isMenuOpen && (
                <div className="sm:hidden fixed inset-0 z-[9999] flex items-end justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                        onClick={() => setIsMenuOpen(false)}
                    ></div>

                    {/* Sheet */}
                    <div
                        ref={sheetRef}
                        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl animate-slide-up max-w-md mx-auto flex flex-col max-h-[85vh]"
                    >
                        {/* Drag Handle Area - Fixed at top */}
                        <div
                            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
                            onTouchStart={handleSheetTouchStart}
                            onTouchMove={handleSheetTouchMove}
                            onTouchEnd={handleSheetTouchEnd}
                        >
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                        </div>

                        {/* Scrollable Content Area */}
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
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes fade-in-scale {
                    from {
                        opacity: 0;
                        transform: scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.3s ease-out forwards;
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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