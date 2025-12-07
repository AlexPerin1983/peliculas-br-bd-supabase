import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MobileActionsDrawer } from './MobileActionsDrawer';
import { Measurement, Film, UIMeasurement } from '../types';
import MeasurementGroup from './MeasurementGroup';
import ConfirmationModal from './modals/ConfirmationModal';
import CuttingOptimizationPanel from './CuttingOptimizationPanel';

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
    onDeleteMeasurement: (measurementId: number) => void; // Prop que aciona o modal no App.tsx
    swipeDirection?: 'left' | 'right' | null;
    swipeDistance?: number;
    totalM2: number;
    totalQuantity: number; // NOVA PROP
    clientId?: number;
    optionId?: number;
    onDeleteMeasurementImmediate: (id: number) => void;
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
    onOpenDiscountModal,
    onDeleteMeasurement, // Usando a prop
    onDeleteMeasurementImmediate,
    swipeDirection = null,
    swipeDistance = 0,
    totalM2,
    totalQuantity, // Usando a nova prop
    clientId,
    optionId
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [isOptimizationOpen, setIsOptimizationOpen] = useState<boolean>(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeleteSelectedModalOpen, setIsDeleteSelectedModalOpen] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);



    const scrollVelocityRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const firstNewMeasurementRef = useRef<number | null>(null);

    // Efeito para focar no primeiro input da nova medida (largura)
    useEffect(() => {
        if (measurements.length > 0) {
            const firstNew = measurements.find(m => m.isNew);
            if (firstNew) {
                firstNewMeasurementRef.current = firstNew.id;
            }
        }
    }, [measurements]);

    useEffect(() => {
        if (firstNewMeasurementRef.current !== null) {
            const element = listContainerRef.current?.querySelector(`[data-measurement-id='${firstNewMeasurementRef.current}'][inputmode='decimal']`);
            if (element) {
                // Abre o numpad diretamente no campo de largura
                onOpenNumpad(firstNewMeasurementRef.current, 'largura', '');

                // Limpa a flag isNew após focar
                onMeasurementsChange(measurements.map(m => m.id === firstNewMeasurementRef.current ? { ...m, isNew: false } : m));
                firstNewMeasurementRef.current = null;
            }
        }
    }, [measurements, onMeasurementsChange, onOpenNumpad]);

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
        setSelectedIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);

            if (isShiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);

                const shouldSelectRange = !prevSelectedIds.has(id);

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
            return newSelectedIds;
        });
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

    // Função que o MeasurementGroup chama para iniciar a exclusão
    const requestDeleteMeasurement = (id: number) => {
        onDeleteMeasurement(id); // Chama a função do App.tsx que abre o modal
    };

    const duplicateMeasurement = (id: number) => {
        const measurementToDuplicate = measurements.find(m => m.id === id);
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = {
                ...measurementToDuplicate,
                id: Date.now(),
                isNew: false
            };

            const index = measurements.findIndex(m => m.id === id);
            const newMeasurements = [...measurements];
            newMeasurements.splice(index + 1, 0, newMeasurement);

            // Garante que apenas a nova medida seja marcada como nova
            const finalMeasurements = newMeasurements.map(m => m.id === newMeasurement.id ? { ...m, isNew: true } : { ...m, isNew: false });

            onMeasurementsChange(finalMeasurements);
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
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                    } `}
            >
                <i className={`${icon} mr-3 h-5 w-5 ${isDestructive ? 'text-red-400' : 'text-slate-400'} `}></i>
                {label}
            </button>
        </li>
    );

    const getAnimationClass = () => {
        if (!swipeDirection || swipeDistance === 0) return '';
        return swipeDirection === 'left' ? 'animate-carousel-left' : 'animate-carousel-right';
    };



    const getAnimationStyle = () => {
        if (!swipeDirection || swipeDistance === 0) return {};

        // Base duration + additional time per step
        const duration = 200 + (swipeDistance * 200);

        return {
            animationDuration: `${duration}ms`
        };
    };

    return (
        <>
            <div className="my-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                {isSelectionMode ? (
                    <div className="flex justify-between items-center px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                checked={selectedIds.size === measurements.length && measurements.length > 0}
                                onChange={handleToggleSelectAll}
                                aria-label="Selecionar todas as medidas"
                            />
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">
                                {selectedIds.size} / {measurements.length} selecionadas
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCancelSelectionMode} className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md px-3 py-1.5 transition-colors duration-200">
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
                        <div className="flex items-center gap-4">
                            <span title="Quantidade de Medidas (Grupos e Total de Vidros)" className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg">
                                QM: {measurements.length} ({totalQuantity})
                            </span>
                            <span title="Total de Metros Quadrados" className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg">
                                M²: {totalM2.toFixed(2).replace('.', ',')}
                            </span>
                        </div>
                        <div className="relative" ref={actionsMenuRef}>
                            {/* Desktop Button */}
                            <button
                                onClick={() => setIsActionsMenuOpen(prev => !prev)}
                                className="hidden sm:flex text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg px-4 py-2 transition-colors duration-200 items-center gap-2"
                                aria-expanded={isActionsMenuOpen}
                            >
                                Ações
                                <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${isActionsMenuOpen ? 'rotate-180' : ''}`}></i>
                            </button>

                            {/* Mobile Button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="flex sm:hidden text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg px-4 py-2 transition-colors duration-200 items-center gap-2"
                            >
                                Ações
                                <i className="fas fa-chevron-up text-xs"></i>
                            </button>

                            {/* Desktop Dropdown Menu */}
                            {isActionsMenuOpen && (
                                <div className="hidden sm:block absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20 p-1">
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
                                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                        <ActionMenuItem
                                            onClick={onOpenClearAllModal}
                                            icon="fas fa-trash-alt"
                                            label="Excluir Todas"
                                            isDestructive
                                        />
                                    </ul>
                                </div>
                            )}

                            {/* Mobile Drawer */}
                            <MobileActionsDrawer
                                open={isMobileMenuOpen}
                                onOpenChange={setIsMobileMenuOpen}
                                title="Ações da Lista"
                                description="Gerencie suas medidas em lote"
                            >
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            handleEnterSelectionMode();
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                                            <i className="far fa-check-square text-lg"></i>
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold block text-base">Selecionar Medidas</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Apagar ou editar múltiplos itens</span>
                                        </div>
                                        <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
                                    </button>

                                    <button
                                        onClick={() => {
                                            onOpenApplyFilmToAllModal();
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                                            <i className="fas fa-layer-group text-lg"></i>
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold block text-base">Aplicar Película a Todos</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Definir o mesmo material para tudo</span>
                                        </div>
                                        <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
                                    </button>

                                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-2"></div>

                                    <button
                                        onClick={() => {
                                            onOpenClearAllModal();
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700 rounded-xl text-red-600"
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-50 dark:bg-red-900/20">
                                            <i className="fas fa-trash-alt text-lg"></i>
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold block text-base">Excluir Todas as Medidas</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Limpar a lista completamente</span>
                                        </div>
                                        <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
                                    </button>
                                </div>
                            </MobileActionsDrawer>
                        </div>
                    </div>
                )}
            </div>

            <div
                onDragOver={handleDragOver}
                ref={listContainerRef}
                className={getAnimationClass()}
                style={getAnimationStyle()}
            >
                {measurements.map((measurement, index) => (
                    <React.Fragment key={measurement.id}>
                        {dragOverIdx === index && <div className="h-1.5 bg-blue-500 rounded-full my-1 transition-all" />}
                        <MeasurementGroup
                            measurement={measurement}
                            films={films}
                            onUpdate={(updated) => updateMeasurement(measurement.id, updated)}
                            onDelete={() => requestDeleteMeasurement(measurement.id)}
                            onDeleteImmediate={() => onDeleteMeasurementImmediate(measurement.id)}
                            onDuplicate={() => duplicateMeasurement(measurement.id)}
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

            {/* Cutting Optimization Panel - Accordion */}
            {measurements.length > 0 && (
                <div className="mb-8">
                    <button
                        onClick={() => setIsOptimizationOpen(!isOptimizationOpen)}
                        className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-600 dark:text-blue-400">
                                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                                    <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Otimizador de Corte</h3>
                                    <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wide bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-800">BETA v2</span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Gere o plano de corte otimizado</p>
                            </div>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOptimizationOpen ? 'rotate-180' : ''}`}
                        >
                            <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOptimizationOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
                            }`}
                    >
                        <CuttingOptimizationPanel
                            measurements={measurements}
                            clientId={clientId}
                            optionId={optionId}
                            films={films}
                        />
                    </div>
                </div>
            )}

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

            <style jsx>{`
@keyframes carousel-left {
    0% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
    25% {
        opacity: 0.5;
        transform: translateX(-50px) scale(0.95);
    }
    50% {
        opacity: 0;
        transform: translateX(-100px) scale(0.9);
    }
    100% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

@keyframes carousel-right {
    0% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
    25% {
        opacity: 0.5;
        transform: translateX(50px) scale(0.95);
    }
    50% {
        opacity: 0;
        transform: translateX(100px) scale(0.9);
    }
    100% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}
                
.animate-carousel-left {
    animation: carousel-left 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
                
.animate-carousel-right {
    animation: carousel-right 0.5s cubic-bezier(0.4, 0, 0.2, 1);
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
        </>
    );
};

export default React.memo(MeasurementList);