import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import { ListSkeleton } from '../ui/Skeleton';

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

// Componente para item de cliente com long press para fixar
const ClientItem: React.FC<{
    client: Client;
    isConverted: boolean;
    onSelect: (id: number) => void;
    onTogglePin: (id: number) => void;
}> = ({ client, isConverted, onSelect, onTogglePin }) => {
    const [isPressing, setIsPressing] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const touchStartTime = useRef<number>(0);
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartTime.current = Date.now();
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        setIsPressing(true);

        longPressTimer.current = setTimeout(() => {
            // Vibração de feedback (se disponível)
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            onTogglePin(client.id!);
            setIsPressing(false);
        }, 800); // Aumentado para 800ms para evitar ativação acidental
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!longPressTimer.current) return;

        const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

        // Se mover mais que 5px, cancela o long press (considera como scroll)
        if (deltaX > 5 || deltaY > 5) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            setIsPressing(false);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        const pressDuration = Date.now() - touchStartTime.current;
        if (pressDuration < 800 && isPressing) {
            // Foi um toque rápido, seleciona o cliente
            // Verifica isPressing para garantir que não foi cancelado pelo move
            onSelect(client.id!);
        }

        setIsPressing(false);
    };

    const handleTouchCancel = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        setIsPressing(false);
    };

    const handleClick = () => {
        // Fallback para mouse events se necessário, mas touchEnd já lida com seleção
    };

    return (
        <button
            // onClick removido para evitar dupla chamada, touchEnd gerencia a seleção em touch devices
            // Mantemos onClick apenas se não for touch, mas como é híbrido, melhor confiar no touch logic para mobile
            // Para desktop (mouse), o onClick ainda é útil. Vamos manter mas prevenir default no touchEnd se necessário.
            // Simplificação: Vamos usar onClick apenas para seleção via mouse, e touchEnd para touch.
            onClick={() => {
                // Pequeno hack: se não foi um toque (touchStartTime é 0 ou muito antigo), é um clique de mouse
                if (Date.now() - touchStartTime.current > 1000) {
                    onSelect(client.id!);
                }
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            className={`w-full text-left px-4 py-3.5 bg-white/96 dark:bg-slate-800 border rounded-[18px] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-150 flex items-center justify-between gap-3 ${isPressing
                ? 'scale-[0.985] bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                : 'border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
                } ${client.pinned ? 'border-l-4 border-l-blue-500' : ''}`}
        >
            <div className="min-w-0 flex-grow">
                <div className="flex min-w-0 items-center gap-2">
                    {isConverted && (
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.14)]"
                            title="Cliente convertido"
                            aria-label="Cliente convertido"
                        />
                    )}
                    {client.pinned && (
                        <i className="fas fa-thumbtack text-[11px] text-blue-500"></i>
                    )}
                    <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-slate-200">{client.nome}</p>
                </div>
                <p className="mt-1 truncate text-[12px] text-slate-500 dark:text-slate-400">{client.telefone || 'Sem telefone'}</p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-700">
                <i className="fas fa-chevron-right text-[10px]"></i>
            </span>
        </button>
    );
};




interface ClientSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onClientSelect: (id: number | null) => void;
    isLoading: boolean;
    onAddNewClient: (clientName: string) => void;
    onTogglePin: (id: number) => void; // Nova prop para fixar/desfixar
    savedPdfs?: SavedPDF[];
}

