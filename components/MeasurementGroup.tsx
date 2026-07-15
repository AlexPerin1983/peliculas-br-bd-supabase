import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Measurement, Film, ProposalPricingMode } from '../types';
import { AMBIENTES, TIPOS_APLICACAO } from '../constants';
import DynamicSelector from './ui/DynamicSelector';
import Tooltip from './ui/Tooltip';
import { calculatePricingAreaM2 } from '../src/lib/pricingArea';
import { useMeasurementInputMode } from '../src/hooks/useMeasurementInputMode';
import { normalizeMeasurementInput } from '../src/lib/measurementInputMode';

type UIMeasurement = Measurement & { isNew?: boolean };
type EditableMeasurementField = 'largura' | 'altura' | 'quantidade';
type DesktopDraftValues = Record<EditableMeasurementField, string>;

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: EditableMeasurementField | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

interface MeasurementGroupProps {
    measurement: UIMeasurement;
    films: Film[];
    pricingMode: ProposalPricingMode;
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
    onOpenNumpad: (measurementId: number, field: EditableMeasurementField, currentValue: string | number) => void;
    useTouchNumpad?: boolean;
    isActive: boolean;
    swipedItemId: number | null;
    onSetSwipedItem: (id: number | null) => void;
    isModalMode?: boolean;
    compatibleRetalhosCount?: number;
    isCheckingEstoque?: boolean;
    onOpenRetalhoSuggestions?: (measurementId: number) => void;
    onOpenMeasurementInputSettings: () => void;
}
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const MeasurementGroup: React.FC<MeasurementGroupProps> = ({
    measurement,
    films,
    pricingMode,
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
    useTouchNumpad = true,
    isActive,
    swipedItemId,
    onSetSwipedItem,
    isModalMode = false,
    compatibleRetalhosCount = 0,
    isCheckingEstoque = false,
    onOpenRetalhoSuggestions,
    onOpenMeasurementInputSettings
}) => {
    const { mode: measurementInputMode } = useMeasurementInputMode();
    const groupRef = useRef<HTMLDivElement>(null);
    const [desktopDraftValues, setDesktopDraftValues] = useState<DesktopDraftValues>({
        largura: String(measurement.largura ?? ''),
        altura: String(measurement.altura ?? ''),
        quantidade: String(measurement.quantidade ?? '')
    });

    const [translateX, setTranslateX] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDraggingCard = useRef(false);
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const currentTranslateX = useRef(0);
    const swipeableRef = useRef<HTMLDivElement>(null);
    const skipNextDesktopCommitRef = useRef(false);

    // New Physics & Thresholds
    // New Physics & Thresholds
    const ACTIONS_REVEAL_WIDTH = 160;
    const LEFT_ACTIONS_REVEAL_WIDTH = 152;
    const SNAP_THRESHOLD = 50;
    const DELETE_REVEAL_THRESHOLD = -50;
    const DELETE_AUTO_THRESHOLD = -210;

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
            if (newTranslateX < -LEFT_ACTIONS_REVEAL_WIDTH) {
                // Mantem os dois botoes acessiveis e aplica resistencia depois deles.
                const extra = newTranslateX + LEFT_ACTIONS_REVEAL_WIDTH;
                newTranslateX = -LEFT_ACTIONS_REVEAL_WIDTH + (extra * 0.35);
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
            swipeableRef.current.style.transform = `translateX(${-LEFT_ACTIONS_REVEAL_WIDTH}px)`;
            currentTranslateX.current = -LEFT_ACTIONS_REVEAL_WIDTH;
            setTranslateX(-LEFT_ACTIONS_REVEAL_WIDTH);
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

    const handleMeasurementInputSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        closeSwipe();
        onOpenMeasurementInputSettings();
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

    useEffect(() => {
        setDesktopDraftValues({
            largura: String(measurement.largura ?? ''),
            altura: String(measurement.altura ?? ''),
            quantidade: String(measurement.quantidade ?? '')
        });
    }, [measurement.id, measurement.largura, measurement.altura, measurement.quantidade]);

    const sanitizeDecimalInput = (rawValue: string) => {
        const cleanedValue = rawValue
            .replace(/\./g, ',')
            .replace(/[^\d,]/g, '');
        const [integerPart, ...decimalParts] = cleanedValue.split(',');

        if (decimalParts.length === 0) {
            return integerPart;
        }

        return `${integerPart},${decimalParts.join('')}`;
    };

    const sanitizeDesktopInput = (field: EditableMeasurementField, rawValue: string) => {
        if (field === 'quantidade') {
            return rawValue.replace(/\D/g, '');
        }

        return sanitizeDecimalInput(rawValue);
    };

    const commitDesktopInput = (field: EditableMeasurementField, rawValue: string) => {
        if (field === 'quantidade') {
            const quantity = parseInt(rawValue, 10) || 1;
            setDesktopDraftValues(prev => ({ ...prev, quantidade: String(quantity) }));
            handleInputChange(field, quantity);
            return;
        }

        const finalValue = normalizeMeasurementInput(rawValue, measurementInputMode);

        setDesktopDraftValues(prev => ({ ...prev, [field]: finalValue }));
        handleInputChange(field, finalValue);
    };

    const handleApplySuggestedFilm = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (!measurement.aiFilmSuggestion?.suggestedFilm) return;

        onUpdate({
            pelicula: measurement.aiFilmSuggestion.suggestedFilm,
            aiFilmSuggestion: undefined
        });
    };

    const handleChooseDifferentFilm = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onOpenFilmSelectionModal(measurement.id);
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

    const desktopValueFor = (field: EditableMeasurementField, value: string | number) =>
        useTouchNumpad ? String(value) : (desktopDraftValues[field] ?? '');

    const parseDecimalValue = (value: string) => {
        const parsedValue = parseFloat((value || '0').replace(',', '.'));
        return Number.isFinite(parsedValue) ? parsedValue : 0;
    };

    const parseQuantityValue = (value: string) => {
        const parsedValue = parseInt(value || '0', 10);
        return Number.isFinite(parsedValue) ? parsedValue : 0;
    };

    const larguraNum = isEditingThisMeasurement && numpadConfig.field === 'largura'
        ? parseDecimalValue(numpadConfig.currentValue || '0')
        : parseDecimalValue(desktopValueFor('largura', measurement.largura));

    const alturaNum = isEditingThisMeasurement && numpadConfig.field === 'altura'
        ? parseDecimalValue(numpadConfig.currentValue || '0')
        : parseDecimalValue(desktopValueFor('altura', measurement.altura));

    const quantidadeNum = isEditingThisMeasurement && numpadConfig.field === 'quantidade'
        ? parseQuantityValue(numpadConfig.currentValue || '0')
        : parseQuantityValue(desktopValueFor('quantidade', measurement.quantidade));

    const m2 = calculatePricingAreaM2(larguraNum, alturaNum, quantidadeNum);

    const selectedFilm = films.find(f => f.nome === measurement.pelicula);

    const { basePrice, finalPrice, priceLabel } = useMemo(() => {
        let pricePerM2 = 0;
        let label = 'Preço';

        if (selectedFilm) {
            if (pricingMode === 'labor_only') {
                pricePerM2 = selectedFilm.maoDeObra || 0;
                label = 'Mão de Obra';
            } else if (selectedFilm.preco > 0) {
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
    }, [m2, selectedFilm, measurement.discount, pricingMode]);

    const hasDiscount = (parseFloat(String(measurement.discount?.value || '0').replace(',', '.'))) > 0;

    // --- Lógica para exibir o ambiente (AJUSTADA) ---
    const displayFilmName = measurement.pelicula || 'Nenhuma';
    const hasEstoqueUsage = Boolean(measurement.estoqueUso?.retalhoId);
    const shouldShowRetalhoAction = !isModalMode
        && !hasEstoqueUsage
        && compatibleRetalhosCount > 0
        && typeof onOpenRetalhoSuggestions === 'function';

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
    const baseClasses = `border rounded-[var(--radius-card)] py-3 px-3 space-y-2 bg-[var(--surface)] shadow-[var(--shadow-hairline)] transition-shadow, transform`;
    const selectionClasses = isSelectionMode
        ? `cursor-pointer ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] ring-1 ring-[var(--brand-primary)]' : 'border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]'}`
        : 'border-[var(--border-subtle)]';

    // Inputs numéricos: text-sm e py-2
    const inputBaseClasses = "w-full text-center py-2 px-1.5 rounded-[var(--radius-control)] border text-sm transition-colors duration-200";

    const isDraggable = !isSelectionMode && translateX === 0 && !isModalMode;

    const renderNumberInput = (field: EditableMeasurementField, placeholder: string, value: string | number) => {
        const isEditing = isEditingThisMeasurement && numpadConfig.field === field;
        const isSelectedForReplacement = isEditing && numpadConfig.shouldClearOnNextInput;
        const displayValue = isEditing ? numpadConfig.currentValue : String(value);

        const getButtonClasses = () => {
            let classes = `${inputBaseClasses} bg-[var(--surface-muted)] text-[var(--text-strong)] border-[var(--border-subtle)] placeholder:text-[var(--text-soft)] focus:outline-none`;
            if (isEditing) {
                classes += ' border-2 border-blue-500';
            }
            if (!measurement.active) {
                classes += ' bg-[var(--surface-muted)] text-[var(--text-soft)] border-[var(--border-subtle)] cursor-not-allowed opacity-60';
            }
            return classes;
        };

        if (!useTouchNumpad) {
            const draftValue = desktopDraftValues[field] ?? '';

            return (
                <input
                    type="text"
                    data-measurement-field={field}
                    inputMode={field === 'quantidade' ? 'numeric' : 'decimal'}
                    value={draftValue}
                    placeholder={placeholder}
                    disabled={!measurement.active || isSelectionMode}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const nextValue = sanitizeDesktopInput(field, e.target.value);
                        setDesktopDraftValues(prev => ({ ...prev, [field]: nextValue }));
                    }}
                    onBlur={(e) => {
                        if (skipNextDesktopCommitRef.current) {
                            skipNextDesktopCommitRef.current = false;
                            return;
                        }

                        commitDesktopInput(field, e.currentTarget.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                        }

                        if (e.key === 'Escape') {
                            skipNextDesktopCommitRef.current = true;
                            setDesktopDraftValues(prev => ({ ...prev, [field]: String(value ?? '') }));
                            e.currentTarget.blur();
                        }
                    }}
                    className={`${getButtonClasses()} relative z-50`}
                    aria-label={`${placeholder} da medida ${measurement.id}`}
                />
            );
        }

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
                data-measurement-field={field}
                inputMode={field === 'quantidade' ? 'numeric' : 'decimal'}
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

        // Left Swipe: measurement input settings + delete
        if (isLeftSwipe) {
            return (
                <div className="absolute inset-y-0 right-0 flex h-full overflow-hidden rounded-r-lg" style={{ width: LEFT_ACTIONS_REVEAL_WIDTH }}>
                    <button
                        type="button"
                        onClick={handleMeasurementInputSettingsClick}
                        className="flex h-full flex-1 flex-col items-center justify-center bg-blue-600 text-white transition-colors hover:bg-blue-700"
                        aria-label="Configurar forma de digitar medidas"
                    >
                        <i className="fas fa-ruler text-lg mb-1"></i>
                        <span className="text-[9px] font-bold uppercase">Medida</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        className="flex h-full flex-1 flex-col items-center justify-center bg-red-600 text-white transition-colors hover:bg-red-700"
                        aria-label="Excluir medida"
                    >
                        <i className="fas fa-trash-alt text-lg mb-1"></i>
                        <span className="text-[9px] font-bold uppercase">Excluir</span>
                    </button>
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
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {hasEstoqueUsage && measurement.estoqueUso && (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        <i className="fas fa-check-circle"></i>
                                        Retalho #{measurement.estoqueUso.retalhoId} aplicado
                                    </div>
                                )}
                                {!hasEstoqueUsage && isCheckingEstoque && measurement.pelicula && (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        <i className="fas fa-spinner fa-spin"></i>
                                        Consultando estoque
                                    </div>
                                )}
                                {shouldShowRetalhoAction && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenRetalhoSuggestions?.(measurement.id);
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                    >
                                        <i className="fas fa-cut"></i>
                                        {compatibleRetalhosCount} retalho{compatibleRetalhosCount > 1 ? 's' : ''} no estoque
                                        {measurement.quantidade > 1 ? ' para 1 peça' : ''}
                                    </button>
                                )}
                            </div>
                            {measurement.aiFilmSuggestion && measurement.aiFilmSuggestion.suggestedFilm !== measurement.pelicula && (
                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                                Sugestao da IA
                                            </div>
                                            <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                {measurement.aiFilmSuggestion.suggestedFilm}
                                            </div>
                                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                                Detectado: {measurement.aiFilmSuggestion.extractedText}
                                            </div>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm dark:bg-slate-900/60 dark:text-amber-300">
                                            {Math.round(measurement.aiFilmSuggestion.confidence * 100)}%
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleApplySuggestedFilm}
                                            className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-amber-600"
                                        >
                                            Aplicar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleChooseDifferentFilm}
                                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Escolher outra
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

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
                            {renderNumberInput('largura', 'L', measurement.largura)}
                            {renderNumberInput('altura', 'A', measurement.altura)}
                            {renderNumberInput('quantidade', 'Qtd', measurement.quantidade)}
                            <div className={`${inputBaseClasses} bg-[var(--surface-muted)] text-[var(--text-strong)] font-medium border-[var(--border-subtle)] cursor-default flex items-center justify-center`}>
                                {m2 > 0 ? m2.toFixed(2).replace('.', ',') : ''}
                            </div>
                        </div>
                    </div>
                    {isModalMode && (
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(MeasurementGroup);
