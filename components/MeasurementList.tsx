import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Measurement, Film } from '../types';
import MeasurementGroup from './MeasurementGroup';
import ConfirmationModal from './modals/ConfirmationModal';

type UIMeasurement = Measurement & { isNew?: boolean };

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
};

interface MeasurementListProps {
    measurements: UIMeasurement[];
    films: Film[];
    onMeasurementsChange: (measurements: UIMeasurement[]) => void;
    onOpenFilmModal: (film: Film | null) => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenClearAllModal: () => void;
    onOpenApplyFilmToAllModal: () => void;
    numpadConfig: NumpadConfig;
    onOpenNumpad: (measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => void;
    activeMeasurementId: number | null;
    onOpenEditModal: (measurement: UIMeasurement) => void;
    onOpenDiscountModal: (measurement: UIMeasurement) => void;
}

const MeasurementList: React.FC<MeasurementListProps> = ({ 
    measurements, 
    films, 
    onMeasurementsChange, 
    onOpenFilmModal,
    onOpenFilmSelectionModal,
    onOpenClearAllModal,
    onOpenApplyFilmToAllModal,
    numpadConfig,
    onOpenNumpad,
    activeMeasurementId,
    onOpenEditModal,
    onOpenDiscountModal
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeleteSelectedModalOpen, setIsDeleteSelectedModalOpen] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

    const scrollVelocityRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        if (isActionsMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isActionsMenuOpen]);

    const scrollLoop = useCallback(() => {
        const mainContainer = document.querySelector('main');
        if (mainContainer && scrollVelocityRef.current !== 0) {
            mainContainer.scrollTop += scrollVelocityRef.current;
            animationFrameRef.current = requestAnimationFrame(scrollLoop);
        } else if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (draggedIndex === null) return;

        const mainContainer = document.querySelector('main');
        if (!mainContainer) return;

        const rect = mainContainer.getBoundingClientRect();
        const y = e.clientY;
        const scrollZone = rect.height * 0.15;
        const maxSpeed = 15;

        if (y < rect.top + scrollZone) {
            const intensity = 1 - (y - rect.top) / scrollZone;
            scrollVelocityRef.current = -maxSpeed * intensity;
        } else if (y > rect.bottom - scrollZone) {
            const intensity = 1 - (rect.bottom - y) / scrollZone;
            scrollVelocityRef.current = maxSpeed * intensity;
        } else {
            scrollVelocityRef.current = 0;
        }

        if (scrollVelocityRef.current !== 0 && !animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(scrollLoop);
        }
    }, [draggedIndex, scrollLoop]);

    const handleEnterSelectionMode = () => {
        setIsSelectionMode(true);
        setSelectedIds(new Set());
    };

