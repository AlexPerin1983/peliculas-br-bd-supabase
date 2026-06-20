import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MobileActionsDrawer } from './MobileActionsDrawer';
import { CheckSquare, ChevronDown, ChevronUp, ClipboardCheck, ClipboardPaste, Copy, Layers3, Trash2, X } from 'lucide-react';
import { useMemo } from 'react';
import { Measurement, Film, ProposalPricingMode, Retalho, UIMeasurement } from '../types';
import MeasurementGroup from './MeasurementGroup';
import ConfirmationModal from './modals/ConfirmationModal';
import RetalhoSuggestionModal from './modals/RetalhoSuggestionModal';
import ApplicationProgressModal, { getApplicationProgress } from './modals/ApplicationProgressModal';
import { deleteConsumo, deleteRetalho, getAllRetalhos, saveConsumo, saveRetalho } from '../services/estoqueDb';
import { getCompatibleRetalhosForMeasurement } from '../src/lib/retalhoMatching';
import { RetalhoConsumptionPlan, planRetalhoConsumption } from '../src/lib/retalhoConsumption';
import { useFeedback } from '../src/contexts/FeedbackContext';
import {
    copyMeasurementsToMeasurementClipboard,
    createPastedMeasurementsFromClipboard,
    getMeasurementClipboardCount
} from '../src/lib/measurementClipboard';

const TOUCH_NUMPAD_MEDIA_QUERY = '(max-width: 767px)';

const shouldUseTouchNumpad = () =>
    typeof window !== 'undefined' && window.matchMedia(TOUCH_NUMPAD_MEDIA_QUERY).matches;

const useTouchNumpadPreference = () => {
    const [useTouchNumpad, setUseTouchNumpad] = useState(shouldUseTouchNumpad);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia(TOUCH_NUMPAD_MEDIA_QUERY);
        const syncTouchNumpad = () => setUseTouchNumpad(mediaQuery.matches);

        syncTouchNumpad();
        mediaQuery.addEventListener('change', syncTouchNumpad);

        return () => {
            mediaQuery.removeEventListener('change', syncTouchNumpad);
        };
    }, []);

    return useTouchNumpad;
};

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
    onPersistMeasurementsChange?: (measurements: UIMeasurement[]) => Promise<void>;
    onOpenFilmModal: (film: Film | null) => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenClearAllModal: () => void;
    onOpenApplyFilmToAllModal: () => void;
    numpadConfig: NumpadConfig;
    onOpenNumpad: (measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => void;
    activeMeasurementId: number | null;
    onOpenEditModal: (measurement: UIMeasurement) => void;
    onOpenDiscountModal: (measurement: UIMeasurement) => void;
    onDeleteMeasurement: (measurementId: number) => void;
    swipeDirection?: 'left' | 'right' | null;
    swipeDistance?: number;
    totalM2: number;
    totalQuantity: number;
    pricingMode: ProposalPricingMode;
    onSelectPricingMode?: (pricingMode: ProposalPricingMode) => void;
    clientId?: number;
    optionId?: number;
    onDeleteMeasurementImmediate: (id: number) => void;
    onPasteCopiedMeasurements?: () => void | Promise<void>;
    proposalOptionsSlot?: React.ReactNode;
}

