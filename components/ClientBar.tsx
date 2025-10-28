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
    const touchStartY = useRef(0); // Adicionado touchStartY
    const touchStartTime = useRef(0);
    const isSwiping = useRef(false);
    const SWIPE_THRESHOLD = 50;
    const TIME_THRESHOLD = 500;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
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
        // Previne o scroll horizontal da página enquanto desliza
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
                className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition duration-200 ${
                    disabled
                        ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                        : `text-slate-600 bg-white hover:bg-slate-200 hover:text-slate-800 ${className}`
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
    }> = ({ onClick, icon, label, isDestructive = false, disabled = false }) => (
        <button
            onClick={() => {
                onClick();
                setIsMenuOpen(false);
            }}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : isDestructive
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-100'
            }`}
        >
            <i className={`${icon} w-4 text-center`}></i>
            <span className="font-medium">{label}</span>
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
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
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
                                <h2 className="text-base font-bold text-slate-800 leading-tight truncate">
                                    {selectedClient.nome}
                                </h2>
                                
                                {/* Info row */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
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
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                                    aria-label="Menu de opções"
                                >
                                    <i className="fas fa-ellipsis-v"></i>
                                </button>

                                {/* Dropdown menu */}
                                {isMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
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
                                        <div className="border-t border-slate-200 my-1"></div>
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
                        className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors"
                        aria-label="Selecionar cliente"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                    <i className="fas fa-users text-slate-400 text-sm"></i>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-500">Nenhum cliente selecionado</p>
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
        </div>
    );
};

export default React.memo(ClientBar);