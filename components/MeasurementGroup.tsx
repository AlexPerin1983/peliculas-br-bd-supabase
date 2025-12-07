import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Measurement, Film } from '../types';
import { AMBIENTES, TIPOS_APLICACAO } from '../constants';
import DynamicSelector from './ui/DynamicSelector';
import Tooltip from './ui/Tooltip';

type UIMeasurement = Measurement & { isNew?: boolean };

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

interface MeasurementGroupProps {
    measurement: UIMeasurement;
    films: Film[];
    onUpdate: (updatedMeasurement: Partial<Measurement>) => void;
    onDelete: () => void;
    onDeleteImmediate: () => void;
    onDuplicate: () => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenEditModal: (measurement: UIMeasurement) => void;
    onOpenDiscountModal: (measurement: UIMeasurement, basePrice?: number) => void;
    index: number;
    isDragging: boolean;
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: number, index: number, isShiftKey: boolean) => void;
    numpadConfig: NumpadConfig;
    onOpenNumpad: (measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => void;
    isActive: boolean;
    swipedItemId: number | null;
    onSetSwipedItem: (id: number | null) => void;
    isModalMode?: boolean;
}
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const MeasurementGroup: React.FC<MeasurementGroupProps> = ({
    measurement,
    films,
    onUpdate,
    onDelete,
    onDeleteImmediate,
    onDuplicate,
    onOpenFilmSelectionModal,
    onOpenEditModal,
    onOpenDiscountModal,
    index,
    isDragging,
    onDragStart,
    onDragEnter,
    onDragEnd,
    isSelectionMode,
    isSelected,
    onToggleSelection,
    numpadConfig,
    onOpenNumpad,
    isActive,
    swipedItemId,
    onSetSwipedItem,
    isModalMode = false
}) => {
    const [additionalFieldsVisible, setAdditionalFieldsVisible] = useState(isModalMode);

    const groupRef = useRef<HTMLDivElement>(null);

    const [translateX, setTranslateX] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDraggingCard = useRef(false);
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const currentTranslateX = useRef(0);
    const swipeableRef = useRef<HTMLDivElement>(null);

    // New Physics & Thresholds
    // New Physics & Thresholds
    const ACTIONS_REVEAL_WIDTH = 160;
    const SNAP_THRESHOLD = 50;
    const DELETE_REVEAL_THRESHOLD = -60;
    const DELETE_AUTO_THRESHOLD = -130;

    // We use translateX directly for rendering, but keep track of the "intent" for vibration
    const lastVibrationIntent = useRef<'none' | 'reveal-actions' | 'delete' | 'auto-delete'>('none');

    useEffect(() => {
        if (swipedItemId !== measurement.id && swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
            lastVibrationIntent.current = 'none';
        }
    }, [swipedItemId, measurement.id]);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (isSelectionMode || isModalMode) return;
        if (swipedItemId && swipedItemId !== measurement.id) {
            onSetSwipedItem(null);
        }

        isDraggingCard.current = true;
        gestureDirection.current = null;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        lastVibrationIntent.current = 'none';

        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isDraggingCard.current || isSelectionMode || isModalMode || !swipeableRef.current) return;

        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        if (gestureDirection.current === null) {
            // More sensitive horizontal detection (5px) vs vertical (10px)
            // This prevents "locking" into vertical scroll when starting a diagonal swipe
            if (Math.abs(deltaX) > 5) {
                // If X is dominant, lock horizontal immediately
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    gestureDirection.current = 'horizontal';
                }
            }

            // Only lock vertical if it's clearly vertical and moved enough
            if (Math.abs(deltaY) > 10) {
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    gestureDirection.current = 'vertical';
                }
            }
        }

        if (gestureDirection.current === 'vertical') return;

        if (e.cancelable) e.preventDefault();

        // Calculate raw translation
        let newTranslateX = currentTranslateX.current + deltaX;

        // Smoother Physics: Linear Damping (Rubber Band)
        // Instead of complex power curves, use simple damping factors
        // This feels more "responsive" and less "heavy"

        if (newTranslateX > 0) {
            // Right Swipe (Reveal Actions)
            if (newTranslateX > ACTIONS_REVEAL_WIDTH) {
                // Apply resistance after the reveal width
                const extra = newTranslateX - ACTIONS_REVEAL_WIDTH;
                newTranslateX = ACTIONS_REVEAL_WIDTH + (extra * 0.4);
            }
        } else {
            // Left Swipe (Delete)
            if (newTranslateX < DELETE_REVEAL_THRESHOLD) {
                // Apply 0.4x resistance after the reveal threshold
                const extra = newTranslateX - DELETE_REVEAL_THRESHOLD;
                newTranslateX = DELETE_REVEAL_THRESHOLD + (extra * 0.4);
            }
        }

        // Haptic Feedback Logic based on Threshold Crossings
        let currentIntent: 'none' | 'reveal-actions' | 'delete' | 'auto-delete' = 'none';

        if (newTranslateX > SNAP_THRESHOLD) currentIntent = 'reveal-actions';
        else if (newTranslateX < DELETE_AUTO_THRESHOLD) currentIntent = 'auto-delete';
        else if (newTranslateX < DELETE_REVEAL_THRESHOLD / 2) currentIntent = 'delete';

        if (currentIntent !== lastVibrationIntent.current) {
            if (
                (currentIntent === 'reveal-actions' && lastVibrationIntent.current === 'none') ||
                (currentIntent === 'auto-delete' && lastVibrationIntent.current === 'delete')
            ) {
                if (navigator.vibrate) navigator.vibrate(50);
            }
            lastVibrationIntent.current = currentIntent;
        }

        swipeableRef.current.style.transform = `translateX(${newTranslateX}px)`;

        // Update state for render
        setTranslateX(newTranslateX);
    };

    const handleTouchEnd = () => {
        if (!isDraggingCard.current || isSelectionMode || isModalMode || !swipeableRef.current) return;

        isDraggingCard.current = false;

        if (gestureDirection.current === 'vertical') {
            gestureDirection.current = null;
            return;
        }
        gestureDirection.current = null;

        // FIX: Read the ACTUAL position from the DOM, not the stored start position
        const transformValue = swipeableRef.current.style.transform;
        const matrix = new DOMMatrix(transformValue);
        const currentX = matrix.m41;

        let finalAction: 'none' | 'reveal-actions' | 'delete' = 'none';

        // Determine action based on final position
        if (currentX > SNAP_THRESHOLD) {
            finalAction = 'reveal-actions';
        } else if (currentX < DELETE_AUTO_THRESHOLD) {
            finalAction = 'delete';
        }

        // Execute Action or Snap Back
        if (finalAction === 'reveal-actions') {
            // Snap to reveal actions
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(${ACTIONS_REVEAL_WIDTH}px)`;
            currentTranslateX.current = ACTIONS_REVEAL_WIDTH;
            setTranslateX(ACTIONS_REVEAL_WIDTH);
            onSetSwipedItem(measurement.id);
        } else if (finalAction === 'delete') {
            onDeleteImmediate();
            if (navigator.vibrate) navigator.vibrate(100);

            // Animate out
            swipeableRef.current.style.transition = 'transform 0.3s ease-out';
            swipeableRef.current.style.transform = `translateX(-100%)`;
            onSetSwipedItem(null);
        } else if (currentX < DELETE_REVEAL_THRESHOLD) {
            // Snap to reveal delete button
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(${DELETE_REVEAL_THRESHOLD}px)`;
            currentTranslateX.current = DELETE_REVEAL_THRESHOLD;
            setTranslateX(DELETE_REVEAL_THRESHOLD);
            onSetSwipedItem(measurement.id);
        } else {
            // Snap back to center
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
            if (swipedItemId === measurement.id) {
                onSetSwipedItem(null);
            }
        }
    };

    const closeSwipe = () => {
        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = 'translateX(0px)';
        }
        currentTranslateX.current = 0;
        setTranslateX(0);
        onSetSwipedItem(null);
    };

    const handleDuplicateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDuplicate();
        closeSwipe();
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onOpenEditModal(measurement);
        closeSwipe();
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        onSetSwipedItem(null);
    };

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onOpenEditModal(measurement);
        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
        }
        currentTranslateX.current = 0;
        setTranslateX(0);
        if (swipedItemId === measurement.id) {
            onSetSwipedItem(null);
        }
    };


    const handleInputChange = (field: keyof Measurement, value: any) => {
        onUpdate({ [field]: value });
    };

    const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isSelectionMode) {
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'SELECT' ||
                target.closest('button')
            ) {
                return;
            }
            onToggleSelection(measurement.id, index, e.shiftKey);
        }
    };

    const isEditingThisMeasurement = numpadConfig.isOpen && numpadConfig.measurementId === measurement.id;

    const larguraNum = isEditingThisMeasurement && numpadConfig.field === 'largura'
        ? parseFloat((numpadConfig.currentValue || '0').replace(',', '.'))
        : parseFloat((String(measurement.largura) || '0').replace(',', '.'));

    const alturaNum = isEditingThisMeasurement && numpadConfig.field === 'altura'
        ? parseFloat((numpadConfig.currentValue || '0').replace(',', '.'))
        : parseFloat((String(measurement.altura) || '0').replace(',', '.'));

    const quantidadeNum = isEditingThisMeasurement && numpadConfig.field === 'quantidade'
        ? parseInt(numpadConfig.currentValue || '0', 10)
        : measurement.quantidade || 0;

    const m2 = larguraNum * alturaNum * quantidadeNum;

    const selectedFilm = films.find(f => f.nome === measurement.pelicula);

    const { basePrice, finalPrice, priceLabel } = useMemo(() => {
        let pricePerM2 = 0;
        let label = 'Preço';

        if (selectedFilm) {
            if (selectedFilm.preco > 0) {
                pricePerM2 = selectedFilm.preco;
                label = 'Preço';
            } else if (selectedFilm.maoDeObra && selectedFilm.maoDeObra > 0) {
                pricePerM2 = selectedFilm.maoDeObra;
                label = 'Mão de Obra';
            }
        }

        const price = pricePerM2 * m2;
        let final = price;

        const discountObj = measurement.discount;
        const discountValue = discountObj ? parseFloat(String(discountObj.value).replace(',', '.')) : 0;
        const discountType = discountObj ? discountObj.type : 'percentage';

        if (discountValue > 0) {
            if (discountType === 'percentage') {
                final = price * (1 - discountValue / 100);
            } else { // fixed
                final = price - discountValue;
            }
        }
        return { basePrice: price, finalPrice: Math.max(0, final), priceLabel: label };
    }, [m2, selectedFilm, measurement.discount]);

    const hasDiscount = (parseFloat(String(measurement.discount?.value || '0').replace(',', '.'))) > 0;

    // --- Lógica para exibir o ambiente (AJUSTADA) ---
    const displayFilmName = measurement.pelicula || 'Nenhuma';

    const displayAmbiente = useMemo(() => {
        const ambiente = measurement.ambiente;
        if (ambiente && ambiente !== 'Desconhecido' && ambiente.trim() !== '') {
            // Trunca para 15 caracteres e adiciona reticências se for maior
            const MAX_CHARS = 15;
            const truncatedAmbiente = ambiente.length > MAX_CHARS ? `${ambiente.substring(0, MAX_CHARS)}...` : ambiente;
            return ` (${truncatedAmbiente})`;
        }
        return '';
    }, [measurement.ambiente]);

    const combinedDisplay = `${displayFilmName}${displayAmbiente}`;
    // --- Fim da Lógica para exibir o ambiente ---


    // Mantendo o padding principal e espaçamento interno compactos
    // Removendo p-2 e substituindo por py-2 e px-3 para manter o espaçamento interno mínimo
    const baseClasses = `border rounded-lg py-2 px-3 space-y-1.5 bg-white dark:bg-slate-800 transition-shadow, transform`;
    const selectionClasses = isSelectionMode
        ? `cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/50'}`
        : 'border-slate-200 dark:border-slate-700';

    // Inputs numéricos: text-sm e py-2
    const inputBaseClasses = "w-full text-center py-2 px-1.5 rounded-lg border text-sm transition-colors duration-200";

    const isDraggable = !isSelectionMode && translateX === 0 && !isModalMode;

    const NumberInputButton: React.FC<{
        field: 'largura' | 'altura' | 'quantidade';
        placeholder: string;
        value: string | number;
    }> = ({ field, placeholder, value }) => {
        const isEditing = isEditingThisMeasurement && numpadConfig.field === field;
        const isSelectedForReplacement = isEditing && numpadConfig.shouldClearOnNextInput;
        const displayValue = isEditing ? numpadConfig.currentValue : String(value);

        const getButtonClasses = () => {
            let classes = `${inputBaseClasses} bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none`;
            if (isEditing) {
                classes += ' border-2 border-blue-500';
            }
            if (!measurement.active) {
                classes += ' bg-slate-200 dark:bg-slate-900 text-slate-500 dark:text-slate-600 border-slate-300 dark:border-slate-700 cursor-not-allowed';
            }
            return classes;
        };

        const renderContent = () => {
            // Usando text-sm para o conteúdo
            const displayValWithComma = (isEditing ? displayValue.replace('.', ',') : displayValue);

            if (isEditing) {
                if (isSelectedForReplacement && displayValWithComma) {
                    return (
                        <span className="bg-blue-500 text-white rounded-sm px-1">
                            {displayValWithComma}
                        </span>
                    );
                }
                return (
                    <>
                        {displayValWithComma}
                        {/* Aumentando a altura do cursor para text-sm */}
                        <span className="inline-block w-px h-4 bg-blue-500 align-text-bottom ml-0.5 animate-blink" />
                    </>
                );
            }

            return displayValue !== '' ? displayValue : <span className="text-slate-400">{placeholder}</span>;
        };

        return (
            <div
                role="button"
                data-numpad-input="true"
                tabIndex={measurement.active ? 0 : -1}
                onClick={(e) => {
                    e.stopPropagation();
                    if (measurement.active && !isSelectionMode) {
                        onOpenNumpad(measurement.id, field, value);
                    }
                }}
                onKeyDown={(e) => {
                    if (measurement.active && !isSelectionMode && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onOpenNumpad(measurement.id, field, value);
                    }
                }}
                className={`${getButtonClasses()} relative z-50`}
            >
                {renderContent()}
            </div>
        );
    };

    const renderSwipeBackground = () => {
        if (translateX === 0) return null;

        const isRightSwipe = translateX > 0;
        const isLeftSwipe = translateX < 0;
        const absX = Math.abs(translateX);

        // Right Swipe: Edit -> Duplicate
        // Right Swipe: Reveal Actions (Duplicate & Edit)
        if (isRightSwipe) {
            return (
                <div className="absolute inset-y-0 left-0 flex items-center w-full h-full rounded-lg overflow-hidden">
                    {/* Duplicate Button */}
                    <button
                        onClick={handleDuplicateClick}
                        className="bg-green-500 hover:bg-green-600 text-white flex flex-col items-center justify-center h-full transition-colors"
                        style={{ width: ACTIONS_REVEAL_WIDTH / 2 }}
                        aria-label="Duplicar medida"
                    >
                        <i className="fas fa-copy text-lg mb-1"></i>
                        <span className="text-[10px] font-bold uppercase">Duplicar</span>
                    </button>

                    {/* Edit Button */}
                    <button
                        onClick={handleEditClick}
                        className="bg-slate-600 hover:bg-slate-700 text-white flex flex-col items-center justify-center h-full transition-colors"
                        style={{ width: ACTIONS_REVEAL_WIDTH / 2 }}
                        aria-label="Editar medida"
                    >
                        <i className="fas fa-pen text-lg mb-1"></i>
                        <span className="text-[10px] font-bold uppercase">Editar</span>
                    </button>
                </div>
            );
        }

        // Left Swipe: Delete
        if (isLeftSwipe) {
            const isAutoDelete = translateX < DELETE_AUTO_THRESHOLD;
            const bgClass = 'bg-red-600';

            // For auto-delete, we might want a more intense visual or just the same
            // The "reveal" logic is handled by the fact that we see this background

            const scale = Math.min(1 + (absX / 300), 1.5);

            return (
                <div
                    className={`absolute inset-y-0 right-0 flex items-center justify-end pr-6 transition-colors duration-200 ${bgClass} w-full rounded-lg cursor-pointer`}
                    onClick={handleDeleteClick}
                    role="button"
                    aria-label="Confirmar exclusão"
                >
                    <div className="flex items-center text-white font-bold gap-3" style={{ transform: `scale(${scale})`, transformOrigin: 'right center' }}>
                        <span className="text-sm font-medium">Excluir</span>
                        <i className="fas fa-trash-alt text-xl"></i>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className={`relative my-2 rounded-lg ${!isModalMode ? 'sm:overflow-visible overflow-hidden' : ''}`}>
            {/* Dynamic Single Layer Background */}
            <div className="absolute inset-0 z-0 rounded-lg overflow-hidden">
                {renderSwipeBackground()}
            </div>

            {/* Foreground Content (Swipeable) */}
            <div
                ref={swipeableRef}
                style={{ touchAction: 'pan-y' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative z-30 w-full"
            >
                <div
                    ref={groupRef}
                    data-measurement-id={measurement.id}
                    onClick={handleRowClick}
                    draggable={isDraggable}
                    onDragStart={onDragStart}
                    onDragEnter={onDragEnter}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`relative z-10 ${baseClasses} ${selectionClasses} ${isDragging ? 'shadow-2xl scale-[1.02]' : ''} ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                >
                    {/* Top Row: Film info and Price */}
                    <div className="flex items-start justify-between">
                        {/* Left Side: Film Info & Selector */}
                        <div className="flex-1 pr-2 min-w-0">
                            <div
                                role="button"
                                tabIndex={isSelectionMode ? -1 : 0}
                                onClick={() => !isSelectionMode && onOpenFilmSelectionModal(measurement.id)}
                                onKeyDown={(e) => {
                                    if (!isSelectionMode && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        onOpenFilmSelectionModal(measurement.id);
                                    }
                                }}
                                className={`text-left w-full rounded-lg transition-colors`}
                                aria-label={`Película atual: ${combinedDisplay || 'Nenhuma'}. Clique para alterar.`}
                            >
                                <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Película</div>
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">{combinedDisplay}</div>
                            </div>
                        </div>

                        {/* Center: Swipe Hint Icon */}
                        <div className="flex items-center justify-center px-2 opacity-30">
                            <i className="fas fa-arrows-left-right text-xs text-slate-400 dark:text-slate-500"></i>
                        </div>

                        {/* Right Side: Price & Options Menu */}
                        <div className="flex items-center relative z-50">
                            <Tooltip text={hasDiscount ? 'Editar Desconto' : 'Aplicar Desconto'}>
                                <div
                                    role="button"
                                    tabIndex={isSelectionMode ? -1 : 0}
                                    onClick={(e) => {
                                        // Always stop propagation to prevent row selection/expansion
                                        e.stopPropagation();

                                        if (!isSelectionMode) {
                                            onOpenDiscountModal(measurement, basePrice);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (!isSelectionMode && (e.key === 'Enter' || e.key === ' ')) {
                                            e.stopPropagation();
                                            onOpenDiscountModal(measurement, basePrice);
                                        }
                                    }}
                                    className={`text-right rounded-lg transition-colors ${isSelectionMode ? 'cursor-default' : 'hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'}`}
                                    aria-label="Preço, clique para aplicar ou editar desconto"
                                >
                                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">{priceLabel}</div>
                                    {basePrice > 0 ? (
                                        finalPrice < basePrice ? (
                                            <div className="flex flex-col items-end leading-tight">
                                                <s className="text-red-500/80 text-[10px] font-normal">{formatCurrency(basePrice)}</s>
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{formatCurrency(finalPrice)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{formatCurrency(basePrice)}</span>
                                        )
                                    ) : (
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">-</span>
                                    )}
                                </div>
                            </Tooltip>
                            <div className="relative">
                                {/* Botão de menu para desktop/tablet */}
                                <div className={isModalMode ? 'hidden' : 'hidden sm:block'}>
                                    <Tooltip text="Editar Detalhes">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); if (!isSelectionMode) onOpenEditModal(measurement); }}
                                            disabled={isSelectionMode}
                                            className="w-8 h-10 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                            aria-label="Editar detalhes da medida"
                                        >
                                            <i className="fas fa-ellipsis-v"></i>
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checkbox and Inputs Row */}
                    <div className="flex items-center space-x-2 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                        {isSelectionMode ? (
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => onToggleSelection(measurement.id, index, e.shiftKey)}
                                className="form-checkbox h-4 w-4 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                aria-label={`Selecionar medida ${measurement.id}`}
                            />
                        ) : (
                            <Tooltip text="Ativar/Desativar cálculo">
                                <input
                                    type="checkbox"
                                    checked={measurement.active}
                                    onChange={(e) => handleInputChange('active', e.target.checked)}
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                    aria-label="Ativar ou desativar esta medida do cálculo"
                                />
                            </Tooltip>
                        )}

                        <div className="grid grid-cols-4 gap-2 flex-grow">
                            <NumberInputButton field="largura" placeholder="L" value={measurement.largura} />
                            <NumberInputButton field="altura" placeholder="A" value={measurement.altura} />
                            <NumberInputButton field="quantidade" placeholder="Qtd" value={measurement.quantidade} />
                            <div className={`${inputBaseClasses} bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium border-slate-300 dark:border-slate-600 cursor-default flex items-center justify-center`}>
                                {m2 > 0 ? m2.toFixed(2).replace('.', ',') : ''}
                            </div>
                        </div>
                    </div>
                    <div className={`additional-fields-content ${additionalFieldsVisible ? 'visible' : ''}`}>
                        <div className="space-y-3 pt-3 mt-2 border-t border-slate-200 dark:border-slate-700">
                            <DynamicSelector
                                label="Ambiente"
                                options={AMBIENTES}
                                value={measurement.ambiente}
                                onChange={(value) => onUpdate({ ambiente: value })}
                                disabled={!measurement.active}
                            />
                            <DynamicSelector
                                label="Tipo de Aplicação"
                                options={TIPOS_APLICACAO}
                                value={measurement.tipoAplicacao}
                                onChange={(value) => onUpdate({ tipoAplicacao: value })}
                                disabled={!measurement.active}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MeasurementGroup);