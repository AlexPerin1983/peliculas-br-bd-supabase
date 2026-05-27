import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, MoreVertical, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { ProposalOption, ProposalPricingMode } from '../types';

const sanitizeOptionName = (name: string): string => {
    if (!name) return name;

    const corruptedPatterns = [
        /Op[Ã¯Â¿Â½\uFFFD]{1,4}o/gi,
        /Op\?+o/gi,
        /Op[\x00-\x1F]+o/gi,
    ];

    let sanitized = name;

    for (const pattern of corruptedPatterns) {
        sanitized = sanitized.replace(pattern, 'Opcao');
    }

    return sanitized;
};

const normalizeOptionName = (name: string): string => sanitizeOptionName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isDefaultOptionName = (name: string): boolean => /^opcao\s+\d+$/.test(normalizeOptionName(name));

const getFirstQuotedFilmName = (option: ProposalOption): string => {
    const measurement = option.measurements.find(item => (
        item.active !== false &&
        item.pelicula &&
        item.pelicula.trim().length > 0 &&
        item.pelicula.trim().toLowerCase() !== 'nenhuma'
    ));

    return measurement?.pelicula?.trim() || '';
};

const getOptionDisplayName = (option: ProposalOption): string => {
    const optionName = sanitizeOptionName(option.name).trim();
    const firstFilmName = getFirstQuotedFilmName(option);

    if (firstFilmName && (!optionName || isDefaultOptionName(optionName))) {
        return firstFilmName;
    }

    return optionName || firstFilmName || 'Opcao';
};

interface ProposalOptionsCarouselProps {
    options: ProposalOption[];
    activeOptionId: number;
    onSelectOption: (optionId: number) => void;
    onAddOption: () => void;
    onRenameOption: (optionId: number, newName: string) => void;
    onDeleteOption: (optionId: number) => void;
    onOpenPaymentConfig: () => void;
    onOpenExpenses: () => void;
    hasActivePaymentOverride: boolean;
    hasActiveExpenses: boolean;
    onSelectPricingMode: (pricingMode: ProposalPricingMode) => void;
    onSwipeDirectionChange: (direction: 'left' | 'right' | null, distance: number) => void;
    showOptionsStrip?: boolean;
    showPricingMode?: boolean;
}