    const handleCancelSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setLastSelectedIndex(null);
    }, []);

    const handleDeleteSelected = () => {
        if (selectedIds.size > 0) {
            setIsDeleteSelectedModalOpen(true);
        }
    };
    
    const handleConfirmDeleteSelected = () => {
        const newMeasurements = measurements.filter(m => !selectedIds.has(m.id));
        onMeasurementsChange(newMeasurements);
        handleCancelSelectionMode();
        setIsDeleteSelectedModalOpen(false);
    };

    const handleToggleSelection = (id: number, index: number, isShiftKey: boolean) => {
        const newSelectedIds = new Set(selectedIds);
        
        if (isShiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);

            const shouldSelectRange = !selectedIds.has(id);

            for (let i = start; i <= end; i++) {
                if (shouldSelectRange) {
                    newSelectedIds.add(measurements[i].id);
                } else {
                    newSelectedIds.delete(measurements[i].id);
                }
            }
        } else {
            if (newSelectedIds.has(id)) {
                newSelectedIds.delete(id);
            } else {
                newSelectedIds.add(id);
            }
        }
        
        setLastSelectedIndex(index);
        setSelectedIds(newSelectedIds);
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === measurements.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(measurements.map(m => m.id)));
        }
    };

    const handleDragStart = (index: number) => {
        if (isSelectionMode) return;
        setDraggedIndex(index);
    };

    const handleDragEnter = (index: number) => {
        if (isSelectionMode) return;
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIdx(index);
        }
    };

    const handleDragEnd = () => {
        if (isSelectionMode) return;
        
        scrollVelocityRef.current = 0;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (draggedIndex !== null && dragOverIdx !== null && draggedIndex !== dragOverIdx) {
            const newMeasurements = [...measurements];
            const [draggedItem] = newMeasurements.splice(draggedIndex, 1);
            newMeasurements.splice(dragOverIdx, 0, draggedItem);
            onMeasurementsChange(newMeasurements);
        }
        setDraggedIndex(null);
        setDragOverIdx(null);
    };

    const updateMeasurement = (id: number, updatedMeasurement: Partial<Measurement>) => {
        const newMeasurements = measurements.map(m => m.id === id ? { ...m, ...updatedMeasurement } : m);
        onMeasurementsChange(newMeasurements);
    };
    
    const deleteMeasurement = (id: number) => {
        onMeasurementsChange(measurements.filter(m => m.id !== id));
    };
    
    const duplicateMeasurement = (id: number) => {
        const measurementToDuplicate = measurements.find(m => m.id === id);
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = { 
                ...measurementToDuplicate, 
                id: Date.now(), 
                isNew: true 
            };
            
            const updatedMeasurements = [
                newMeasurement,
                ...measurements.map(m => ({ ...m, isNew: false }))
            ];
            
            onMeasurementsChange(updatedMeasurements);
        }
    };

    const handleSetSwipedItem = useCallback((id: number | null) => {
        setSwipedItemId(id);
    }, []);

    const ActionMenuItem: React.FC<{
        onClick: () => void;
        icon: string;
        label: string;
        isDestructive?: boolean;
    }> = ({ onClick, icon, label, isDestructive = false }) => (
        <li>
            <button
                onClick={() => { onClick(); setIsActionsMenuOpen(false); }}
                className={`flex items-center w-full px-3 py-2 text-sm rounded-md ${isDestructive
                    ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
                <i className={`${icon} mr-3 h-5 w-5 ${isDestructive ? 'text-red-400' : 'text-slate-400'}`}></i>
                {label}
            </button>
        </li>
    );

    return (
        <>
            <div className="my-4 pt-4 border-t border-slate-200">
                {isSelectionMode ? (
                    <div className="flex justify-between items-center px-2 py-2 rounded-lg bg-slate-100 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                checked={selectedIds.size === measurements.length && measurements.length > 0}
                                onChange={handleToggleSelectAll}
                                aria-label="Selecionar todas as medidas"
                            />
                            <span className="text-sm font-semibold text-slate-800">
                                {selectedIds.size} / {measurements.length} selecionadas
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCancelSelectionMode} className="text-sm text-slate-600 hover:text-slate-900 rounded-md px-3 py-1.5 transition-colors duration-200">
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDeleteSelected} 
                                className="text-sm text-white bg-red-600 hover:bg-red-700 rounded-md px-3 py-1.5 transition-colors duration-200 flex items-center gap-2 disabled:bg-red-400 disabled:cursor-not-allowed"
                                disabled={selectedIds.size === 0}
                            >
                                <i className="fas fa-trash-alt"></i>
                                Excluir
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center">
                        <div>
                            <span title="Quantidade de Medidas" className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-2 rounded-lg">
                                QM: {measurements.length}
                            </span>
                        </div>
                        <div className="relative" ref={actionsMenuRef}>
                            <button
                                onClick={() => setIsActionsMenuOpen(prev => !prev)}
                                className="text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg px-4 py-2 transition-colors duration-200 flex items-center gap-2"
                                aria-expanded={isActionsMenuOpen}
                            >
                                Ações
                                <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${isActionsMenuOpen ? 'rotate-180' : ''}`}></i>
                            </button>

                            {isActionsMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20 p-1">
                                    <ul className="space-y-1">
                                        <ActionMenuItem
                                            onClick={handleEnterSelectionMode}
                                            icon="far fa-check-square"
                                            label="Selecionar"
                                        />
                                        <ActionMenuItem
                                            onClick={onOpenApplyFilmToAllModal}
                                            icon="fas fa-layer-group"
                                            label="Aplicar a Todos"
                                        />
                                        <ActionMenuItem
                                            onClick={onOpenClearAllModal}
                                            icon="far fa-trash-alt"
                                            label="Excluir Todas"
                                            isDestructive
                                        />
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div onDragOver={handleDragOver} ref={listContainerRef}>
                {measurements.map((measurement, index) => (
                    <React.Fragment key={measurement.id}>
                        {dragOverIdx === index && <div className="h-1.5 bg-blue-500 rounded-full my-1 transition-all" />}
                        <MeasurementGroup
                            measurement={measurement}
                            films={films}
                            onUpdate={(updated) => updateMeasurement(measurement.id, updated)}
                            onDelete={() => deleteMeasurement(measurement.id)}
                            onDuplicate={() => duplicateMeasurement(measurement.id)}
                            onOpenFilmModal={onOpenFilmModal}
                            onOpenFilmSelectionModal={onOpenFilmSelectionModal}
                            onOpenEditModal={onOpenEditModal}
                            index={index}
                            isDragging={draggedIndex === index}
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(measurement.id)}
                            onToggleSelection={handleToggleSelection}
                            numpadConfig={numpadConfig}
                            onOpenNumpad={onOpenNumpad}
                            isActive={measurement.id === activeMeasurementId}
                            swipedItemId={swipedItemId}
                            onSetSwipedItem={handleSetSwipedItem}
                            onOpenDiscountModal={onOpenDiscountModal}
                        />
                    </React.Fragment>
                ))}
                {dragOverIdx === measurements.length && <div className="h-1.5 bg-blue-500 rounded-full my-1 transition-all" />}
                {/* Empty droppable area at the end of the list */}
                <div onDragEnter={() => handleDragEnter(measurements.length)} className="h-10" />
            </div>

            {isDeleteSelectedModalOpen && (
                <ConfirmationModal
                    isOpen={isDeleteSelectedModalOpen}
                    onClose={() => setIsDeleteSelectedModalOpen(false)}
                    onConfirm={handleConfirmDeleteSelected}
                    title="Confirmar Exclusão"
                    message={`Tem certeza que deseja apagar ${selectedIds.size === 1 ? 'a medida selecionada' : `as ${selectedIds.size} medidas selecionadas`}? Esta ação não pode ser desfeita.`}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
        </>
    );
};

export default React.memo(MeasurementList);