const ClientSelectionModal: React.FC<ClientSelectionModalProps> = ({
    isOpen,
    onClose,
    clients,
    onClientSelect,
    isLoading,
    onAddNewClient,
    onTogglePin,
    savedPdfs = []
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 200);
    const [visibleCount, setVisibleCount] = useState(10);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setVisibleCount(10);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        setVisibleCount(10);
    }, [debouncedSearchTerm]);

    const filteredClients = useMemo(() => {
        if (isLoading) return [];
        let result = clients;
        if (debouncedSearchTerm) {
            result = clients.filter(client =>
                client.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            );
        }
        // Ordenar: fixados primeiro (pelo mais recente), depois por ID decrescente (mais recentes criados)
        // Importante: criar uma cópia do array para não mutar a prop original
        const resultCopy = [...result];

        return resultCopy.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            if (a.pinned && b.pinned) {
                // Ambos fixados: ordenar por pinnedAt decrescente (mais recente no topo)
                if (a.pinnedAt && b.pinnedAt) {
                    return b.pinnedAt - a.pinnedAt;
                }
                // Se não tiver pinnedAt (legado), mantém ordem estável ou por ID
                if (a.pinnedAt && !b.pinnedAt) return -1;
                if (!a.pinnedAt && b.pinnedAt) return 1;
                return (b.id || 0) - (a.id || 0);
            }
            // Não fixados: ordenar por ID decrescente (mais recentes primeiro)
            return (b.id || 0) - (a.id || 0);
        });
    }, [clients, debouncedSearchTerm, isLoading]);

    const convertedClientIds = useMemo(() => {
        return new Set(
            savedPdfs
                .filter(pdf => pdf.status === 'approved')
                .map(pdf => pdf.clienteId)
        );
    }, [savedPdfs]);

    const displayedClients = useMemo(() => {
        return filteredClients.slice(0, visibleCount);
    }, [filteredClients, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

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

    const handleClearSearch = () => {
        setSearchTerm('');
        inputRef.current?.focus();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/94 dark:bg-slate-900/95 backdrop-blur-md animate-fade-in">
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-slate-200/80 bg-white/94 p-3.5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/94">
                <div className="mx-auto max-w-3xl">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
                        >
                            <i className="fas fa-arrow-left text-[14px]"></i>
                        </button>

                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Clientes
                            </p>
                            <h2 className="truncate text-[1.15rem] font-semibold tracking-[-0.03em] text-slate-800 dark:text-slate-100">
                                Buscar cliente
                            </h2>
                        </div>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {filteredClients.length}
                        </span>
                    </div>

                    <div className="relative mt-3">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                            <i className="fas fa-search text-[12px] text-slate-400"></i>
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar pelo nome do cliente..."
                            className="h-11 w-full rounded-[16px] border border-slate-200 bg-slate-50/90 pl-10 pr-10 text-[14px] text-slate-800 shadow-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-800"
                            disabled={isLoading}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                aria-label="Limpar busca"
                            >
                                <i className="fas fa-times-circle text-[14px]"></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto space-y-2.5">
                    {isLoading ? (
                        <ListSkeleton count={6} />
                    ) : (
                        <>

                            {displayedClients.map(client => (
                                <ClientItem
                                    key={client.id}
                                    client={client}
                                    isConverted={Boolean(client.id && convertedClientIds.has(client.id))}
                                    onSelect={handleSelectClient}
                                    onTogglePin={onTogglePin}
                                />
                            ))}

                            {visibleCount < filteredClients.length && (
                                <div className="pt-4 flex justify-center">
                                    <ActionButton
                                        onClick={handleLoadMore}
                                        variant="secondary"
                                        iconClassName="fas fa-chevron-down"
                                    >
                                        Carregar mais
                                    </ActionButton>
                                </div>
                            )}
                            {filteredClients.length === 0 && debouncedSearchTerm && (
                                <ContentState
                                    compact
                                    iconClassName="fas fa-search"
                                    title="Nenhum cliente encontrado"
                                    description="Tente outro nome."
                                    actionLabel="Adicionar cliente"
                                    actionIconClassName="fas fa-plus"
                                    onAction={handleAddNew}
                                />
                            )}
                            {filteredClients.length === 0 && !debouncedSearchTerm && !isLoading && (
                                <ContentState
                                    compact
                                    iconClassName="fas fa-user-plus"
                                    title="Adicione seu primeiro cliente"
                                    description="Cadastre um cliente para começar um novo atendimento."
                                    actionLabel="Adicionar cliente"
                                    actionIconClassName="fas fa-plus"
                                    onAction={handleAddNewEmpty}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="flex-shrink-0 border-t border-slate-200/80 bg-white/94 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/94 sticky bottom-0">
                <div className="max-w-3xl mx-auto">
                    <ActionButton
                        onClick={handleAddNewEmpty}
                        className="w-full"
                        size="md"
                        iconClassName="fas fa-plus"
                        disabled={isLoading}
                    >
                        Adicionar Novo Cliente
                    </ActionButton>
                </div>
            </div>
      <style>{`
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