const MeasurementList: React.FC<MeasurementListProps> = ({
    measurements,
    films,
    onMeasurementsChange,
    onPersistMeasurementsChange,
    onOpenClearAllModal,
    onOpenApplyFilmToAllModal,
    numpadConfig,
    onOpenNumpad,
    activeMeasurementId,
    onOpenEditModal,
    onOpenDiscountModal,
    onDeleteMeasurement,
    onDeleteMeasurementImmediate,
    swipeDirection = null,
    swipeDistance = 0,
    totalM2,
    totalQuantity,
    pricingMode,
    onSelectPricingMode,
    clientId,
    onOpenFilmSelectionModal,
    onPasteCopiedMeasurements,
    proposalOptionsSlot
}) => {
    const { showToast } = useFeedback();
    const useTouchNumpad = useTouchNumpadPreference();
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeleteSelectedModalOpen, setIsDeleteSelectedModalOpen] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [availableRetalhos, setAvailableRetalhos] = useState<Retalho[]>([]);
    const [isLoadingRetalhos, setIsLoadingRetalhos] = useState(false);
    const [retalhoMeasurementId, setRetalhoMeasurementId] = useState<number | null>(null);
    const [consumingRetalhoId, setConsumingRetalhoId] = useState<number | null>(null);
    const formattedTotalM2 = totalM2.toFixed(2).replace('.', ',');
    // Progresso do checklist de aplicacao (so leitura; muda apenas via modal).
    const aplicacaoProgress = useMemo(() => getApplicationProgress(measurements), [measurements]);

    const scrollVelocityRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const firstNewMeasurementRef = useRef<number | null>(null);
    const copiedMeasurementsCount = getMeasurementClipboardCount();

    const applyMeasurements = useCallback(async (nextMeasurements: UIMeasurement[]) => {
        if (onPersistMeasurementsChange) {
            await onPersistMeasurementsChange(nextMeasurements);
            return;
        }

        onMeasurementsChange(nextMeasurements);
    }, [onMeasurementsChange, onPersistMeasurementsChange]);

    const loadRetalhos = useCallback(async () => {
        setIsLoadingRetalhos(true);
        try {
            const allRetalhos = await getAllRetalhos();
            setAvailableRetalhos(allRetalhos.filter(retalho => retalho.status === 'disponivel'));
        } catch (error) {
            console.error('Erro ao carregar retalhos compatíveis:', error);
        } finally {
            setIsLoadingRetalhos(false);
        }
    }, []);

    useEffect(() => {
        if (measurements.length > 0) {
            const firstNew = measurements.find(m => m.isNew);
            if (firstNew) {
                firstNewMeasurementRef.current = firstNew.id;
            }
        }
    }, [measurements]);

    useEffect(() => {
        void loadRetalhos();
    }, [loadRetalhos]);

    useEffect(() => {
        if (firstNewMeasurementRef.current !== null) {
            const targetMeasurement = measurements.find(m => m.id === firstNewMeasurementRef.current);
            const focusField = targetMeasurement?.focusField ?? 'largura';
            const element = listContainerRef.current?.querySelector<HTMLElement>(`[data-measurement-id='${firstNewMeasurementRef.current}'] [data-measurement-field='${focusField}']`);
            if (element) {
                if (useTouchNumpad) {
                    const initialValue = focusField === 'largura' ? '' : (targetMeasurement?.[focusField] ?? '');
                    onOpenNumpad(firstNewMeasurementRef.current, focusField, initialValue);
                } else {
                    element.focus();
                }

                void applyMeasurements(measurements.map(m => m.id === firstNewMeasurementRef.current ? { ...m, isNew: false, focusField: undefined } : m));
                firstNewMeasurementRef.current = null;
            }
        }
    }, [measurements, onOpenNumpad, applyMeasurements, useTouchNumpad]);

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

    const compatibleRetalhosByMeasurement = useMemo(() => {
        const compatibilities = new Map<number, Retalho[]>();

        measurements.forEach(measurement => {
            if (measurement.estoqueUso?.retalhoId) {
                compatibilities.set(measurement.id, []);
                return;
            }

            compatibilities.set(
                measurement.id,
                getCompatibleRetalhosForMeasurement(measurement, availableRetalhos)
            );
        });

        return compatibilities;
    }, [measurements, availableRetalhos]);

    const selectedMeasurementForRetalho = useMemo(
        () => measurements.find(measurement => measurement.id === retalhoMeasurementId) || null,
        [measurements, retalhoMeasurementId]
    );

    const selectedMeasurementRetalhos = useMemo(() => {
        if (!selectedMeasurementForRetalho) {
            return [];
        }

        return compatibleRetalhosByMeasurement.get(selectedMeasurementForRetalho.id) || [];
    }, [selectedMeasurementForRetalho, compatibleRetalhosByMeasurement]);

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

    const handleCopySelected = useCallback(() => {
        const selectedMeasurements = measurements.filter(measurement => selectedIds.has(measurement.id));

        if (selectedMeasurements.length === 0) {
            return;
        }

        try {
            const payload = copyMeasurementsToMeasurementClipboard(selectedMeasurements);
            const count = payload.measurements.length;
            showToast(`${count} ${count === 1 ? 'medida copiada' : 'medidas copiadas'}. Abra outro cliente e use Acoes > Colar.`, { tone: 'success' });
            handleCancelSelectionMode();
        } catch (error) {
            console.error('Erro ao copiar medidas:', error);
            showToast('Não foi possível copiar as medidas selecionadas.', { tone: 'error' });
        }
    }, [handleCancelSelectionMode, measurements, selectedIds, showToast]);

    const handlePasteCopiedMeasurements = useCallback(async () => {
        if (onPasteCopiedMeasurements) {
            await onPasteCopiedMeasurements();
            return;
        }

        const pastedMeasurements = createPastedMeasurementsFromClipboard(measurements);

        if (pastedMeasurements.length === 0) {
            showToast('Nenhuma medida copiada para colar.', { tone: 'warning' });
            return;
        }

        const nextMeasurements = [
            ...measurements.map(measurement => ({ ...measurement, isNew: false })),
            ...pastedMeasurements
        ];

        try {
            await applyMeasurements(nextMeasurements);
            showToast(`${pastedMeasurements.length} ${pastedMeasurements.length === 1 ? 'medida colada' : 'medidas coladas'} neste cliente.`, { tone: 'success' });
        } catch (error) {
            console.error('Erro ao colar medidas:', error);
            showToast('Não foi possível colar as medidas copiadas.', { tone: 'error' });
        }
    }, [applyMeasurements, measurements, onPasteCopiedMeasurements, showToast]);

    const handleConfirmDeleteSelected = () => {
        const newMeasurements = measurements.filter(m => !selectedIds.has(m.id));
        void applyMeasurements(newMeasurements);
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
            void applyMeasurements(newMeasurements);
        }
        setDraggedIndex(null);
        setDragOverIdx(null);
    };

    const updateMeasurement = (id: number, updatedMeasurement: Partial<Measurement>) => {
        const newMeasurements = measurements.map(m => m.id === id ? { ...m, ...updatedMeasurement } : m);
        void applyMeasurements(newMeasurements);
    };

    const duplicateMeasurement = (id: number) => {
        const measurementToDuplicate = measurements.find(m => m.id === id);
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = {
                ...measurementToDuplicate,
                id: Date.now(),
                isNew: false,
                // Copia da medida ainda nao foi aplicada na obra.
                aplicadoEm: undefined,
                aplicadoPecas: undefined
            };

            const index = measurements.findIndex(m => m.id === id);
            const newMeasurements = [...measurements];
            newMeasurements.splice(index + 1, 0, newMeasurement);

            const finalMeasurements = newMeasurements.map(m => m.id === newMeasurement.id ? { ...m, isNew: true, focusField: 'quantidade' as const } : { ...m, isNew: false });
            void applyMeasurements(finalMeasurements);
        }
    };

    const handleSetSwipedItem = useCallback((id: number | null) => {
        setSwipedItemId(id);
    }, []);

    const handleOpenRetalhoSuggestions = useCallback((measurementId: number) => {
        setRetalhoMeasurementId(measurementId);
        void loadRetalhos();
    }, [loadRetalhos]);

    const handleCloseRetalhoSuggestions = useCallback(() => {
        if (consumingRetalhoId !== null) {
            return;
        }

        setRetalhoMeasurementId(null);
    }, [consumingRetalhoId]);

    const handleUseRetalho = useCallback(async (retalho: Retalho, selectedPlan: RetalhoConsumptionPlan) => {
        if (!selectedMeasurementForRetalho || !retalho.id) {
            return;
        }

        const now = new Date().toISOString();
        setConsumingRetalhoId(retalho.id);

        const consumptionPlan = planRetalhoConsumption(
            selectedMeasurementForRetalho,
            retalho,
            selectedPlan.orientation
        );

        if (!consumptionPlan) {
            setConsumingRetalhoId(null);
            showToast('A orientação escolhida não cabe mais neste retalho.', { tone: 'warning' });
            return;
        }

        const estoqueUso = {
            tipo: 'retalho' as const,
            retalhoId: retalho.id,
            filmId: retalho.filmId,
            larguraCm: consumptionPlan.appliedWidthCm,
            comprimentoCm: consumptionPlan.appliedLengthCm,
            orientacao: consumptionPlan.orientation,
            codigoQr: retalho.codigoQr,
            localizacao: retalho.localizacao,
            consumidoEm: now
        };

        const selectedIndex = measurements.findIndex(item => item.id === selectedMeasurementForRetalho.id);

        if (selectedIndex === -1) {
            setConsumingRetalhoId(null);
            return;
        }

        const updatedMeasurements = [...measurements];
        const selectedMeasurement = updatedMeasurements[selectedIndex];

        if (selectedMeasurement.quantidade > 1) {
            updatedMeasurements[selectedIndex] = {
                ...selectedMeasurement,
                quantidade: selectedMeasurement.quantidade - 1
            };

            updatedMeasurements.splice(selectedIndex + 1, 0, {
                ...selectedMeasurement,
                id: Date.now(),
                quantidade: 1,
                estoqueUso
            });
        } else {
            updatedMeasurements[selectedIndex] = {
                ...selectedMeasurement,
                estoqueUso
            };
        }

        let savedConsumoId: number | undefined;
        let retalhoWasConsumed = false;
        let leftoverRetalho: Retalho | null = null;

        try {
            await applyMeasurements(updatedMeasurements);

            await saveRetalho({
                ...retalho,
                status: 'usado',
                dataUtilizacao: now
            });
            retalhoWasConsumed = true;

            if (consumptionPlan.hasReusableLeftover) {
                leftoverRetalho = await saveRetalho({
                    bobinaId: retalho.bobinaId,
                    filmId: retalho.filmId,
                    codigoQr: '',
                    larguraCm: consumptionPlan.leftoverWidthCm,
                    comprimentoCm: consumptionPlan.leftoverLengthCm,
                    status: 'disponivel',
                    localizacao: retalho.localizacao,
                    observacao: `Sobra gerada automaticamente do retalho #${retalho.id} após aplicar ${selectedMeasurementForRetalho.largura} x ${selectedMeasurementForRetalho.altura} m com corte ${consumptionPlan.orientationLabel}`
                });
            }

                const savedConsumo = await saveConsumo({
                    retalhoId: retalho.id,
                    clientId,
                    metrosConsumidos: consumptionPlan.appliedLengthCm / 100,
                    larguraCorteCm: consumptionPlan.appliedWidthCm,
                    comprimentoCorteCm: consumptionPlan.appliedLengthCm,
                    areaM2: consumptionPlan.appliedAreaM2,
                    tipo: 'corte',
                    observacao: `Retalho aplicado na medida ${selectedMeasurementForRetalho.largura} x ${selectedMeasurementForRetalho.altura} (${selectedMeasurementForRetalho.pelicula}) - corte ${consumptionPlan.orientationLabel}`
                });
            savedConsumoId = savedConsumo.id;
            setAvailableRetalhos(current => {
                const nextRetalhos = current.filter(item => item.id !== retalho.id);

                if (leftoverRetalho) {
                    nextRetalhos.unshift(leftoverRetalho);
                }

                return nextRetalhos;
            });
            setRetalhoMeasurementId(null);
        } catch (error) {
            if (savedConsumoId) {
                await deleteConsumo(savedConsumoId).catch(rollbackError => {
                    console.error('Erro ao desfazer consumo de retalho:', rollbackError);
                });
            }

            if (leftoverRetalho?.id) {
                await deleteRetalho(leftoverRetalho.id).catch(rollbackError => {
                    console.error('Erro ao desfazer sobra criada automaticamente:', rollbackError);
                });
            }

            if (retalhoWasConsumed) {
                await saveRetalho(retalho).catch(rollbackError => {
                    console.error('Erro ao restaurar status do retalho:', rollbackError);
                });
            }

            await applyMeasurements(measurements).catch(rollbackError => {
                console.error('Erro ao restaurar vínculo da medida após falha:', rollbackError);
            });

            console.error('Erro ao consumir retalho:', error);
            showToast('Não foi possível consumir o retalho selecionado.', { tone: 'error' });
        } finally {
            setConsumingRetalhoId(null);
        }
    }, [selectedMeasurementForRetalho, clientId, measurements, onMeasurementsChange, onPersistMeasurementsChange, showToast]);

    const ActionMenuItem: React.FC<{
        onClick: () => void;
        icon: React.ReactNode;
        label: string;
        isDestructive?: boolean;
    }> = ({ onClick, icon, label, isDestructive = false }) => (
        <li>
            <button
                onClick={() => { onClick(); setIsActionsMenuOpen(false); }}
                className={`flex items-center w-full gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold transition-colors ${isDestructive
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700'
                    : 'text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'
                    } `}
            >
                <span className={`inline-flex h-4 w-4 items-center justify-center ${isDestructive ? 'text-red-400' : 'text-[var(--text-muted)]'} `}>{icon}</span>
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
        const duration = 200 + (swipeDistance * 200);
        return { animationDuration: `${duration}ms` };
    };

    return (
        <>
            <div className="relative z-50 my-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-soft)] sm:my-4 sm:p-4">
                {isSelectionMode ? (
                    <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-blue-600 rounded-md border-slate-400 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                checked={selectedIds.size === measurements.length && measurements.length > 0}
                                onChange={handleToggleSelectAll}
                                aria-label="Selecionar todas as medidas"
                            />
                            <span className="text-sm font-semibold text-[var(--text-strong)]">
                                {selectedIds.size} / {measurements.length} selecionadas
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={handleCancelSelectionMode}
                                className="h-10 w-10 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-muted)] rounded-[var(--radius-control)] transition-colors duration-200"
                                aria-label="Cancelar seleção"
                                title="Cancelar seleção"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                                onClick={handleCopySelected}
                                className="h-10 w-10 inline-flex items-center justify-center text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-strong)] rounded-[var(--radius-control)] transition-colors duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed"
                                disabled={selectedIds.size === 0}
                                aria-label="Copiar medidas selecionadas"
                                title="Copiar medidas selecionadas"
                            >
                                <Copy className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                className="h-10 w-10 inline-flex items-center justify-center text-white bg-red-600 hover:bg-red-700 rounded-[var(--radius-control)] transition-colors duration-200 disabled:bg-red-400 disabled:cursor-not-allowed"
                                disabled={selectedIds.size === 0}
                                aria-label="Excluir medidas selecionadas"
                                title="Excluir medidas selecionadas"
                            >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                    <div className="sm:hidden">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="ui-kicker">Mapa</p>
                                <h3 className="mt-0.5 truncate text-[17px] font-black leading-tight text-[var(--text-strong)]">Medidas</h3>
                            </div>
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)]"
                            >
                                Acoes
                                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">Grupos</span>
                                <span className="mt-0.5 block text-sm font-black leading-tight text-[var(--text-strong)]">
                                    {measurements.length}
                                </span>
                            </div>
                            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">Pecas</span>
                                <span className="mt-0.5 block text-sm font-black leading-tight text-[var(--text-strong)]">
                                    {totalQuantity}
                                </span>
                            </div>
                            <div className="rounded-[var(--radius-control)] border border-blue-500/30 bg-blue-500/10 px-2.5 py-2">
                                <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-blue-600 dark:text-blue-300">Area</span>
                                <span className="mt-0.5 block truncate text-sm font-black leading-tight text-[var(--text-strong)]">
                                    {formattedTotalM2} m2
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="ui-kicker">Mapa de medidas</p>
                            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                                <h3 className="text-lg font-bold leading-tight text-[var(--text-strong)]">Medidas da proposta</h3>
                                <span className="text-sm font-semibold text-[var(--text-muted)]">
                                    {measurements.length} grupo{measurements.length === 1 ? '' : 's'} - {totalQuantity} peca{totalQuantity === 1 ? '' : 's'} - {formattedTotalM2} m2
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <div className="flex items-center gap-2">
                                <span title="Quantidade de Medidas" className="text-sm font-semibold text-[var(--text-body)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] px-3 py-2 rounded-[var(--radius-control)]">
                                    {measurements.length} itens
                                </span>
                                <span title="Total de Metros Quadrados" className="text-sm font-semibold text-[var(--text-body)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] px-3 py-2 rounded-[var(--radius-control)]">
                                    {formattedTotalM2} m2
                                </span>
                            </div>
                            <div className="relative z-[60]" ref={actionsMenuRef}>
                                <button
                                    onClick={() => setIsActionsMenuOpen(prev => !prev)}
                                    className="flex text-sm font-semibold text-[var(--text-body)] bg-[var(--surface)] border border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] rounded-[var(--radius-control)] px-4 py-2 transition-colors duration-200 items-center gap-2"
                                >
                                    Acoes
                                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isActionsMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>

                                {isActionsMenuOpen && (
                                <div className="absolute right-0 z-[120] mt-2 w-60 origin-top-right rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-elevated)] focus:outline-none">
                                    <ul className="space-y-1">
                                        {copiedMeasurementsCount > 0 && (
                                            <ActionMenuItem
                                                onClick={() => { void handlePasteCopiedMeasurements(); }}
                                                icon={<ClipboardPaste className="h-4 w-4" aria-hidden="true" />}
                                                label={`Colar ${copiedMeasurementsCount === 1 ? 'Medida' : 'Medidas'}`}
                                            />
                                        )}
                                        <ActionMenuItem
                                            onClick={handleEnterSelectionMode}
                                            icon={<CheckSquare className="h-4 w-4" aria-hidden="true" />}
                                            label="Selecionar"
                                        />
                                        <ActionMenuItem
                                            onClick={() => setIsProgressModalOpen(true)}
                                            icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
                                            label="Progresso de Aplicacao"
                                        />
                                        <ActionMenuItem
                                            onClick={onOpenApplyFilmToAllModal}
                                            icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
                                            label="Aplicar a Todos"
                                        />
                                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                        <ActionMenuItem
                                            onClick={onOpenClearAllModal}
                                            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                            label="Excluir Todas"
                                            isDestructive
                                        />
                                    </ul>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Barra discreta do checklist de aplicacao: so aparece depois
                        que o primeiro item e marcado no modal de progresso. */}
                    {aplicacaoProgress.started && (
                        <button
                            type="button"
                            onClick={() => setIsProgressModalOpen(true)}
                            className="mt-3 block w-full text-left"
                            title="Abrir progresso de aplicacao"
                        >
                            <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                    Aplicacao
                                </span>
                                <span className="text-[var(--text-muted)]">
                                    {Math.round(aplicacaoProgress.percent)}% · {aplicacaoProgress.appliedPieces}/{aplicacaoProgress.totalPieces} pecas
                                </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${Math.min(100, aplicacaoProgress.percent)}%` }}
                                />
                            </div>
                        </button>
                    )}

                    <MobileActionsDrawer
                        open={isMobileMenuOpen}
                        onOpenChange={setIsMobileMenuOpen}
                        title="Acoes da Lista"
                        description="Gerencie suas medidas em lote"
                    >
                                <div className="space-y-2">
                                    {onSelectPricingMode && (
                                        <>
                                            <div className="px-4 py-3">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
                                                        <i className="fas fa-tags text-lg text-blue-600 dark:text-blue-300"></i>
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="font-semibold block text-base text-slate-700 dark:text-slate-200">Tipo de cobranca</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                                                            {pricingMode === 'labor_only' ? 'Cobrando apenas a mao de obra' : 'Material + mao de obra'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                                                    {([
                                                        { mode: 'complete' as const, label: 'Completo' },
                                                        { mode: 'labor_only' as const, label: 'Mao de obra' },
                                                    ]).map(({ mode, label }) => {
                                                        const active = (pricingMode === 'labor_only' ? 'labor_only' : 'complete') === mode;
                                                        return (
                                                            <button
                                                                key={mode}
                                                                type="button"
                                                                onClick={() => onSelectPricingMode(mode)}
                                                                aria-pressed={active}
                                                                className={`h-10 rounded-lg text-sm font-bold transition-all ${
                                                                    active
                                                                        ? 'bg-blue-600 text-white shadow dark:bg-blue-500'
                                                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-2"></div>
                                        </>
                                    )}

                                    {copiedMeasurementsCount > 0 && (
                                        <button
                                            onClick={() => {
                                                void handlePasteCopiedMeasurements();
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                                        >
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
                                                <i className="fas fa-paste text-lg text-blue-600 dark:text-blue-300"></i>
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-semibold block text-base">Colar Medidas</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{copiedMeasurementsCount} {copiedMeasurementsCount === 1 ? 'medida copiada' : 'medidas copiadas'}</span>
                                            </div>
                                            <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
                                        </button>
                                    )}

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
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Copiar, apagar ou editar multiplos itens</span>
                                        </div>
                                        <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsProgressModalOpen(true);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-50 dark:bg-emerald-900/20">
                                            <i className="fas fa-clipboard-check text-lg text-emerald-600 dark:text-emerald-300"></i>
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold block text-base">Progresso de Aplicacao</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                                                {aplicacaoProgress.started
                                                    ? `${Math.round(aplicacaoProgress.percent)}% executado · ${aplicacaoProgress.appliedPieces}/${aplicacaoProgress.totalPieces} pecas`
                                                    : 'Marque o que ja foi aplicado na obra'}
                                            </span>
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
                    </>
                )}
            </div>

            {proposalOptionsSlot && !isSelectionMode ? (
                <div className="relative z-40 -mt-2 mb-3">
                    {proposalOptionsSlot}
                </div>
            ) : null}

            <div
                onDragOver={handleDragOver}
                ref={listContainerRef}
                className={`relative z-0 ${getAnimationClass()}`}
                style={getAnimationStyle()}
            >
                {measurements.map((measurement, index) => (
                    <React.Fragment key={measurement.id}>
                        {dragOverIdx === index && <div className="h-1.5 bg-blue-500 rounded-full my-1 transition-all" />}
                        <MeasurementGroup
                            measurement={measurement}
                            films={films}
                            pricingMode={pricingMode}
                            onUpdate={(updated) => updateMeasurement(measurement.id, updated)}
                            onDelete={() => onDeleteMeasurement(measurement.id)}
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
                            useTouchNumpad={useTouchNumpad}
                            isActive={measurement.id === activeMeasurementId}
                            swipedItemId={swipedItemId}
                            onSetSwipedItem={handleSetSwipedItem}
                            onOpenDiscountModal={onOpenDiscountModal}
                            compatibleRetalhosCount={(compatibleRetalhosByMeasurement.get(measurement.id) || []).length}
                            isCheckingEstoque={isLoadingRetalhos}
                            onOpenRetalhoSuggestions={handleOpenRetalhoSuggestions}
                        />
                    </React.Fragment>
                ))}
                {dragOverIdx === measurements.length && <div className="h-1.5 bg-blue-500 rounded-full my-1 transition-all" />}
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

            <RetalhoSuggestionModal
                isOpen={retalhoMeasurementId !== null}
                measurement={selectedMeasurementForRetalho}
                retalhos={selectedMeasurementRetalhos}
                loading={isLoadingRetalhos}
                consumingRetalhoId={consumingRetalhoId}
                onClose={handleCloseRetalhoSuggestions}
                onConfirm={handleUseRetalho}
            />

            <ApplicationProgressModal
                isOpen={isProgressModalOpen}
                onClose={() => setIsProgressModalOpen(false)}
                measurements={measurements}
                onApplyMeasurements={applyMeasurements}
            />

      <style>{`
@keyframes carousel-left {
    0% { opacity: 1; transform: translateX(0) scale(1); }
    25% { opacity: 0.5; transform: translateX(-50px) scale(0.95); }
    50% { opacity: 0; transform: translateX(-100px) scale(0.9); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes carousel-right {
    0% { opacity: 1; transform: translateX(0) scale(1); }
    25% { opacity: 0.5; transform: translateX(50px) scale(0.95); }
    50% { opacity: 0; transform: translateX(100px) scale(0.9); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
}
.animate-carousel-left { animation: carousel-left 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.animate-carousel-right { animation: carousel-right 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
`}</style>
        </>
    );
};

export default React.memo(MeasurementList);
