

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Measurement, Film } from '../../types';
import { AMBIENTES, TIPOS_APLICACAO } from '../../constants';
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
    onDuplicate: () => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenEditModal: (measurement: UIMeasurement) => void;
    onOpenDiscountModal: (measurement: UIMeasurement) => void;
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
    const ACTIONS_WIDTH = 160; 

    useEffect(() => {
        if (swipedItemId !== measurement.id && swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
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
        
        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isDraggingCard.current || isSelectionMode || isModalMode || !swipeableRef.current) return;

        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        if (gestureDirection.current === null) {
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                gestureDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }
        }
        
        if (gestureDirection.current === 'vertical') return;
        
        if (e.cancelable) e.preventDefault();
        
        const newTranslateX = currentTranslateX.current + deltaX;

        let finalTranslateX = newTranslateX;
        if (newTranslateX > 0) {
            finalTranslateX = Math.pow(newTranslateX, 0.7);
        } else if (newTranslateX < -ACTIONS_WIDTH) {
            const overflow = -ACTIONS_WIDTH - newTranslateX;
            finalTranslateX = -ACTIONS_WIDTH - Math.pow(overflow, 0.7);
        }
        
        swipeableRef.current.style.transform = `translateX(${finalTranslateX}px)`;
    };

    const handleTouchEnd = () => {
        if (!isDraggingCard.current || isSelectionMode || isModalMode || !swipeableRef.current) return;

        isDraggingCard.current = false;
        
        if (gestureDirection.current === 'vertical') {
            gestureDirection.current = null;
            return;
        }
        gestureDirection.current = null;

        const transformValue = swipeableRef.current.style.transform;
        const matrix = new DOMMatrix(transformValue);
        const currentX = matrix.m41;

        swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        const threshold = -ACTIONS_WIDTH / 2;

        if (currentX < threshold) {
            swipeableRef.current.style.transform = `translateX(-${ACTIONS_WIDTH}px)`;
            currentTranslateX.current = -ACTIONS_WIDTH;
            setTranslateX(-ACTIONS_WIDTH);
            onSetSwipedItem(measurement.id);
        } else {
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
            if (swipedItemId === measurement.id) {
                onSetSwipedItem(null);
            }
        }
    };

    const handleDeleteClick = () => {
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

    useEffect(() => {
        if (measurement.isNew) {
            onOpenNumpad(measurement.id, 'largura', measurement.largura);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [measurement.isNew]);
    
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
    
    const { basePrice, finalPrice } = useMemo(() => {
        const price = selectedFilm ? m2 * selectedFilm.preco : 0;
        let final = price;
        const discountValue = measurement.discount || 0;
        if (discountValue > 0) {
            if (measurement.discountType === 'percentage') {
                final = price * (1 - discountValue / 100);
            } else { // fixed
                final = price - discountValue;
            }
        }
        return { basePrice: price, finalPrice: Math.max(0, final) };
    }, [m2, selectedFilm, measurement.discount, measurement.discountType]);
    
    const hasDiscount = (measurement.discount || 0) > 0;

    const baseClasses = `border rounded-lg p-3 space-y-2.5 bg-white transition-shadow, transform`;
    const selectionClasses = isSelectionMode
        ? `cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50/80'}`
        : 'border-slate-200';
    
    const inputBaseClasses = "w-full text-center p-2.5 rounded-lg border text-base transition-colors duration-200";
    
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
            let classes = `${inputBaseClasses} bg-white text-slate-800 border-slate-300 placeholder:text-slate-400 focus:outline-none`;
            if (isEditing) {
                classes += ' border-2 border-blue-500';
            }
            if (!measurement.active) {
                classes += ' bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed';
            }
            return classes;
        };
        
        const renderContent = () => {
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
                        <span className="inline-block w-px h-5 bg-blue-500 align-text-bottom ml-0.5 animate-blink" />
                    </>
                );
            }
            
            return displayValue !== '' ? displayValue : <span className="text-slate-400">{placeholder}</span>;
        };
    
        return (
            <div
                role="button"
                tabIndex={measurement.active ? 0 : -1}
                onClick={() => measurement.active && onOpenNumpad(measurement.id, field, value)}
                onKeyDown={(e) => {
                    if (measurement.active && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onOpenNumpad(measurement.id, field, value);
                    }
                }}
                className={getButtonClasses()}
            >
                {renderContent()}
            </div>
        );
    };

    return (
        <>
            <div className={`relative my-2 rounded-lg ${!isModalMode ? 'sm:overflow-visible overflow-hidden' : ''}`}>
                <div className={`absolute inset-y-0 right-0 flex rounded-r-lg overflow-hidden ${isModalMode ? 'hidden' : 'sm:hidden'}`}>
                    <button
                        onClick={handleMenuClick}
                        className="w-20 h-full bg-slate-600 text-white flex flex-col items-center justify-center transition-colors hover:bg-slate-700"
                        aria-label="Editar"
                    >
                        <i className="fas fa-expand-arrows-alt text-xl"></i>
                        <span className="text-xs mt-1">Editar</span>
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        className="w-20 h-full bg-red-600 text-white flex flex-col items-center justify-center transition-colors hover:bg-red-700"
                        aria-label="Excluir medida"
                    >
                        <i className="fas fa-trash-alt text-xl"></i>
                        <span className="text-xs mt-1">Excluir</span>
                    </button>
                </div>

                <div
                    ref={swipeableRef}
                    style={{ touchAction: 'pan-y' }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="relative z-10 w-full"
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
                        {/* Top Row: Film selector and Price */}
                        <div className="flex items-start justify-between">
                            {/* Left Side: Film Info & Selector */}
                            <div className="flex-1 pr-2 min-w-0">
                                <div 
                                    role="button"
                                    tabIndex={(!measurement.active || isSelectionMode) ? -1 : 0}
                                    onClick={() => measurement.active && !isSelectionMode && onOpenFilmSelectionModal(measurement.id)} 
                                    onKeyDown={(e) => {
                                        if (measurement.active && !isSelectionMode && (e.key === 'Enter' || e.key === ' ')) {
                                            onOpenFilmSelectionModal(measurement.id);
                                        }
                                    }}
                                    className={`text-left w-full p-2 rounded-lg transition-colors ${(!measurement.active || isSelectionMode) ? 'cursor-default' : 'hover:bg-slate-200/50 cursor-pointer'}`}
                                    aria-label={`Película atual: ${measurement.pelicula || 'Nenhuma'}. Clique para alterar.`}
                                >
                                    <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Película</div>
                                    <div className="text-md font-bold text-slate-800 truncate">{measurement.pelicula || 'Nenhuma'}</div>
                                </div>
                            </div>

                            {/* Right Side: Price & Options Menu */}
                            <div className="flex items-center">
                                <Tooltip text={hasDiscount ? 'Editar Desconto' : 'Aplicar Desconto'}>
                                    <div
                                        role="button"
                                        tabIndex={isSelectionMode ? -1 : 0}
                                        onClick={() => !isSelectionMode && onOpenDiscountModal(measurement)}
                                        onKeyDown={(e) => !isSelectionMode && (e.key === 'Enter' || e.key === ' ') && onOpenDiscountModal(measurement)}
                                        className={`text-right p-2 rounded-lg transition-colors ${isSelectionMode ? 'cursor-default' : 'hover:bg-slate-100 cursor-pointer'}`}
                                        aria-label="Preço, clique para aplicar ou editar desconto"
                                    >
                                        <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Preço</div>
                                        {basePrice > 0 ? (
                                            finalPrice < basePrice ? (
                                                <div className="flex flex-col items-end leading-tight">
                                                    <s className="text-red-500/80 text-xs font-normal">{formatCurrency(basePrice)}</s>
                                                    <span className="font-bold text-slate-800">{formatCurrency(finalPrice)}</span>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-slate-800">{formatCurrency(basePrice)}</span>
                                            )
                                        ) : (
                                        <span className="font-bold text-slate-800">-</span>
                                        )}
                                    </div>
                                </Tooltip>
                                <div className="relative">
                                    <div className={isModalMode ? 'hidden' : 'hidden sm:block'}>
                                        <Tooltip text="Editar Detalhes">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (!isSelectionMode) onOpenEditModal(measurement); }}
                                                disabled={isSelectionMode}
                                                className="w-8 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                                aria-label="Editar detalhes da medida"
                                            >
                                                <i className="fas fa-expand-arrows-alt"></i>
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                            {isSelectionMode ? (
                                <input 
                                    type="checkbox" 
                                    checked={isSelected} 
                                    onChange={(e) => onToggleSelection(measurement.id, index, e.shiftKey)}
                                    className="form-checkbox h-5 w-5 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                    aria-label={`Selecionar medida ${measurement.id}`}
                                />
                            ) : (
                                <Tooltip text="Ativar/Desativar cálculo">
                                    <input 
                                        type="checkbox" 
                                        checked={measurement.active} 
                                        onChange={(e) => handleInputChange('active', e.target.checked)} 
                                        className="form-checkbox h-5 w-5 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                        aria-label="Ativar ou desativar esta medida do cálculo"
                                    />
                                </Tooltip>
                            )}

                            <div className="grid grid-cols-4 gap-2 flex-grow">
                                <NumberInputButton field="largura" placeholder="L" value={measurement.largura} />
                                <NumberInputButton field="altura" placeholder="A" value={measurement.altura} />
                                <NumberInputButton field="quantidade" placeholder="Qtd" value={measurement.quantidade} />
                                <div className={`${inputBaseClasses} bg-white text-slate-800 font-medium border-slate-300 cursor-default flex items-center justify-center`}>
                                    {m2 > 0 ? m2.toFixed(2).replace('.', ',') : ''}
                                </div>
                            </div>
                        </div>
                        <div className={`additional-fields-content ${additionalFieldsVisible ? 'visible' : ''}`}>
                            <div className="space-y-3 pt-3 mt-2 border-t border-slate-200">
                                <DynamicSelector
                                    label="Ambiente"
                                    options={AMBIENTES}
                                    value={measurement.ambiente}
                                    onChange={(value) => handleInputChange('ambiente', value)}
                                    disabled={!measurement.active}
                                />
                                <DynamicSelector
                                    label="Tipo de Aplicação"
                                    options={TIPOS_APLICACAO}
                                    value={measurement.tipoAplicacao}
                                    onChange={(value) => handleInputChange('tipoAplicacao', value)}
                                    disabled={!measurement.active}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default React.memo(MeasurementGroup);