const ProposalOptionsCarousel: React.FC<ProposalOptionsCarouselProps> = ({
    options,
    activeOptionId,
    onSelectOption,
    onRenameOption,
    onDeleteOption,
    onAddOption,
    onOpenPaymentConfig,
    onOpenExpenses,
    hasActivePaymentOverride,
    hasActiveExpenses,
    onSelectPricingMode,
    onSwipeDirectionChange,
    showOptionsStrip = true,
    showPricingMode = true
}) => {
    const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [actionsOptionId, setActionsOptionId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const previousActiveIdRef = useRef<number>(activeOptionId);

    useEffect(() => {
        const activeItem = itemRefs.current.get(activeOptionId);
        const carousel = carouselRef.current;

        if (activeItem && carousel) {
            const itemRect = activeItem.getBoundingClientRect();
            const carouselRect = carousel.getBoundingClientRect();
            const scrollPosition = activeItem.offsetLeft - (carouselRect.width / 2) + (itemRect.width / 2);

            carousel.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });

            if (previousActiveIdRef.current !== activeOptionId) {
                const previousIndex = options.findIndex(opt => opt.id === previousActiveIdRef.current);
                const currentIndex = options.findIndex(opt => opt.id === activeOptionId);

                if (previousIndex !== -1 && currentIndex !== -1) {
                    const distance = Math.abs(currentIndex - previousIndex);
                    const direction = currentIndex > previousIndex ? 'left' : 'right';

                    onSwipeDirectionChange(direction, distance);

                    setTimeout(() => {
                        onSwipeDirectionChange(null, 0);
                    }, 500);
                }
                previousActiveIdRef.current = activeOptionId;
            }
        }
    }, [activeOptionId, options, onSwipeDirectionChange]);

    useEffect(() => {
        if (editingOptionId !== null && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingOptionId]);

    useEffect(() => {
        if (!actionsOptionId) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActionsOptionId(null);
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => document.removeEventListener('keydown', handleEscape);
    }, [actionsOptionId]);

    const startEditingOption = (option: ProposalOption, initialName?: string) => {
        setEditingOptionId(option.id);
        setEditingName(initialName || sanitizeOptionName(option.name));
    };

    const handleSaveEdit = () => {
        if (editingOptionId !== null && editingName.trim()) {
            onRenameOption(editingOptionId, editingName.trim());
        }
        setEditingOptionId(null);
        setEditingName('');
    };

    const handleCancelEdit = () => {
        setEditingOptionId(null);
        setEditingName('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const setItemRef = useCallback((id: number, el: HTMLDivElement | null) => {
        if (el) {
            itemRefs.current.set(id, el);
        } else {
            itemRefs.current.delete(id);
        }
    }, []);

    const activeOption = options.find(option => option.id === activeOptionId) || null;
    const actionsOption = options.find(option => option.id === actionsOptionId) || null;
    const activePricingMode = activeOption?.generalDiscount?.pricingMode === 'labor_only' ? 'labor_only' : 'complete';
    const activePricingModeLabel = activePricingMode === 'labor_only' ? 'Mao de obra' : 'Servico completo';

    const closeActionsModal = () => setActionsOptionId(null);

    const runActionAndClose = (action: () => void) => {
        action();
        closeActionsModal();
    };

    const OptionActionItem: React.FC<{
        icon: React.ReactNode;
        label: string;
        description: string;
        onClick: () => void;
        tone?: 'default' | 'danger';
    }> = ({ icon, label, description, onClick, tone = 'default' }) => (
        <button
            type="button"
            onClick={onClick}
            className={`group flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors ${
                tone === 'danger'
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/25'
                    : 'text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'
            }`}
        >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${
                tone === 'danger'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300'
                    : 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] dark:text-blue-300'
            }`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{description}</span>
            </span>
        </button>
    );

    return (
        <div className="flex flex-col">
            {showOptionsStrip && (
                <div
                    ref={carouselRef}
                    className="flex items-center gap-2 overflow-x-scroll pb-2 border-b border-[var(--border-subtle)] snap-x snap-mandatory scrollbar-hide"
                    style={{ scrollPadding: '0 40%' }}
                >
                    {options.map((option) => {
                        const displayName = getOptionDisplayName(option);
                        const isActiveOption = activeOptionId === option.id;

                        return (
                            <div
                                key={option.id}
                                ref={(el) => setItemRef(option.id, el)}
                                className={`flex min-h-8 items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] border transition-all duration-200 flex-shrink-0 snap-center ${isActiveOption
                                    ? 'border-blue-500 bg-blue-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.24)] ring-1 ring-blue-300/25 dark:border-blue-400 dark:bg-blue-500 dark:text-white dark:ring-blue-300/20'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                                }`}
                            >
                                {editingOptionId === option.id ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={handleSaveEdit}
                                        onKeyDown={handleKeyDown}
                                        className="w-24 px-2 py-1 text-xs ui-field"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span
                                        onClick={() => onSelectOption(option.id)}
                                        className="max-w-[9rem] cursor-pointer truncate text-xs font-semibold"
                                        title={displayName}
                                    >
                                        {displayName}
                                    </span>
                                )}

                                {isActiveOption && editingOptionId !== option.id && (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setActionsOptionId(option.id);
                                        }}
                                        className="ml-0.5 flex h-6 w-5 shrink-0 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                                        aria-label={`Abrir acoes da opcao ${displayName}`}
                                        aria-haspopup="dialog"
                                        aria-expanded={actionsOptionId === option.id}
                                    >
                                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button
                        onClick={onAddOption}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] transition-colors snap-start"
                        aria-label="Adicionar nova opcao"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            )}

            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {activeOption && showPricingMode && (
                <div className="flex flex-col gap-2">
                    <div className="flex min-h-[64px] items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-hairline)] sm:gap-3 sm:px-3">
                        <div className="min-w-0 flex-1 px-1">
                            <div className="truncate ui-kicker sm:text-[10px]">
                                Tipo de cobranca
                            </div>
                            <div className="mt-0.5 truncate whitespace-nowrap text-[13px] font-black leading-tight text-[var(--text-strong)] sm:text-sm">
                                {activePricingModeLabel}
                            </div>
                        </div>

                        <div className="grid h-11 w-[64vw] max-w-[244px] shrink-0 grid-cols-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1 shadow-inner sm:w-[230px] sm:max-w-none">
                            <button
                                type="button"
                                onClick={() => onSelectPricingMode('complete')}
                                aria-pressed={activePricingMode === 'complete'}
                                className={`flex h-9 min-w-0 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold leading-none transition-all ${
                                    activePricingMode === 'complete'
                                        ? 'bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.24)] ring-1 ring-blue-300/25 dark:bg-blue-500 dark:ring-blue-300/20'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                                }`}
                            >
                                <span className="whitespace-nowrap">Completo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onSelectPricingMode('labor_only')}
                                aria-pressed={activePricingMode === 'labor_only'}
                                className={`flex h-9 min-w-0 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold leading-none transition-all ${
                                    activePricingMode === 'labor_only'
                                        ? 'bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.24)] ring-1 ring-blue-300/25 dark:bg-blue-500 dark:ring-blue-300/20'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                                }`}
                            >
                                <span className="whitespace-nowrap">Mao de obra</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {actionsOption && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[10020] flex items-end justify-center bg-slate-950/68 p-3 backdrop-blur-sm sm:items-center sm:p-4">
                    <button
                        type="button"
                        className="absolute inset-0 cursor-default"
                        aria-label="Fechar acoes da opcao"
                        onClick={closeActionsModal}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Acoes da opcao ${getOptionDisplayName(actionsOption)}`}
                        className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-elevated)] animate-fade-in-scale"
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3.5">
                            <div className="min-w-0">
                                <p className="ui-kicker">Opcao ativa</p>
                                <h2 className="mt-1 truncate text-lg font-black leading-tight text-[var(--text-strong)]">
                                    {getOptionDisplayName(actionsOption)}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={closeActionsModal}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                aria-label="Fechar"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="space-y-1 p-2">
                            <OptionActionItem
                                icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                                label="Renomear opcao"
                                description="Ajustar o nome que aparece na aba"
                                onClick={() => runActionAndClose(() => startEditingOption(actionsOption, getOptionDisplayName(actionsOption)))}
                            />
                            <OptionActionItem
                                icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
                                label="Pagamento"
                                description={hasActivePaymentOverride ? 'Pagamento personalizado ativo' : 'Configurar condicoes desta opcao'}
                                onClick={() => runActionAndClose(onOpenPaymentConfig)}
                            />
                            <OptionActionItem
                                icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
                                label="Gastos"
                                description={hasActiveExpenses ? 'Gastos cadastrados nesta opcao' : 'Adicionar custos desta opcao'}
                                onClick={() => runActionAndClose(onOpenExpenses)}
                            />
                            {options.length > 1 && (
                                <>
                                    <div className="mx-3 my-1 h-px bg-[var(--border-subtle)]" />
                                    <OptionActionItem
                                        icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                        label="Excluir opcao"
                                        description="Remover este grupo de proposta"
                                        tone="danger"
                                        onClick={() => runActionAndClose(() => onDeleteOption(actionsOption.id))}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default React.memo(ProposalOptionsCarousel);
