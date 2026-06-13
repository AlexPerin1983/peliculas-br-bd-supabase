import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Measurement, Film } from '../types';
import { CuttingOptimizer, OptimizationResult, Rect } from '../utils/CuttingOptimizer';
import ConfirmationModal from './modals/ConfirmationModal';
import Modal from './ui/Modal';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PremiumFeatureSection } from './subscription/PremiumFeatureSection';
import { Loader2, Maximize2, Minus, Plus, RotateCcw, Save, X } from 'lucide-react';

interface CuttingOptimizationPanelProps {
    measurements: Measurement[];
    clientId?: number;
    optionId?: number;
    films: Film[];
}

const FULLSCREEN_SIDE_GUTTER_PX = 96;
const FULLSCREEN_VERTICAL_GUTTER_PX = 96;
const FULLSCREEN_MIN_FIT_SCALE = 1.25;
const FULLSCREEN_MAX_FIT_SCALE = 12;

const CuttingOptimizationPanel: React.FC<CuttingOptimizationPanelProps> = ({ measurements, clientId, optionId, films }) => {
    // Verificar acesso ao módulo de corte inteligente
    const { canUseCorteInteligente } = useSubscription();

    const uniqueFilms = useMemo(() => {
        const films = new Set(measurements.filter(m => m.active).map(m => m.pelicula));
        const sorted = Array.from(films).sort();
        return sorted.length > 0 ? sorted : ['Padrão'];
    }, [measurements]);

    const [activeFilm, setActiveFilm] = useState<string>(uniqueFilms[0]);
    const [filmSettings, setFilmSettings] = useState<Record<string, { rollWidth: string, bladeWidth: string, respectGrain: boolean }>>({});

    // Initialize settings for new films
    useEffect(() => {
        setFilmSettings(prev => {
            const newSettings = { ...prev };
            let changed = false;
            uniqueFilms.forEach(film => {
                if (!newSettings[film]) {
                    newSettings[film] = { rollWidth: '152', bladeWidth: '0', respectGrain: false };
                    changed = true;
                }
            });
            return changed ? newSettings : prev;
        });

        // Ensure activeFilm is valid
        if (!uniqueFilms.includes(activeFilm) && uniqueFilms.length > 0) {
            setActiveFilm(uniqueFilms[0]);
        }
    }, [uniqueFilms, activeFilm]);

    const currentSettings = filmSettings[activeFilm] || { rollWidth: '152', bladeWidth: '0', respectGrain: false };

    const updateCurrentSettings = (key: keyof typeof currentSettings, value: any) => {
        setFilmSettings(prev => ({
            ...prev,
            [activeFilm]: { ...(prev[activeFilm] || { rollWidth: '152', bladeWidth: '0', respectGrain: false }), [key]: value }
        }));
    };
    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [manualRotations, setManualRotations] = useState<{ [key: string]: boolean }>({});
    const [lockedItems, setLockedItems] = useState<{ [key: string]: Rect }>({});
    const lockedItemsRef = useRef(lockedItems);
    useEffect(() => {
        lockedItemsRef.current = lockedItems;
    }, [lockedItems]);
    const [useDeepSearch, setUseDeepSearch] = useState<boolean>(false);
    const [history, setHistory] = useState<{
        id: string;
        timestamp: number;
        result: OptimizationResult;
        manualRotations: { [key: string]: boolean };
        lockedItems: { [key: string]: Rect };
        methodName: string;
        filmName?: string;
    }[]>([]);
    const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
    const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [fullscreenZoom, setFullscreenZoom] = useState<number>(1);
    const [fullscreenOrientation, setFullscreenOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [fullscreenViewportSize, setFullscreenViewportSize] = useState({ width: 0, height: 0 });

    // Virtualização: rastrear posição do scroll para renderizar apenas peças visíveis
    const [scrollTop, setScrollTop] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fullscreenScrollRef = useRef<HTMLDivElement>(null);
    const fullscreenContentRef = useRef<HTMLDivElement>(null);
    const zoomLevelRef = useRef(zoomLevel);
    const fullscreenZoomRef = useRef(fullscreenZoom);

    // Storage key for this client/option combination
    const storageKey = clientId && optionId ? `peliculas-br-bd-cutting_history_${clientId}_${optionId}` : null;

    const [loadedKey, setLoadedKey] = useState<string | null>(null);

    // Load history from localStorage on mount or when client/option changes
    useEffect(() => {
        if (storageKey) {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const parsedHistory = JSON.parse(stored);
                    setHistory(parsedHistory);
                } else {
                    setHistory([]);
                }
            } catch (e) {
                console.error('Failed to load cutting history:', e);
                setHistory([]);
            }
            setLoadedKey(storageKey);
        } else {
            setHistory([]);
            setLoadedKey(null);
        }
    }, [storageKey]);

    // Save history to localStorage whenever it changes
    useEffect(() => {
        if (storageKey && loadedKey === storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(history));
        }
    }, [history, storageKey, loadedKey]);



    // Cleanup old histories (run once on mount)
    useEffect(() => {
        const cleanOldHistories = () => {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const keysToRemove: string[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('peliculas-br-bd-cutting_history_')) {
                    try {
                        const stored = localStorage.getItem(key);
                        if (stored) {
                            const data = JSON.parse(stored);
                            if (data[0]?.timestamp && data[0].timestamp < thirtyDaysAgo) {
                                keysToRemove.push(key);
                            }
                        }
                    } catch (e) {
                        // Invalid data, mark for removal
                        keysToRemove.push(key);
                    }
                }
            }

            keysToRemove.forEach(key => localStorage.removeItem(key));
        };

        cleanOldHistories();
    }, []);

    const handleDeleteHistory = () => {
        if (historyToDelete) {
            const newHistory = history.filter(item => item.id !== historyToDelete);
            setHistory(newHistory);
            setHistoryToDelete(null);
        }
    };

    const handleSelectHistory = (item: typeof history[0]) => {
        // Update all states in a single batch to avoid double-click issue
        setSelectedHistoryId(item.id);
        setResult(item.result);
        setManualRotations(item.manualRotations);
        setLockedItems(item.lockedItems || {});
    };

    // Ref for the container to calculate width
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [result]);

    // Track parameters of the last optimization to avoid re-running when saving
    const lastParamsRef = useRef<string>('');

    // Ref to hold current result for callback without dependency loop
    const resultRef = useRef<OptimizationResult | null>(null);
    useEffect(() => {
        resultRef.current = result;
    }, [result]);

    useEffect(() => {
        setSelectedPieceId(null);
        setSelectedGroupKey(null);
    }, [result]);

    useEffect(() => {
        zoomLevelRef.current = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        fullscreenZoomRef.current = fullscreenZoom;
    }, [fullscreenZoom]);

    useEffect(() => {
        if (!isFullscreen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isFullscreen]);

    useEffect(() => {
        if (!isFullscreen) return;

        const updateFullscreenViewport = () => {
            const container = fullscreenScrollRef.current;
            setFullscreenViewportSize({
                width: container?.clientWidth || window.innerWidth || 0,
                height: container?.clientHeight || window.innerHeight || 0,
            });
        };

        updateFullscreenViewport();

        const container = fullscreenScrollRef.current;
        let resizeObserver: ResizeObserver | null = null;

        if (container && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateFullscreenViewport);
            resizeObserver.observe(container);
        }

        window.addEventListener('resize', updateFullscreenViewport);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateFullscreenViewport);
        };
    }, [isFullscreen]);

    useEffect(() => {
        if (!isFullscreen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFullscreen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen]);

    useEffect(() => {
        if (!isFullscreen) return;

        requestAnimationFrame(() => {
            const container = fullscreenScrollRef.current;
            if (!container) return;

            if (typeof container.scrollTo === 'function') {
                container.scrollTo({ left: 0, top: 0 });
                return;
            }

            container.scrollLeft = 0;
            container.scrollTop = 0;
        });
    }, [isFullscreen, fullscreenOrientation]);

    const clampZoom = React.useCallback((value: number, min: number, max: number) => {
        return Math.min(max, Math.max(min, value));
    }, []);

    const getTouchDistance = React.useCallback((touches: TouchList) => {
        const [firstTouch, secondTouch] = [touches[0], touches[1]];
        return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
    }, []);

    const attachPinchZoom = React.useCallback((
        container: HTMLDivElement | null,
        getZoom: () => number,
        setZoom: React.Dispatch<React.SetStateAction<number>>,
        minZoom: number,
        maxZoom: number
    ) => {
        if (!container) return () => { };

        let pinchState: {
            lastDistance: number;
        } | null = null;

        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length !== 2) return;

            const lastDistance = getTouchDistance(event.touches);
            if (!Number.isFinite(lastDistance) || lastDistance <= 0) return;

            pinchState = {
                lastDistance
            };
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (!pinchState || event.touches.length !== 2) return;

            if (event.cancelable) {
                event.preventDefault();
            }

            const currentDistance = getTouchDistance(event.touches);
            if (!Number.isFinite(currentDistance) || currentDistance <= 0) return;

            const distanceRatio = currentDistance / pinchState.lastDistance;
            const pinchDeadZone = 0.015;
            const pinchSensitivity = 0.18;

            if (Math.abs(distanceRatio - 1) < pinchDeadZone) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            const focalX = centerX - rect.left;
            const focalY = centerY - rect.top;
            const previousZoom = getZoom();
            const softenedRatio = 1 + ((distanceRatio - 1) * pinchSensitivity);
            const nextZoom = clampZoom(previousZoom * softenedRatio, minZoom, maxZoom);
            const zoomRatio = nextZoom / previousZoom;

            if (Math.abs(previousZoom - nextZoom) < 0.005) {
                pinchState.lastDistance = currentDistance;
                return;
            }

            setZoom(nextZoom);
            container.scrollLeft = Math.max(0, ((container.scrollLeft + focalX) * zoomRatio) - focalX);
            container.scrollTop = Math.max(0, ((container.scrollTop + focalY) * zoomRatio) - focalY);
            pinchState.lastDistance = currentDistance;
        };

        const resetPinch = () => {
            pinchState = null;
        };

        const handleTouchEnd = (event: TouchEvent) => {
            if (event.touches.length < 2) {
                resetPinch();
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', resetPinch);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', resetPinch);
        };
    }, [clampZoom, getTouchDistance]);

    useEffect(() => {
        return attachPinchZoom(
            scrollContainerRef.current,
            () => zoomLevelRef.current,
            setZoomLevel,
            0.5,
            3
        );
    }, [attachPinchZoom, result]);

    useEffect(() => {
        if (!isFullscreen) return;

        const container = fullscreenScrollRef.current;
        const content = fullscreenContentRef.current;
        if (!container || !content) return;

        let pinchState: {
            baseZoom: number;
            targetZoom: number;
            startDistance: number;
            centerXInContainer: number;
            centerYInContainer: number;
            contentOffsetLeft: number;
            contentOffsetTop: number;
            anchorContentX: number;
            anchorContentY: number;
        } | null = null;

        let rafId: number | null = null;

        const resetVisualZoom = () => {
            content.style.transform = '';
            content.style.transformOrigin = '';
            content.style.willChange = '';
        };

        const applyVisualZoom = () => {
            if (!pinchState) {
                rafId = null;
                return;
            }

            const visualScale = pinchState.targetZoom / pinchState.baseZoom;
            content.style.transformOrigin = 'top left';
            content.style.transform = `scale(${visualScale})`;
            content.style.willChange = 'transform';

            container.scrollLeft = Math.max(
                0,
                pinchState.contentOffsetLeft + (pinchState.anchorContentX * visualScale) - pinchState.centerXInContainer
            );
            container.scrollTop = Math.max(
                0,
                pinchState.contentOffsetTop + (pinchState.anchorContentY * visualScale) - pinchState.centerYInContainer
            );
            rafId = null;
        };

        const scheduleVisualZoom = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(applyVisualZoom);
        };

        const commitPinchZoom = () => {
            if (!pinchState) return;

            const {
                baseZoom,
                targetZoom,
                centerXInContainer,
                centerYInContainer,
                contentOffsetLeft,
                contentOffsetTop,
                anchorContentX,
                anchorContentY
            } = pinchState;
            const zoomRatio = targetZoom / baseZoom;

            resetVisualZoom();
            pinchState = null;

            setFullscreenZoom(targetZoom);

            window.requestAnimationFrame(() => {
                const activeContainer = fullscreenScrollRef.current;
                if (!activeContainer || !Number.isFinite(zoomRatio) || zoomRatio <= 0) return;

                activeContainer.scrollLeft = Math.max(0, contentOffsetLeft + (anchorContentX * zoomRatio) - centerXInContainer);
                activeContainer.scrollTop = Math.max(0, contentOffsetTop + (anchorContentY * zoomRatio) - centerYInContainer);
            });
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length !== 2) return;

            const lastDistance = getTouchDistance(event.touches);
            if (!Number.isFinite(lastDistance) || lastDistance <= 0) return;

            const containerRect = container.getBoundingClientRect();
            const rect = content.getBoundingClientRect();
            const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            const centerXInContainer = centerX - containerRect.left;
            const centerYInContainer = centerY - containerRect.top;
            const contentOffsetLeft = rect.left - containerRect.left + container.scrollLeft;
            const contentOffsetTop = rect.top - containerRect.top + container.scrollTop;

            pinchState = {
                baseZoom: fullscreenZoomRef.current,
                targetZoom: fullscreenZoomRef.current,
                startDistance: lastDistance,
                centerXInContainer,
                centerYInContainer,
                contentOffsetLeft,
                contentOffsetTop,
                anchorContentX: centerXInContainer + container.scrollLeft - contentOffsetLeft,
                anchorContentY: centerYInContainer + container.scrollTop - contentOffsetTop
            };
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (!pinchState || event.touches.length !== 2) return;

            if (event.cancelable) {
                event.preventDefault();
            }

            const currentDistance = getTouchDistance(event.touches);
            if (!Number.isFinite(currentDistance) || currentDistance <= 0) return;

            const distanceRatio = currentDistance / pinchState.startDistance;
            const pinchDeadZone = 0.01;
            const pinchSensitivity = 0.45;

            if (Math.abs(distanceRatio - 1) < pinchDeadZone) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            const softenedRatio = Math.pow(distanceRatio, pinchSensitivity);

            pinchState.centerXInContainer = centerX - containerRect.left;
            pinchState.centerYInContainer = centerY - containerRect.top;
            pinchState.targetZoom = clampZoom(pinchState.baseZoom * softenedRatio, 0.25, 5);
            scheduleVisualZoom();
        };

        const handleTouchEnd = (event: TouchEvent) => {
            if (event.touches.length < 2) {
                commitPinchZoom();
            }
        };

        const handleTouchCancel = () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
                rafId = null;
            }
            resetVisualZoom();
            pinchState = null;
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchCancel);

        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            resetVisualZoom();
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchCancel);
        };
    }, [clampZoom, getTouchDistance, isFullscreen]);

    const handleOptimize = React.useCallback((saveToHistory: boolean = false) => {
        const width = parseFloat(currentSettings.rollWidth);
        const spacing = parseFloat(currentSettings.bladeWidth);

        if (isNaN(width) || width <= 0) {
            return;
        }

        // Create a signature of the core parameters (excluding lockedItems)
        const coreParamsObj = {
            width,
            spacing,
            respectGrain: currentSettings.respectGrain,
            activeFilm,
            measurements: measurements.filter(m => m.pelicula === activeFilm || (uniqueFilms.length === 1 && uniqueFilms[0] === 'Padrão')).map(m => ({
                id: m.id,
                largura: m.largura,
                altura: m.altura,
                quantidade: m.quantidade,
                active: m.active
            })),
            manualRotations,
            useDeepSearch
        };
        const coreParams = JSON.stringify(coreParamsObj);

        // Full signature including lockedItems
        const fullParams = JSON.stringify({
            core: coreParamsObj,
            lockedItems: lockedItemsRef.current
        });

        // Check if we can skip optimization
        let lastCoreParams = '';
        try {
            if (lastParamsRef.current) {
                const lastParsed = JSON.parse(lastParamsRef.current);
                lastCoreParams = JSON.stringify(lastParsed.core);
            }
        } catch (e) {
            // Ignore parse error
        }

        if (saveToHistory && resultRef.current && coreParams === lastCoreParams) {
            // Just save the current result with the new lockedItems state
            const newId = Date.now().toString();
            setHistory(prev => [
                {
                    id: newId,
                    timestamp: Date.now(),
                    result: resultRef.current!,
                    manualRotations: { ...manualRotations },
                    lockedItems: { ...lockedItemsRef.current },
                    methodName: useDeepSearch ? 'Otimização Profunda' : 'Automático',
                    filmName: activeFilm
                },
                ...prev
            ].slice(0, 10));
            setSelectedHistoryId(newId);

            // Update lastParamsRef to match current state so subsequent checks are consistent
            lastParamsRef.current = fullParams;
            return;
        }

        setIsOptimizing(true);

        // Use setTimeout to allow UI to update (show loading state) before heavy calculation
        setTimeout(() => {
            const optimizer = new CuttingOptimizer({
                rollWidth: width,
                bladeWidth: isNaN(spacing) ? 0 : spacing / 10, // mm to cm
                allowRotation: !currentSettings.respectGrain
            });

            const relevantMeasurements = measurements.filter(m =>
                (m.pelicula === activeFilm || (uniqueFilms.length === 1 && uniqueFilms[0] === 'Padrão')) && m.active
            );

            relevantMeasurements.forEach(m => {
                const qty = Math.max(1, Math.floor(m.quantidade || 1));
                // Assumes input is in meters, converts to cm
                const w = parseFloat(String(m.largura).replace(',', '.')) * 100;
                const h = parseFloat(String(m.altura).replace(',', '.')) * 100;

                if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                    for (let i = 0; i < qty; i++) {
                        // Use unique ID for each piece to allow individual rotation
                        optimizer.addItem(w, h, `${m.id}-${i}`, `${(w / 100).toFixed(2)}x${(h / 100).toFixed(2)}`);
                    }
                }
            });

            const newResult = optimizer.optimize(manualRotations, useDeepSearch, Object.values(lockedItemsRef.current));

            setResult(newResult);
            lastParamsRef.current = fullParams;
            setIsOptimizing(false);

            if (saveToHistory && newResult) {
                const newId = Date.now().toString();
                setHistory(prev => [
                    {
                        id: newId,
                        timestamp: Date.now(),
                        result: newResult,
                        manualRotations: { ...manualRotations },
                        lockedItems: { ...lockedItemsRef.current },
                        methodName: useDeepSearch ? 'Otimização Profunda' : 'Automático',
                        filmName: activeFilm
                    },
                    ...prev
                ].slice(0, 10)); // Keep last 10
                setSelectedHistoryId(newId);
            }
        }, 50);
    }, [currentSettings, measurements, manualRotations, useDeepSearch, activeFilm, uniqueFilms]);

    // Auto-optimize when dependencies change
    useEffect(() => {
        const timer = setTimeout(() => {
            handleOptimize(false);
        }, 500); // Debounce slightly
        return () => clearTimeout(timer);
    }, [handleOptimize, activeFilm]);

    // Calculate dynamic scale (sem limite de altura - a virtualização cuida da renderização)
    // Desconta padding do contêiner + régua esquerda + espaço da cota direita,
    // para o plano caber inteiro a 100% de zoom sem scroll horizontal
    const horizontalGutter = containerWidth < 640 ? 152 : 200;
    const availableWidth = Math.max(0, containerWidth - horizontalGutter);
    const baseScale = result && result.rollWidth > 0 ? availableWidth / result.rollWidth : 2;
    const scale = baseScale * zoomLevel;

    const formatRulerLabel = React.useCallback((valueInCm: number) => {
        if (valueInCm === 0) return '0';

        const minimumFractionDigits = valueInCm % 100 === 0 ? 0 : valueInCm % 10 === 0 ? 1 : 2;
        return (valueInCm / 100).toLocaleString('pt-BR', {
            minimumFractionDigits,
            maximumFractionDigits: 2
        });
    }, []);

    const getRulerLabelStep = React.useCallback((pixelsPerCm: number) => {
        if (pixelsPerCm >= 18) return 5;
        if (pixelsPerCm >= 8) return 10;
        if (pixelsPerCm >= 4) return 20;
        if (pixelsPerCm >= 2) return 50;
        return 100;
    }, []);

    const buildRulerLabels = React.useCallback((lengthInCm: number, pixelsPerCm: number) => {
        const labelStep = getRulerLabelStep(pixelsPerCm);
        const labels: number[] = [];

        for (let value = 0; value <= lengthInCm; value += 10) {
            if (value !== 0 && value % labelStep !== 0) continue;
            labels.push(value);
        }

        return labels;
    }, [getRulerLabelStep]);

    const filterLabelsNearTerminalMarker = React.useCallback((
        labels: number[],
        lengthInCm: number,
        pixelsPerCm: number,
        minDistancePx: number = 48
    ) => {
        if (lengthInCm % 10 === 0) return labels;

        const terminalPosition = lengthInCm * pixelsPerCm;
        return labels.filter((value) => {
            if (value === 0) return true;
            return terminalPosition - (value * pixelsPerCm) >= minDistancePx;
        });
    }, []);

    const createHorizontalTickStyle = React.useCallback((pixelsPerCm: number, stepInCm: number, color: string) => ({
        backgroundImage: `repeating-linear-gradient(to right, ${color} 0 1px, transparent 1px ${pixelsPerCm * stepInCm}px)`
    }), []);

    const createVerticalTickStyle = React.useCallback((pixelsPerCm: number, stepInCm: number, color: string) => ({
        backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0 1px, transparent 1px ${pixelsPerCm * stepInCm}px)`
    }), []);

    const getHorizontalLabelStyle = React.useCallback((valueInCm: number, pixelsPerCm: number, totalLengthInCm: number) => {
        const left = valueInCm * pixelsPerCm;
        const totalWidth = totalLengthInCm * pixelsPerCm;

        if (left <= 8) {
            return { left: `${left + 2}px`, transform: 'none' };
        }

        if (totalWidth - left <= 16) {
            return { left: `${left}px`, transform: 'translateX(-100%)' };
        }

        return { left: `${left}px`, transform: 'translateX(-50%)' };
    }, []);

    const getVerticalLabelStyle = React.useCallback((valueInCm: number, pixelsPerCm: number, totalLengthInCm: number) => {
        const top = valueInCm * pixelsPerCm;
        const totalHeight = totalLengthInCm * pixelsPerCm;

        if (top <= 8) {
            return { top: `${top}px`, transform: 'none' };
        }

        if (totalHeight - top <= 14) {
            return { top: `${top - 2}px`, transform: 'translateY(-100%)' };
        }

        return { top: `${top}px`, transform: 'translateY(-50%)' };
    }, []);

    const horizontalRulerLabels = useMemo(() => {
        if (!result) return [];
        return filterLabelsNearTerminalMarker(
            buildRulerLabels(result.rollWidth, scale),
            result.rollWidth,
            scale
        );
    }, [result, buildRulerLabels, filterLabelsNearTerminalMarker, scale]);

    const verticalRulerLabels = useMemo(() => {
        if (!result) return [];
        return filterLabelsNearTerminalMarker(
            buildRulerLabels(result.totalHeight, scale),
            result.totalHeight,
            scale,
            64
        );
    }, [result, buildRulerLabels, filterLabelsNearTerminalMarker, scale]);

    const fullscreenAxisWidth = result
        ? (fullscreenOrientation === 'landscape' ? result.totalHeight : result.rollWidth)
        : 0;
    const fullscreenAxisHeight = result
        ? (fullscreenOrientation === 'landscape' ? result.rollWidth : result.totalHeight)
        : 0;
    const fullscreenViewportWidth = fullscreenViewportSize.width || window.innerWidth || 0;
    const fullscreenViewportHeight = fullscreenViewportSize.height || window.innerHeight || 0;
    const fullscreenFitWidth = Math.max(280, fullscreenViewportWidth - FULLSCREEN_SIDE_GUTTER_PX);
    const fullscreenFitHeight = Math.max(240, fullscreenViewportHeight - FULLSCREEN_VERTICAL_GUTTER_PX);
    const fullscreenFallbackScale = baseScale > 0 ? baseScale : 2;
    const fullscreenRawFitScale = fullscreenOrientation === 'landscape'
        ? fullscreenFitHeight / Math.max(1, fullscreenAxisHeight)
        : fullscreenFitWidth / Math.max(1, fullscreenAxisWidth);
    const fullscreenBaseScale = Number.isFinite(fullscreenRawFitScale) && fullscreenAxisWidth > 0 && fullscreenAxisHeight > 0
        ? Math.min(FULLSCREEN_MAX_FIT_SCALE, Math.max(FULLSCREEN_MIN_FIT_SCALE, fullscreenRawFitScale))
        : fullscreenFallbackScale;
    const fullscreenScale = fullscreenBaseScale * fullscreenZoom;
    const fullscreenHorizontalRulerLabels = useMemo(() => {
        if (!result) return [];
        const axisLength = fullscreenOrientation === 'landscape' ? result.totalHeight : result.rollWidth;
        return filterLabelsNearTerminalMarker(
            buildRulerLabels(axisLength, fullscreenScale),
            axisLength,
            fullscreenScale
        );
    }, [result, buildRulerLabels, filterLabelsNearTerminalMarker, fullscreenScale, fullscreenOrientation]);

    const fullscreenVerticalRulerLabels = useMemo(() => {
        if (!result) return [];
        const axisLength = fullscreenOrientation === 'landscape' ? result.rollWidth : result.totalHeight;
        return filterLabelsNearTerminalMarker(
            buildRulerLabels(axisLength, fullscreenScale),
            axisLength,
            fullscreenScale,
            64
        );
    }, [result, buildRulerLabels, filterLabelsNearTerminalMarker, fullscreenScale, fullscreenOrientation]);
    const fullscreenLinearMeters = result ? (result.totalHeight / 100).toFixed(2).replace('.', ',') : '0,00';
    const fullscreenUsage = result ? result.efficiency.toFixed(0) : '0';
    const fullscreenWaste = result ? Math.max(0, 100 - result.efficiency).toFixed(0) : '0';
    const fullscreenPieces = result ? result.placedItems.length : 0;
    const fullscreenAxisWidthMeters = (fullscreenAxisWidth / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fullscreenAxisHeightMeters = (fullscreenAxisHeight / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fullscreenMinimap = useMemo(() => {
        const maxWidth = fullscreenOrientation === 'landscape' ? 220 : 132;
        const maxHeight = fullscreenOrientation === 'landscape' ? 132 : 220;
        const safeWidth = Math.max(1, fullscreenAxisWidth);
        const safeHeight = Math.max(1, fullscreenAxisHeight);
        const minimapScale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight);

        return {
            scale: minimapScale,
            width: Math.max(48, Math.round(safeWidth * minimapScale)),
            height: Math.max(64, Math.round(safeHeight * minimapScale)),
        };
    }, [fullscreenAxisHeight, fullscreenAxisWidth, fullscreenOrientation]);
    const visualSummary = useMemo(() => {
        if (!result) return null;

        const usedArea = result.placedItems.reduce((sum, item) => sum + (item.w * item.h), 0);
        const totalArea = result.rollWidth * result.totalHeight;
        const wastePercent = totalArea > 0 ? Math.max(0, 100 - result.efficiency) : 0;

        return {
            linearMeters: (result.totalHeight / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            rollWidthMeters: (result.rollWidth / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            usedAreaMeters: (usedArea / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            wastePercent: wastePercent.toFixed(0),
            efficiency: result.efficiency.toFixed(0),
            pieces: result.placedItems.length,
        };
    }, [result]);
    const activeFilmMaterialCost = useMemo(() => {
        if (!result) return null;

        const film = films.find(f => f.nome === activeFilm);
        if (!film?.precoMetroLinear) return null;

        return (result.totalHeight / 100) * film.precoMetroLinear;
    }, [activeFilm, films, result]);
    const activeFilmMaterialCostText = activeFilmMaterialCost !== null
        ? activeFilmMaterialCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : null;

    const getFullscreenItemFrame = React.useCallback((item: Rect) => {
        const isLandscape = fullscreenOrientation === 'landscape';

        return {
            left: `${(isLandscape ? item.y : item.x) * fullscreenScale}px`,
            top: `${(isLandscape ? item.x : item.y) * fullscreenScale}px`,
            width: `${(isLandscape ? item.h : item.w) * fullscreenScale}px`,
            height: `${(isLandscape ? item.w : item.h) * fullscreenScale}px`,
            horizontalLabel: ((isLandscape ? item.h : item.w) / 100).toFixed(2),
            verticalLabel: ((isLandscape ? item.w : item.h) / 100).toFixed(2),
        };
    }, [fullscreenOrientation, fullscreenScale]);

    const handleFullscreenWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (fullscreenOrientation !== 'landscape') return;
        if (event.ctrlKey) return;

        const container = fullscreenScrollRef.current;
        if (!container) return;

        const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;
        if (!hasHorizontalOverflow) return;

        const primarilyVerticalScroll = Math.abs(event.deltaY) > Math.abs(event.deltaX);
        if (!primarilyVerticalScroll || event.deltaY === 0) return;

        event.preventDefault();
        container.scrollLeft += event.deltaY;
    }, [fullscreenOrientation]);

    // Virtualização: calcular quais peças estão visíveis na viewport
    const VIEWPORT_HEIGHT = 600; // Altura aproximada da viewport visível
    const getPieceGroupKey = React.useCallback((item: Pick<Rect, 'w' | 'h'>) => {
        return `${Math.round(item.w * 10) / 10}x${Math.round(item.h * 10) / 10}`;
    }, []);

    const getPieceId = React.useCallback((item: Rect) => {
        return item.id !== undefined && item.id !== null ? String(item.id) : `${item.x}:${item.y}:${item.w}:${item.h}`;
    }, []);

    const togglePieceSelection = React.useCallback((item: Rect) => {
        const pieceId = getPieceId(item);

        if (selectedPieceId === pieceId) {
            setSelectedPieceId(null);
            setSelectedGroupKey(null);
            return;
        }

        setSelectedPieceId(pieceId);
        setSelectedGroupKey(getPieceGroupKey(item));
    }, [getPieceGroupKey, getPieceId, selectedPieceId]);

    const BUFFER_PX = 500; // Buffer acima/abaixo para scroll suave

    const visibleItems = useMemo(() => {
        if (!result || !result.placedItems) return [];

        const viewportTop = scrollTop;
        const viewportBottom = scrollTop + VIEWPORT_HEIGHT + BUFFER_PX * 2;

        // Filtrar apenas peças que estão na área visível (com buffer)
        return result.placedItems.filter(item => {
            const itemTop = item.y * scale;
            const itemBottom = (item.y + item.h) * scale;
            // Peça está visível se qualquer parte dela está na viewport + buffer
            return itemBottom >= (viewportTop - BUFFER_PX) && itemTop <= viewportBottom;
        });
    }, [result, scrollTop, scale]);



    const groupedItems = useMemo(() => {
        if (!result) return [];
        const groups: { [key: string]: { key: string, w: number, h: number, count: number, indices: number[], areaM2: number } } = {};

        result.placedItems.forEach((item, index) => {
            const key = getPieceGroupKey(item);
            if (!groups[key]) {
                groups[key] = { key, w: item.w, h: item.h, count: 0, indices: [], areaM2: 0 };
            }
            groups[key].count++;
            groups[key].indices.push(index + 1);
            groups[key].areaM2 += (item.w * item.h) / 10000;
        });

        return Object.values(groups).sort((a, b) => (b.w * b.h) - (a.w * a.h));
    }, [getPieceGroupKey, result]);

    // Peças que não couberam na bobina, agrupadas por dimensão
    const unplacedGroups = useMemo(() => {
        if (!result?.unplacedItems?.length) return [];
        const groups: { [key: string]: { key: string, maxSide: number, minSide: number, count: number, fitsIfRotated: boolean } } = {};

        result.unplacedItems.forEach(item => {
            const maxSide = Math.max(item.w, item.h);
            const minSide = Math.min(item.w, item.h);
            const key = `${Math.round(maxSide * 10) / 10}x${Math.round(minSide * 10) / 10}`;
            if (!groups[key]) {
                groups[key] = { key, maxSide, minSide, count: 0, fitsIfRotated: minSide <= result.rollWidth };
            }
            groups[key].count++;
        });

        return Object.values(groups).sort((a, b) => (b.maxSide * b.minSide) - (a.maxSide * a.minSide));
    }, [result]);
    const unplacedCount = result?.unplacedItems?.length ?? 0;

    const openFullscreenView = React.useCallback(() => {
        setFullscreenZoom(1);
        setIsFullscreen(true);
    }, []);

    // Linha de cota estilo desenho técnico: extremidades marcadas e etiqueta central.
    // Substitui os antigos cards flutuantes de Bobina/Comprimento sobre as réguas.
    const renderWidthDimension = (meters: string, kicker: string) => (
        <div className="flex w-full items-center">
            <span className="h-2.5 w-px shrink-0 bg-cyan-600/70 dark:bg-cyan-300/70"></span>
            <span className="h-px flex-1 bg-cyan-600/40 dark:bg-cyan-300/30"></span>
            <span className="mx-1.5 flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-full border border-cyan-600/25 bg-white/95 px-2 py-1 shadow-sm dark:border-cyan-300/25 dark:bg-slate-950/95">
                <span className="text-[8px] font-black uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">{kicker}</span>
                <span className="text-[11px] font-black leading-none tabular-nums text-slate-900 dark:text-white">{meters}</span>
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">m</span>
            </span>
            <span className="h-px flex-1 bg-cyan-600/40 dark:bg-cyan-300/30"></span>
            <span className="h-2.5 w-px shrink-0 bg-cyan-600/70 dark:bg-cyan-300/70"></span>
        </div>
    );

    const renderLengthDimension = (meters: string, kicker: string) => (
        <div className="flex h-full flex-col items-center">
            <span className="h-px w-2.5 shrink-0 bg-cyan-600/70 dark:bg-cyan-300/70"></span>
            <span className="w-px flex-1 bg-cyan-600/40 dark:bg-cyan-300/30"></span>
            <span className="my-1.5 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-cyan-600/25 bg-white/95 px-1.5 py-2 shadow-sm dark:border-cyan-300/25 dark:bg-slate-950/95" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <span className="text-[8px] font-black uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">{kicker}</span>
                <span className="text-[11px] font-black leading-none tabular-nums text-slate-900 dark:text-white">{meters}</span>
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">m</span>
            </span>
            <span className="w-px flex-1 bg-cyan-600/40 dark:bg-cyan-300/30"></span>
            <span className="h-px w-2.5 shrink-0 bg-cyan-600/70 dark:bg-cyan-300/70"></span>
        </div>
    );

    return (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Bloqueio para quem não tem módulo */}
            {!canUseCorteInteligente ? (
                <PremiumFeatureSection
                    moduleId="corte_inteligente"
                    title="Plano de Corte Inteligente"
                    description="Otimize seus cortes, reduza desperdícios e economize até 30% de material com nosso algoritmo inteligente."
                />
            ) : (
                <>
                    {/* Header */}
                    <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        {/* Desktop Header */}
                        <div className="hidden sm:flex p-4 items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    Otimizador de Corte
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 font-semibold">BETA</span>
                                </h3>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Aproveitamento da bobina e sequência de cortes por película</p>
                            </div>

                            {/* Desktop Tabs */}
                            {uniqueFilms.length > 1 && (
                                <div className="flex overflow-x-auto px-4 pb-0 gap-1 no-scrollbar">
                                    {uniqueFilms.map(film => (
                                        <button
                                            key={film}
                                            onClick={() => setActiveFilm(film)}
                                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeFilm === film
                                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            {film}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Mobile Header - Film Tabs */}
                        <div className="sm:hidden flex items-center justify-between pl-3 pr-2 bg-slate-50 dark:bg-slate-900">
                            {/* Tabs */}
                            <div className="flex overflow-x-auto gap-4 no-scrollbar flex-1 mr-2 mask-linear-fade">
                                {uniqueFilms.length > 0 ? uniqueFilms.map(film => (
                                    <button
                                        key={film}
                                        onClick={() => setActiveFilm(film)}
                                        className={`py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeFilm === film
                                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        {film}
                                    </button>
                                )) : (
                                    <span className="py-3 text-sm font-medium text-slate-500">Padrão</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-2 sm:p-6">
                        {/* Settings - Always visible */}
                        <div className={`block mb-2 sm:mb-6`}>
                            {/* Mobile: technical control deck */}
                            <div className="sm:hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.10)] dark:border-slate-700/80 dark:bg-slate-950 dark:shadow-[0_14px_34px_rgba(2,6,23,0.26)]">
                                <div className="grid grid-cols-[minmax(0,1fr)_92px] border-b border-slate-200 dark:border-slate-800">
                                    <div className="grid min-w-0 grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
                                        <label className="block px-3 py-2">
                                            <span className="block text-[10px] font-bold text-slate-500">Bobina</span>
                                            <span className="mt-0.5 flex items-end gap-1">
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={currentSettings.rollWidth}
                                                    onChange={e => updateCurrentSettings('rollWidth', e.target.value)}
                                                    placeholder="152"
                                                    className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] font-semibold leading-none text-slate-900 outline-none focus:ring-0 dark:text-white"
                                                />
                                                <span className="pb-0.5 text-[10px] font-medium text-slate-500">cm</span>
                                            </span>
                                        </label>
                                        <label className="block px-3 py-2">
                                            <span className="block text-[10px] font-bold text-slate-500">Sangria</span>
                                            <span className="mt-0.5 flex items-end gap-1">
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={currentSettings.bladeWidth}
                                                    onChange={e => updateCurrentSettings('bladeWidth', e.target.value)}
                                                    placeholder="0"
                                                    className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] font-semibold leading-none text-slate-900 outline-none focus:ring-0 dark:text-white"
                                                />
                                                <span className="pb-0.5 text-[10px] font-medium text-slate-500">mm</span>
                                            </span>
                                        </label>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleOptimize(true)}
                                        disabled={!result || isOptimizing}
                                        className={`m-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)] transition active:bg-blue-700 ${(!result || isOptimizing) ? 'cursor-not-allowed opacity-45' : 'hover:bg-blue-500'}`}
                                    >
                                        {isOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                                        <span>{isOptimizing ? 'Salvando' : 'Salvar'}</span>
                                    </button>
                                </div>

                                {visualSummary && (
                                    <div className="px-3 py-2.5">
                                        <div className="flex items-end justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-semibold text-slate-500">Metro linear</div>
                                                <div className="mt-0.5 text-[22px] font-semibold leading-none text-slate-900 dark:text-white">
                                                    {visualSummary.linearMeters}<span className="ml-1 text-[12px] font-medium text-slate-500">m</span>
                                                </div>
                                            </div>
                                            <div className="grid shrink-0 grid-cols-2 gap-3 text-right">
                                                <div>
                                                    <div className="text-[10px] font-semibold text-slate-500">Uso</div>
                                                    <div className="mt-0.5 text-[16px] font-semibold leading-none text-blue-600 dark:text-blue-300">{visualSummary.efficiency}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-semibold text-slate-500">Sobra</div>
                                                    <div className="mt-0.5 text-[16px] font-semibold leading-none text-slate-900 dark:text-white">{visualSummary.wastePercent}%</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-900/80">
                                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Material</span>
                                            <span className="text-[14px] font-semibold text-slate-900 dark:text-white">{activeFilmMaterialCost !== null ? `R$ ${activeFilmMaterialCost.toFixed(2).replace('.', ',')}` : '--'}</span>
                                            <span className="ml-auto text-[10px] font-semibold text-slate-500">{visualSummary.pieces} peças</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 border-t border-slate-200 px-2 py-2 dark:border-slate-800">
                                    <label className={`inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${currentSettings.respectGrain ? 'bg-blue-500/15 text-blue-700 ring-1 ring-blue-400/40 dark:text-blue-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800'}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${currentSettings.respectGrain ? 'bg-blue-500 dark:bg-blue-300' : 'bg-slate-400 dark:bg-slate-600'}`}></span>
                                        <input type="checkbox" checked={currentSettings.respectGrain} onChange={e => updateCurrentSettings('respectGrain', e.target.checked)} className="hidden" />
                                        Veio
                                    </label>
                                    <label className={`inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${useDeepSearch ? 'bg-blue-500/15 text-blue-700 ring-1 ring-blue-400/40 dark:text-blue-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800'}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${useDeepSearch ? 'bg-blue-500 dark:bg-blue-300' : 'bg-slate-400 dark:bg-slate-600'}`}></span>
                                        <input type="checkbox" checked={useDeepSearch} onChange={e => setUseDeepSearch(e.target.checked)} className="hidden" />
                                        Pro
                                    </label>
                                    <div className="ml-auto flex h-8 shrink-0 items-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                                            className="flex h-8 w-8 items-center justify-center text-slate-600 active:bg-slate-200 dark:text-slate-300 dark:active:bg-slate-800"
                                            title="Diminuir zoom"
                                        >
                                            <Minus className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                        <span className="min-w-[36px] px-1 text-center text-[10px] font-black tabular-nums text-slate-600 dark:text-slate-300">{Math.round(zoomLevel * 100)}%</span>
                                        <button
                                            type="button"
                                            onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                                            className="flex h-8 w-8 items-center justify-center text-slate-600 active:bg-slate-200 dark:text-slate-300 dark:active:bg-slate-800"
                                            title="Aumentar zoom"
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            openFullscreenView();
                                        }}
                                        aria-label="Expandir tela cheia"
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-blue-600 ring-1 ring-blue-500/30 active:bg-slate-200 dark:bg-slate-900 dark:text-blue-200 dark:active:bg-slate-800"
                                        title="Expandir tela cheia"
                                    >
                                        <Maximize2 className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                </div>
                            </div>

                            {/* Desktop: barra de configuração */}
                            <div className="hidden sm:block rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                <div className="flex flex-wrap items-center gap-2 p-2">
                                    <label className="flex min-w-[150px] cursor-text flex-col rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-blue-500 focus-within:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:focus-within:border-blue-400 dark:focus-within:bg-slate-950">
                                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Largura da bobina</span>
                                        <span className="mt-0.5 flex items-baseline gap-1">
                                            <input type="number" inputMode="decimal" value={currentSettings.rollWidth} onChange={e => updateCurrentSettings('rollWidth', e.target.value)} placeholder="152" className="w-20 border-0 bg-transparent p-0 text-base font-bold tabular-nums text-slate-900 outline-none focus:ring-0 dark:text-white" />
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">cm</span>
                                        </span>
                                    </label>
                                    <label className="flex min-w-[130px] cursor-text flex-col rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-blue-500 focus-within:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:focus-within:border-blue-400 dark:focus-within:bg-slate-950" title="Espaçamento entre os cortes (sangria)">
                                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Sangria do corte</span>
                                        <span className="mt-0.5 flex items-baseline gap-1">
                                            <input type="number" inputMode="decimal" value={currentSettings.bladeWidth} onChange={e => updateCurrentSettings('bladeWidth', e.target.value)} placeholder="0" className="w-16 border-0 bg-transparent p-0 text-base font-bold tabular-nums text-slate-900 outline-none focus:ring-0 dark:text-white" />
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">mm</span>
                                        </span>
                                    </label>
                                    <div className="mx-1 hidden h-9 w-px bg-slate-200 dark:bg-slate-700 lg:block"></div>
                                    <label className="flex h-[52px] items-center gap-2 cursor-pointer select-none rounded-lg px-2 hover:bg-slate-50 dark:hover:bg-slate-800/60" title="Impede a rotação das peças para respeitar o veio do material">
                                        <div className={`w-9 h-5 shrink-0 rounded-full p-0.5 transition-colors ${currentSettings.respectGrain ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${currentSettings.respectGrain ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <input type="checkbox" checked={currentSettings.respectGrain} onChange={e => updateCurrentSettings('respectGrain', e.target.checked)} className="hidden" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Resp. Veio</span>
                                    </label>
                                    <label className="flex h-[52px] items-center gap-2 cursor-pointer select-none rounded-lg px-2 hover:bg-slate-50 dark:hover:bg-slate-800/60" title="Testa combinações extras para encontrar um plano com menos sobra (mais lento)">
                                        <div className={`w-9 h-5 shrink-0 rounded-full p-0.5 transition-colors ${useDeepSearch ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${useDeepSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <input type="checkbox" checked={useDeepSearch} onChange={e => setUseDeepSearch(e.target.checked)} className="hidden" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">Otimização Profunda<span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">ß</span></span>
                                    </label>
                                    <button onClick={() => handleOptimize(true)} disabled={!result || isOptimizing} className={`ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 active:bg-blue-700 ${(!result || isOptimizing) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {isOptimizing ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Otimizando...</span></>) : (<><Save className="h-4 w-4" aria-hidden="true" /><span>Gerar Plano de Corte</span></>)}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* History List - Compact for mobile */}
                        {history.length > 0 && (
                            <div className="mb-2 sm:mb-6 p-2 sm:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h4 className="text-[10px] sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-3 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-400">
                                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                                    </svg>
                                    <span className="sm:hidden">Versões</span>
                                    <span className="hidden sm:inline">Histórico de Versões</span>
                                </h4>
                                <div className="flex gap-1.5 sm:gap-3 overflow-x-auto pb-1">
                                    {history.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`relative flex-shrink-0 p-1.5 sm:p-3 rounded-md sm:rounded-lg border text-left transition-all min-w-[90px] sm:min-w-[160px] group ${selectedHistoryId === item.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 ring-1 ring-blue-500 dark:ring-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'}`}
                                        >
                                            <button
                                                onClick={() => handleSelectHistory(item)}
                                                className="w-full text-left"
                                            >
                                                <div className="text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                                    {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="font-bold text-slate-800 dark:text-slate-100 text-[11px] sm:text-sm">
                                                    {item.result.totalHeight.toFixed(0)}<span className="text-[9px] sm:text-xs font-normal">cm</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[9px] sm:text-xs">
                                                    <span className="text-slate-600 dark:text-slate-400">{item.result.efficiency.toFixed(0)}%</span>
                                                    {item.methodName === 'Otimização Profunda' && (
                                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500" title="Otimização Profunda"></span>
                                                    )}
                                                </div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setHistoryToDelete(item.id);
                                                }}
                                                className="absolute -top-1 -right-1 p-1 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-600"
                                                title="Excluir versão"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 sm:w-3.5 sm:h-3.5">
                                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Visualization */}
                        {result && (
                            <div className="animate-fade-in" ref={containerRef}>
                                {/* Stats - Compact inline for mobile */}
                                <div className="mb-5 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:block">
                                    <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40 sm:flex sm:items-center sm:justify-between sm:px-4 sm:py-3">
                                        <div className="min-w-0">
                                            <div className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:block">Plano técnico</div>
                                            <div className="truncate text-sm font-black text-slate-900 dark:text-slate-100 sm:mt-0.5 sm:text-base">Corte - {activeFilm}</div>
                                        </div>
                                        {visualSummary && (
                                            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-500 dark:text-slate-400 sm:mt-0 sm:gap-2 sm:text-[11px]">
                                                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Bobina {visualSummary.rollWidthMeters} m</span>
                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{visualSummary.usedAreaMeters} m² úteis</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Mobile layout */}
                                    <div className="space-y-2 sm:hidden">
                                        <div className="grid grid-cols-4 gap-1.5 p-2 pb-0">
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-center dark:border-slate-700 dark:bg-slate-800/80">
                                                <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Metro</div>
                                                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{visualSummary?.linearMeters}</span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">m</span>
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1.5 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
                                                <div className="text-[8px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Uso</div>
                                                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                                                    <span className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">{visualSummary?.efficiency}</span>
                                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300">%</span>
                                                </div>
                                            </div>
                                            <div className={`rounded-lg border px-1.5 py-1.5 text-center ${unplacedCount > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'}`}>
                                                <div className={`text-[8px] font-semibold uppercase tracking-wide ${unplacedCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}>Peças</div>
                                                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{result.placedItems.length}</span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">pçs</span>
                                                </div>
                                                {unplacedCount > 0 && (
                                                    <div className="text-[8px] font-bold text-red-600 dark:text-red-400">{unplacedCount} fora</div>
                                                )}
                                            </div>
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1.5 text-center dark:border-amber-800 dark:bg-amber-950/30">
                                                <div className="text-[8px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Sobra</div>
                                                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                                                    <span className="font-bold text-amber-800 dark:text-amber-200 text-sm">{visualSummary?.wastePercent}</span>
                                                    <span className="text-[10px] text-amber-700 dark:text-amber-300">%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {activeFilmMaterialCost !== null && (
                                            <div className="mx-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Material</span>
                                                <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                                                    R$ {activeFilmMaterialCost.toFixed(2).replace('.', ',')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="relative z-30 flex items-center gap-2 px-2 pb-2">
                                            <div className="flex h-9 flex-1 items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                                                    className="rounded bg-slate-200 p-1.5 text-slate-600 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                                                    title="Diminuir zoom"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                                <span className="text-xs font-mono text-slate-700 dark:text-slate-300 min-w-[42px] text-center">{Math.round(zoomLevel * 100)}%</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                                                    className="rounded bg-slate-200 p-1.5 text-slate-600 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                                                    title="Aumentar zoom"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    openFullscreenView();
                                                }}
                                                aria-label="Expandir tela cheia"
                                                className="pointer-events-auto relative z-20 inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm touch-manipulation active:bg-blue-700"
                                                title="Expandir tela cheia"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM12.22 13.28l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 00-1.06 1.06zM3.5 4.56l3.22 3.22a.75.75 0 001.06-1.06L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0V4.56z" />
                                                </svg>
                                                <span className="sr-only">Expandir</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Desktop layout */}
                                    <div className={`hidden sm:grid ${activeFilmMaterialCostText ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} sm:divide-x sm:divide-slate-200 dark:sm:divide-slate-800`}>
                                        <div className="px-4 py-3.5">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Metro linear</div>
                                            <div className="mt-1.5 flex items-baseline gap-1">
                                                <span className="text-[22px] font-black leading-none tabular-nums text-slate-900 dark:text-white">{visualSummary?.linearMeters}</span>
                                                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">m</span>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3.5">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Aproveitamento</div>
                                            <div className="mt-1.5 flex items-baseline gap-1">
                                                <span className="text-[22px] font-black leading-none tabular-nums text-emerald-600 dark:text-emerald-300">{visualSummary?.efficiency}</span>
                                                <span className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-300/70">%</span>
                                            </div>
                                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Number(visualSummary?.efficiency) || 0)}%` }}></div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3.5">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Sobra estimada</div>
                                            <div className="mt-1.5 flex items-baseline gap-1">
                                                <span className="text-[22px] font-black leading-none tabular-nums text-amber-600 dark:text-amber-300">{visualSummary?.wastePercent}</span>
                                                <span className="text-[11px] font-semibold text-amber-600/70 dark:text-amber-300/70">%</span>
                                            </div>
                                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, Number(visualSummary?.wastePercent) || 0)}%` }}></div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3.5">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Peças no mapa</div>
                                            <div className="mt-1.5 flex items-baseline gap-1">
                                                <span className="text-[22px] font-black leading-none tabular-nums text-slate-900 dark:text-white">{visualSummary?.pieces}</span>
                                                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">itens</span>
                                            </div>
                                            {unplacedCount > 0 && (
                                                <div className="mt-1.5 text-[10px] font-bold text-red-600 dark:text-red-400">{unplacedCount} fora do plano</div>
                                            )}
                                        </div>
                                        {activeFilmMaterialCostText && (
                                            <div className="px-4 py-3.5">
                                                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Custo material</div>
                                                <div className="mt-1.5 truncate text-[20px] font-black leading-none tabular-nums text-slate-900 dark:text-white">{activeFilmMaterialCostText}</div>
                                                <div className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">pelo metro linear da bobina</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Aviso de peças que não couberam na bobina */}
                                {unplacedCount > 0 && visualSummary && (
                                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30 sm:p-4">
                                        <div className="flex items-start gap-2.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400">
                                                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                            </svg>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-red-800 dark:text-red-200">
                                                    {unplacedCount === 1 ? '1 peça ficou fora do plano de corte' : `${unplacedCount} peças ficaram fora do plano de corte`}
                                                </p>
                                                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                                                    {unplacedCount === 1 ? 'Ela é maior' : 'Elas são maiores'} que a largura da bobina ({visualSummary.rollWidthMeters} m) e não {unplacedCount === 1 ? 'foi incluída' : 'foram incluídas'} no metro linear nem no custo de material.
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {unplacedGroups.map(group => (
                                                        <span key={group.key} className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2 py-1 text-[11px] font-bold text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
                                                            {(group.maxSide / 100).toFixed(2).replace('.', ',')} × {(group.minSide / 100).toFixed(2).replace('.', ',')} m
                                                            {group.count > 1 && <span className="font-semibold text-red-600 dark:text-red-300">×{group.count}</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">
                                                    {unplacedGroups.some(g => g.fitsIfRotated)
                                                        ? 'Dica: parte dessas peças caberia girada — desative "Resp. Veio" para permitir a rotação.'
                                                        : 'Dica: use uma bobina mais larga ou divida a medida em duas peças menores (aplicação com emenda).'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Zoom Slider - Desktop only, mobile uses buttons in stats bar */}
                                <div className="relative z-30 hidden sm:flex mb-4 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Zoom</span>
                                    <input
                                        type="range"
                                        min="50"
                                        max="300"
                                        value={zoomLevel * 100}
                                        onChange={(e) => setZoomLevel(parseInt(e.target.value) / 100)}
                                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                                        style={{
                                            background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 100%)`
                                        }}
                                    />
                                    <span className="min-w-[45px] text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">{Math.round(zoomLevel * 100)}%</span>
                                    <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700"></div>
                                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                                            Livre
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
                                            Selecionado
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-red-400"></span>
                                            Travado
                                        </span>
                                    </div>
                                    {/* Botão Expandir - Desktop */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            openFullscreenView();
                                        }}
                                        className="relative z-20 shrink-0 pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors touch-manipulation hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                                        title="Expandir tela cheia"
                                    >
                                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>Expandir</span>
                                    </button>
                                </div>

                                {/* Drawing - Container com virtualização */}
                                <div
                                    ref={scrollContainerRef}
                                    onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                                    className="relative max-h-[72vh] min-h-[430px] overflow-auto rounded-xl border border-slate-300 bg-[radial-gradient(circle_at_top_left,rgba(226,232,240,0.9),rgba(248,250,252,1)_42%,rgba(226,232,240,0.85))] px-4 pb-24 text-left shadow-inner dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.95),rgba(2,6,23,1)_48%,rgba(15,23,42,0.95))] sm:max-h-[70vh] sm:min-h-[400px] sm:px-6"
                                >
                                    <div className="pointer-events-none relative mb-20 ml-[72px] mr-12 mt-24 inline-block sm:mb-24 sm:ml-[88px] sm:mr-16 sm:mt-28" style={{ textAlign: 'initial' }}>

                                        {/* Horizontal Ruler (Top) */}
                                        <div className="absolute left-0 top-[-70px] h-[70px] w-full overflow-visible rounded-t-md border-b border-slate-300 bg-white/35 dark:border-slate-700 dark:bg-slate-950/25">
                                            <div className="absolute inset-x-0 bottom-0 h-[3px] opacity-70" style={createHorizontalTickStyle(scale, 1, 'rgba(148, 163, 184, 0.35)')}></div>
                                            <div className="absolute inset-x-0 bottom-0 h-[6px] opacity-90" style={createHorizontalTickStyle(scale, 5, 'rgba(100, 116, 139, 0.5)')}></div>
                                            <div className="absolute inset-x-0 bottom-0 h-[10px]" style={createHorizontalTickStyle(scale, 10, 'rgba(71, 85, 105, 0.7)')}></div>
                                            {horizontalRulerLabels.map((val) => (
                                                <span
                                                    key={val}
                                                    className="absolute top-[34px] rounded-md border border-slate-200/80 bg-white/95 px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-200"
                                                    style={getHorizontalLabelStyle(val, scale, result.rollWidth)}
                                                >
                                                    {formatRulerLabel(val)}
                                                </span>
                                            ))}
                                            {/* Cota da largura da bobina */}
                                            {result.rollWidth > 0 && (
                                                <div className="absolute left-0 top-[6px] z-20" style={{ width: `${result.rollWidth * scale}px` }}>
                                                    {renderWidthDimension((result.rollWidth / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'Bobina')}
                                                </div>
                                            )}
                                        </div>

                                        {/* Vertical Ruler (Left) */}
                                        <div className="absolute left-[-56px] top-0 h-full w-[56px] overflow-visible rounded-l-md border-r border-slate-300 bg-white/35 dark:border-slate-700 dark:bg-slate-950/25">
                                            <div className="absolute top-0 bottom-0 right-0 w-[3px] opacity-70" style={createVerticalTickStyle(scale, 1, 'rgba(148, 163, 184, 0.35)')}></div>
                                            <div className="absolute top-0 bottom-0 right-0 w-[6px] opacity-90" style={createVerticalTickStyle(scale, 5, 'rgba(100, 116, 139, 0.5)')}></div>
                                            <div className="absolute top-0 bottom-0 right-0 w-[10px]" style={createVerticalTickStyle(scale, 10, 'rgba(71, 85, 105, 0.7)')}></div>
                                            {verticalRulerLabels.map((val) => (
                                                <span
                                                    key={val}
                                                    className="absolute right-[18px] rounded-md border border-slate-200/80 bg-white/95 px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-200"
                                                    style={getVerticalLabelStyle(val, scale, result.totalHeight)}
                                                >
                                                    {formatRulerLabel(val)}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Cota do comprimento total (lado direito do mapa) */}
                                        {result.totalHeight > 0 && (
                                            <div className="absolute top-0 z-20" style={{ right: '-32px', height: `${result.totalHeight * scale}px` }}>
                                                {renderLengthDimension((result.totalHeight / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'Compr.')}
                                            </div>
                                        )}

                                        {/* Roll Background & Grid */}
                                        <div
                                            className="relative overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/70"
                                            style={{
                                                width: `${result.rollWidth * scale}px`,
                                                height: `${result.totalHeight * scale}px`,
                                                backgroundImage: `
                                            linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(16, 185, 129, 0.04)),
                                            linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(148, 163, 184, 0.075) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.075) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
                                        `,
                                                backgroundSize: `
                                            100% 100%,
                                            ${10 * scale}px ${10 * scale}px,
                                            ${10 * scale}px ${10 * scale}px,
                                            ${5 * scale}px ${5 * scale}px,
                                            ${5 * scale}px ${5 * scale}px,
                                            ${1 * scale}px ${1 * scale}px,
                                            ${1 * scale}px ${1 * scale}px
                                        `,
                                                backgroundPosition: '-1px -1px' // Align grid lines
                                            }}
                                        >
                                            {/* 
                                     * Blade width (sangria) is calculated in the optimization algorithm 
                                     * but visual rendering was removed for a cleaner interface.
                                     * The spacing is still applied between pieces during calculation.
                                     */}

                                            {/* Items - Virtualizados: apenas peças visíveis são renderizadas */}
                                            {visibleItems.map((item) => {
                                                const pieceId = getPieceId(item);
                                                const pieceGroupKey = getPieceGroupKey(item);
                                                const isSelected = selectedPieceId === pieceId;
                                                const isGroupHighlighted = selectedGroupKey === pieceGroupKey;
                                                const isLocked = lockedItems[item.id!];
                                                const pieceScaledWidth = item.w * scale;
                                                const pieceScaledHeight = item.h * scale;
                                                const showDimensionLabels = pieceScaledWidth > 34 && pieceScaledHeight > 34;
                                                // Encontrar índice original para exibição
                                                const originalIndex = result.placedItems.findIndex(p => p.id === item.id);

                                                return (
                                                    <div
                                                        key={item.id || originalIndex}
                                                        onClick={() => togglePieceSelection(item)}
                                                        className={`pointer-events-auto absolute isolate flex items-center justify-center overflow-visible rounded-[3px] text-xs font-bold border transition-all cursor-pointer backdrop-blur-[1px] ${isSelected
                                                            ? 'z-20 shadow-[0_0_0_2px_rgba(250,204,21,0.35),0_12px_28px_rgba(15,23,42,0.28)] scale-[1.01]'
                                                            : isGroupHighlighted
                                                                ? 'z-10 shadow-[0_0_0_2px_rgba(103,232,249,0.34),0_14px_30px_rgba(8,145,178,0.26)]'
                                                            : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:z-10 hover:shadow-[0_10px_24px_rgba(14,165,233,0.22)]'
                                                            }`}
                                                        style={{
                                                            left: `${item.x * scale}px`,
                                                            top: `${item.y * scale}px`,
                                                            width: `${item.w * scale}px`,
                                                            height: `${item.h * scale}px`,
                                                            background: isSelected
                                                                ? 'linear-gradient(135deg, rgba(254, 240, 138, 0.72), rgba(251, 191, 36, 0.42))'
                                                                : isLocked
                                                                    ? 'linear-gradient(135deg, rgba(248, 113, 113, 0.36), rgba(239, 68, 68, 0.18))'
                                                                    : isGroupHighlighted
                                                                        ? 'linear-gradient(135deg, rgba(103, 232, 249, 0.58), rgba(14, 165, 233, 0.26))'
                                                                    : 'linear-gradient(135deg, rgba(125, 211, 252, 0.42), rgba(14, 165, 233, 0.18))',
                                                            borderColor: isSelected
                                                                ? 'rgba(250, 204, 21, 0.9)' // Yellow border
                                                                : isLocked
                                                                    ? 'rgba(239, 68, 68, 0.6)' // Red border for locked
                                                                    : isGroupHighlighted
                                                                        ? 'rgba(103, 232, 249, 0.95)'
                                                                    : 'rgba(14, 165, 233, 0.75)', // Sky-500 default
                                                            color: 'rgba(15, 23, 42, 0.88)'
                                                        }}
                                                        title={`#${originalIndex + 1}: ${item.label} (${item.w.toFixed(1)} x ${item.h.toFixed(1)}) - Clique para selecionar`}
                                                    >
                                                        {/* Large Watermark ID */}
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[3px] font-black pointer-events-none select-none"
                                                            style={{
                                                                fontSize: `${Math.min(item.w, item.h) * scale * 0.6}px`,
                                                                color: isSelected ? 'rgba(120, 53, 15, 0.2)' : isGroupHighlighted ? 'rgba(8, 47, 73, 0.18)' : 'rgba(15, 23, 42, 0.14)'
                                                            }}
                                                        >
                                                            {originalIndex + 1}
                                                        </div>

                                                        {/* Dimensions - Only show if piece is big enough */}
                                                        {showDimensionLabels && (
                                                            <>
                                                                {/* Width Label (Bottom Right inside) */}
                                                                <div className={`absolute bottom-1 right-1.5 z-20 rounded-md border px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums shadow-sm backdrop-blur sm:text-xs ${isSelected ? 'border-yellow-200/70 bg-yellow-50/95 text-yellow-950' : 'border-white/60 bg-white/90 text-slate-900'}`}>
                                                                    {(item.w / 100).toFixed(2)}
                                                                </div>

                                                                {/* Height Label (Left inside) */}
                                                                <div className="absolute left-1 top-0 z-20 flex h-full items-center">
                                                                    <span className={`origin-center -rotate-90 rounded-md border px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums shadow-sm backdrop-blur sm:text-xs ${isSelected ? 'border-yellow-200/70 bg-yellow-50/95 text-yellow-950' : 'border-white/60 bg-white/90 text-slate-900'}`}>
                                                                        {(item.h / 100).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}

                                                        {/* Rotated indicator (small icon when rotated) */}
                                                        {item.rotated && !isSelected && (
                                                            <div className="absolute top-1 right-1 opacity-60">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-sky-400">
                                                                    <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {/* Locked indicator (small icon when locked but not selected) */}
                                                        {isLocked && !isSelected && (
                                                            <div className="absolute top-1 left-1 opacity-80">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-red-400">
                                                                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {/* Action Buttons - INSIDE the piece, always visible */}
                                                        {isSelected && (() => {
                                                            // Calculate minimum button scale to ensure readability
                                                            const pieceScaledWidth = item.w * scale;
                                                            const pieceScaledHeight = item.h * scale;
                                                            const minButtonSize = 60; // Minimum total width needed for buttons

                                                            // Determine if we need to scale buttons up for small pieces
                                                            const needsLargerButtons = pieceScaledWidth < minButtonSize || pieceScaledHeight < 40;

                                                            return (
                                                                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                                                    <div className={`flex gap-1 pointer-events-auto ${needsLargerButtons ? 'scale-75' : ''}`}>
                                                                        {/* Rotate Button */}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (item.id) {
                                                                                    if (item.h > result.rollWidth) {
                                                                                        setWarningMessage(`Não é possível girar esta peça. A dimensão de ${(item.h / 100).toFixed(2)}m é maior que a largura da bobina (${(result.rollWidth / 100).toFixed(2)}m).`);
                                                                                        return;
                                                                                    }
                                                                                    const currentRotated = item.rotated || false;
                                                                                    setManualRotations(prev => ({
                                                                                        ...prev,
                                                                                        [item.id!]: !currentRotated
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            className="flex items-center justify-center w-8 h-8 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-full shadow-lg transition-colors"
                                                                            title="Girar peça 90°"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                                                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-1.373-7.227a.75.75 0 00.75-.75V1.206a.75.75 0 00-1.5 0v2.432l-.31-.31A7 7 0 001.166 6.466a.75.75 0 001.45.388 5.5 5.5 0 019.201-2.466l.312.31H9.696a.75.75 0 000 1.5h4.242z" clipRule="evenodd" />
                                                                            </svg>
                                                                        </button>

                                                                        {/* Lock/Unlock Button */}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (item.id) {
                                                                                    setLockedItems(prev => {
                                                                                        const newLocked = { ...prev };
                                                                                        if (newLocked[item.id!]) {
                                                                                            delete newLocked[item.id!];
                                                                                        } else {
                                                                                            newLocked[item.id!] = { ...item, locked: true };
                                                                                        }
                                                                                        return newLocked;
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className={`flex items-center justify-center w-8 h-8 text-white rounded-full shadow-lg transition-colors ${isLocked
                                                                                ? 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                                                                                : 'bg-slate-600 hover:bg-slate-500 active:bg-slate-700'
                                                                                }`}
                                                                            title={isLocked ? "Destravar peça" : "Travar posição"}
                                                                        >
                                                                            {isLocked ? (
                                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                                                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                                                                                </svg>
                                                                            ) : (
                                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                                                    <path fillRule="evenodd" d="M14.5 1A4.5 4.5 0 0010 5.5V9H3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1.5V5.5a3 3 0 116 0v2.75a.75.75 0 001.5 0V5.5A4.5 4.5 0 0014.5 1z" clipRule="evenodd" />
                                                                                </svg>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Legend Table */}
                                <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-50/90 dark:bg-slate-950/40">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600 dark:text-blue-400">
                                            <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                        </svg>
                                        Lista de Cortes
                                        <span className="ml-auto text-[11px] font-semibold normal-case text-slate-400 dark:text-slate-500">
                                            {groupedItems.length} {groupedItems.length === 1 ? 'grupo' : 'grupos'} · {result.placedItems.length} {result.placedItems.length === 1 ? 'peça' : 'peças'}
                                        </span>
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium">
                                                <tr>
                                                    <th className="p-3 text-left border-b border-slate-200 dark:border-slate-700">Dimensões (L x A)</th>
                                                    <th className="p-3 text-center border-b border-slate-200 dark:border-slate-700">Quantidade</th>
                                                    <th className="p-3 text-left border-b border-slate-200 dark:border-slate-700">Índices no Mapa</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {groupedItems.map((group) => {
                                                    const isGroupSelected = selectedGroupKey === group.key;

                                                    return (
                                                        <tr
                                                            key={group.key}
                                                            tabIndex={0}
                                                            onClick={() => {
                                                                if (isGroupSelected) {
                                                                    setSelectedGroupKey(null);
                                                                    setSelectedPieceId(null);
                                                                    return;
                                                                }

                                                                const firstPiece = result.placedItems[group.indices[0] - 1];
                                                                setSelectedGroupKey(group.key);
                                                                setSelectedPieceId(firstPiece ? getPieceId(firstPiece) : null);
                                                            }}
                                                            onKeyDown={(event) => {
                                                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                                                event.preventDefault();
                                                                event.currentTarget.click();
                                                            }}
                                                            className={`cursor-pointer transition-colors ${isGroupSelected
                                                                ? 'bg-cyan-50/90 shadow-[inset_3px_0_0_rgba(6,182,212,0.95)] dark:bg-cyan-950/35'
                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                                                }`}
                                                        >
                                                            <td className="p-3">
                                                                <div className="font-mono font-black text-slate-800 dark:text-slate-100">
                                                                    {(group.w / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x {(group.h / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                                                                </div>
                                                                <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                                    {group.areaM2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² no grupo
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className={`inline-flex min-w-9 items-center justify-center rounded-full border px-2.5 py-1 text-sm font-black ${isGroupSelected
                                                                    ? 'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-100'
                                                                    : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                                                                    }`}>
                                                                    {group.count}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {group.indices.map(i => (
                                                                        <span key={i} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs font-black ${isGroupSelected
                                                                            ? 'border-cyan-300 bg-white text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-100'
                                                                            : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                                            }`}>
                                                                            {i}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delete Confirmation Modal */}
                        <ConfirmationModal
                            isOpen={!!historyToDelete}
                            onClose={() => setHistoryToDelete(null)}
                            onConfirm={handleDeleteHistory}
                            title="Excluir Versão"
                            message="Tem certeza que deseja excluir esta versão do histórico? Esta ação não pode ser desfeita."
                            confirmButtonText="Excluir"
                            confirmButtonVariant="danger"
                        />

                        {/* Warning Modal */}
                        <Modal
                            isOpen={!!warningMessage}
                            onClose={() => setWarningMessage(null)}
                            title="Atenção"
                            footer={
                                <button
                                    onClick={() => setWarningMessage(null)}
                                    className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                                >
                                    Entendi
                                </button>
                            }
                        >
                            <div className="text-slate-600 flex items-start gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-amber-500 flex-shrink-0">
                                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                </svg>
                                <span>{warningMessage}</span>
                            </div>
                        </Modal>

                        {/* Fullscreen Modal */}
                        {isFullscreen && result && createPortal(
                            <div
                                role="dialog"
                                aria-modal="true"
                                aria-label={`Mesa de corte expandida - ${activeFilm}`}
                                className="flex flex-col relative overflow-hidden bg-slate-100 dark:bg-slate-950"
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                    zIndex: 99999,
                                }}
                            >
                                {/* Barra de controles tecnica */}
                                <div className="z-30 grid grid-cols-1 gap-2 border-b border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 xl:grid-cols-[minmax(240px,1fr)_auto_minmax(300px,1fr)_auto] xl:items-center">
                                    {/* Zoom Controls */}
                                    <div className="flex min-w-0 items-center justify-between gap-3 xl:w-auto">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                                                <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_0_3px_rgba(6,182,212,0.16)]"></span>
                                                Plano de corte
                                            </div>
                                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                                                <span className="truncate text-[15px] font-black text-slate-950 dark:text-white">{activeFilm}</span>
                                                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                                    {fullscreenOrientation === 'landscape' ? 'Horizontal' : 'Vertical'}
                                                </span>
                                                <span className="hidden shrink-0 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 sm:inline-flex">{fullscreenAxisWidthMeters} x {fullscreenAxisHeightMeters} m</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsFullscreen(false)}
                                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 xl:hidden"
                                            title="Fechar"
                                        >
                                            <X className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                    </div>
                                    <div className="order-3 flex w-full items-stretch gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/95 p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 xl:order-none xl:w-auto xl:justify-center">
                                        <div className="min-w-[96px] rounded-lg bg-white px-3 py-1.5 dark:bg-slate-800/90">
                                            <div className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Metro linear</div>
                                            <div className="mt-0.5 flex items-baseline gap-1">
                                                <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-slate-100">{fullscreenLinearMeters}</span>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">m</span>
                                            </div>
                                        </div>
                                        {activeFilmMaterialCostText && (
                                            <div className="min-w-[118px] rounded-lg border border-emerald-500/20 bg-emerald-50 px-3 py-1.5 dark:bg-emerald-950/35">
                                                <div className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">Material</div>
                                                <div className="mt-0.5 text-[15px] font-black tabular-nums text-emerald-800 dark:text-emerald-200">{activeFilmMaterialCostText}</div>
                                            </div>
                                        )}
                                        <div className="min-w-[74px] rounded-lg bg-white px-3 py-1.5 dark:bg-slate-800/90">
                                            <div className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Uso</div>
                                            <div className="mt-0.5 flex items-baseline gap-1">
                                                <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-slate-100">{fullscreenUsage}</span>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">%</span>
                                            </div>
                                        </div>
                                        <div className="min-w-[76px] rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-1.5 dark:bg-amber-950/35">
                                            <div className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">Sobra</div>
                                            <div className="mt-0.5 flex items-baseline gap-1">
                                                <span className="text-[15px] font-black tabular-nums text-amber-800 dark:text-amber-200">{fullscreenWaste}</span>
                                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">%</span>
                                            </div>
                                        </div>
                                        <div className="min-w-[76px] rounded-lg bg-white px-3 py-1.5 dark:bg-slate-800/90">
                                            <div className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Peças</div>
                                            <div className="mt-0.5 flex items-baseline gap-1">
                                                <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-slate-100">{fullscreenPieces}</span>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">pçs</span>
                                            </div>
                                        </div>
                                        <div className="min-w-[86px] rounded-lg bg-white px-3 py-1.5 dark:bg-slate-800/90">
                                            <div className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Bobina</div>
                                            <div className="mt-0.5 flex items-baseline gap-1">
                                                <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-slate-100">{fullscreenAxisWidthMeters}</span>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">m</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="order-2 flex min-w-0 flex-wrap items-center justify-start gap-2 xl:order-none xl:justify-end">
                                        <div className="inline-flex h-10 shrink-0 items-center overflow-hidden rounded-lg border border-slate-300/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                            <button
                                                onClick={() => setFullscreenZoom(prev => Math.max(0.25, prev - 0.25))}
                                                className="flex h-10 w-10 items-center justify-center border-r border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                                                title="Diminuir zoom"
                                            >
                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                            <span className="flex h-10 min-w-[68px] items-center justify-center bg-slate-950 px-3 text-sm font-black tabular-nums text-white dark:bg-white dark:text-slate-950">{Math.round(fullscreenZoom * 100)}%</span>
                                            <button
                                                onClick={() => setFullscreenZoom(prev => Math.min(5, prev + 0.25))}
                                                className="flex h-10 w-10 items-center justify-center border-l border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                                                title="Aumentar zoom"
                                            >
                                                <Plus className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setFullscreenZoom(1)}
                                            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                            title="Resetar zoom"
                                        >
                                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                            <span className="hidden 2xl:inline">Reset</span>
                                        </button>
                                        <button
                                            onClick={() => setFullscreenOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
                                            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                            aria-label={fullscreenOrientation === 'portrait' ? 'Ver mesa na horizontal' : 'Ver mesa na vertical'}
                                            title={fullscreenOrientation === 'portrait' ? 'Ver mesa na horizontal' : 'Ver mesa na vertical'}
                                        >
                                            <Maximize2 className="h-4 w-4" aria-hidden="true" />
                                            <span className="hidden 2xl:inline">{fullscreenOrientation === 'portrait' ? 'Horizontal' : 'Vertical'}</span>
                                        </button>
                                    </div>
                                    {/* Close Button */}
                                    <button
                                        onClick={() => setIsFullscreen(false)}
                                        className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 xl:inline-flex"
                                        title="Fechar"
                                    >
                                        <X className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </div>
                                {/* Fullscreen Content */}
                                <div
                                    ref={fullscreenScrollRef}
                                    data-testid="fullscreen-cutting-scroll"
                                    className="flex-1 overflow-auto p-3 bg-[radial-gradient(circle_at_18%_0%,rgba(219,234,254,0.95),rgba(248,250,252,1)_42%,rgba(226,232,240,0.9))] dark:bg-[radial-gradient(circle_at_18%_0%,rgba(30,41,59,0.92),rgba(2,6,23,1)_48%,rgba(15,23,42,0.96))]"
                                    onWheel={handleFullscreenWheel}
                                    style={{ overscrollBehavior: 'contain' }}
                                >
                                    <div
                                        className="min-w-max min-h-full flex items-start justify-start"
                                        style={{
                                            paddingLeft: fullscreenOrientation === 'landscape' ? '72px' : '56px',
                                            paddingRight: fullscreenOrientation === 'landscape' ? '240px' : '72px',
                                            paddingBottom: fullscreenOrientation === 'landscape' ? '96px' : '96px',
                                        }}
                                    >
                                        <div
                                            ref={fullscreenContentRef}
                                            className="inline-block relative mt-4 mb-14 rounded-lg"
                                            style={{ marginLeft: '72px', marginTop: '84px', marginBottom: '72px' }}
                                        >

                                        {/* Horizontal Ruler (Top) - Fullscreen */}
                                        <div className="absolute left-0 right-0 h-[72px] overflow-visible rounded-t-md border-b border-slate-300/80 bg-white/50 dark:border-slate-700 dark:bg-slate-950/25" style={{ top: '-72px' }}>
                                            <div className="absolute inset-x-0 bottom-0 h-[3px] opacity-70" style={createHorizontalTickStyle(fullscreenScale, 1, 'rgba(59, 130, 246, 0.24)')}></div>
                                            <div className="absolute inset-x-0 bottom-0 h-[6px] opacity-90" style={createHorizontalTickStyle(fullscreenScale, 5, 'rgba(37, 99, 235, 0.34)')}></div>
                                            <div className="absolute inset-x-0 bottom-0 h-[10px]" style={createHorizontalTickStyle(fullscreenScale, 10, 'rgba(15, 23, 42, 0.48)')}></div>
                                            {fullscreenHorizontalRulerLabels.map((val) => (
                                                <span
                                                    key={val}
                                                    className="absolute top-[34px] rounded-md border border-slate-200/80 bg-white/95 px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-200"
                                                    style={getHorizontalLabelStyle(val, fullscreenScale, fullscreenAxisWidth)}
                                                >
                                                    {formatRulerLabel(val)}
                                                </span>
                                            ))}
                                            {/* Cota do eixo horizontal (bobina em retrato, comprimento em paisagem) */}
                                            {fullscreenAxisWidth > 0 && (
                                                <div className="absolute left-0 top-[6px] z-20" style={{ width: `${fullscreenAxisWidth * fullscreenScale}px` }}>
                                                    {renderWidthDimension(fullscreenAxisWidthMeters, fullscreenOrientation === 'landscape' ? 'Compr.' : 'Bobina')}
                                                </div>
                                            )}
                                        </div>

                                        {/* Vertical Ruler (Left) - Fullscreen */}
                                        <div className="absolute top-0 bottom-0 w-[58px] overflow-visible rounded-l-md border-r border-slate-300/80 bg-white/50 dark:border-slate-700 dark:bg-slate-950/25" style={{ left: '-58px' }}>
                                            <div className="absolute top-0 bottom-0 right-0 w-[3px] opacity-70" style={createVerticalTickStyle(fullscreenScale, 1, 'rgba(59, 130, 246, 0.24)')}></div>
                                            <div className="absolute top-0 bottom-0 right-0 w-[6px] opacity-90" style={createVerticalTickStyle(fullscreenScale, 5, 'rgba(37, 99, 235, 0.34)')}></div>
                                            <div className="absolute top-0 bottom-0 right-0 w-[10px]" style={createVerticalTickStyle(fullscreenScale, 10, 'rgba(15, 23, 42, 0.48)')}></div>
                                            {fullscreenVerticalRulerLabels.map((val) => (
                                                <span
                                                    key={val}
                                                    className="absolute right-[18px] rounded-md border border-slate-200/80 bg-white/95 px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-200"
                                                    style={getVerticalLabelStyle(val, fullscreenScale, fullscreenAxisHeight)}
                                                >
                                                    {formatRulerLabel(val)}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Cota do eixo vertical (comprimento em retrato, bobina em paisagem) */}
                                        {fullscreenAxisHeight > 0 && (
                                            <div className="absolute top-0 z-20" style={{ right: '-36px', height: `${fullscreenAxisHeight * fullscreenScale}px` }}>
                                                {renderLengthDimension(fullscreenAxisHeightMeters, fullscreenOrientation === 'landscape' ? 'Bobina' : 'Compr.')}
                                            </div>
                                        )}

                                        {/* Fullscreen Roll Drawing */}
                                        <div
                                            data-testid="fullscreen-cutting-roll"
                                            className="relative overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-900/70"
                                            style={{
                                                width: `${fullscreenAxisWidth * fullscreenScale}px`,
                                                height: `${fullscreenAxisHeight * fullscreenScale}px`,
                                                backgroundImage: `
                                            linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(16, 185, 129, 0.04)),
                                            linear-gradient(to right, rgba(14, 165, 233, 0.12) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(14, 165, 233, 0.12) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(100, 116, 139, 0.08) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(100, 116, 139, 0.08) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(148, 163, 184, 0.045) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.045) 1px, transparent 1px)
                                        `,
                                                backgroundSize: `
                                            100% 100%,
                                            ${10 * fullscreenScale}px ${10 * fullscreenScale}px,
                                            ${10 * fullscreenScale}px ${10 * fullscreenScale}px,
                                            ${5 * fullscreenScale}px ${5 * fullscreenScale}px,
                                            ${5 * fullscreenScale}px ${5 * fullscreenScale}px,
                                            ${1 * fullscreenScale}px ${1 * fullscreenScale}px,
                                            ${1 * fullscreenScale}px ${1 * fullscreenScale}px
                                        `,
                                                backgroundPosition: '-1px -1px'
                                            }}
                                        >
                                            {/* Items */}
                                            {result.placedItems.map((item, idx) => {
                                                const itemFrame = getFullscreenItemFrame(item);
                                                const pieceId = getPieceId(item);
                                                const pieceGroupKey = getPieceGroupKey(item);
                                                const isSelected = selectedPieceId === pieceId;
                                                const isGroupHighlighted = selectedGroupKey === pieceGroupKey;
                                                const isLocked = lockedItems[item.id!];
                                                const pieceScaledWidth = (fullscreenOrientation === 'landscape' ? item.h : item.w) * fullscreenScale;
                                                const pieceScaledHeight = (fullscreenOrientation === 'landscape' ? item.w : item.h) * fullscreenScale;
                                                const showDimensionLabels = pieceScaledWidth > 34 && pieceScaledHeight > 34;
                                                const needsLargerButtons = pieceScaledWidth < 72 || pieceScaledHeight < 48;

                                                return (
                                                    <div
                                                        key={item.id || idx}
                                                        onClick={() => togglePieceSelection(item)}
                                                        className={`absolute isolate flex items-center justify-center overflow-visible rounded-[3px] text-xs font-bold border transition-all cursor-pointer backdrop-blur-[1px] ${isSelected
                                                            ? 'z-20 shadow-[0_0_0_2px_rgba(250,204,21,0.35),0_16px_34px_rgba(15,23,42,0.3)] scale-[1.01]'
                                                            : isGroupHighlighted
                                                                ? 'z-10 shadow-[0_0_0_2px_rgba(103,232,249,0.34),0_16px_34px_rgba(8,145,178,0.3)]'
                                                            : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:z-10 hover:shadow-[0_12px_28px_rgba(14,165,233,0.22)]'
                                                            }`}
                                                        style={{
                                                            left: itemFrame.left,
                                                            top: itemFrame.top,
                                                            width: itemFrame.width,
                                                            height: itemFrame.height,
                                                            background: isSelected
                                                                ? 'linear-gradient(135deg, rgba(254, 240, 138, 0.74), rgba(251, 191, 36, 0.46))'
                                                                : isLocked
                                                                    ? 'linear-gradient(135deg, rgba(248, 113, 113, 0.38), rgba(239, 68, 68, 0.2))'
                                                                    : isGroupHighlighted
                                                                        ? 'linear-gradient(135deg, rgba(103, 232, 249, 0.58), rgba(14, 165, 233, 0.26))'
                                                                    : 'linear-gradient(135deg, rgba(125, 211, 252, 0.42), rgba(14, 165, 233, 0.18))',
                                                            borderColor: isSelected
                                                                ? 'rgba(250, 204, 21, 0.85)'
                                                                : isLocked
                                                                    ? 'rgba(239, 68, 68, 0.6)'
                                                                    : isGroupHighlighted
                                                                        ? 'rgba(103, 232, 249, 0.95)'
                                                                    : 'rgba(14, 165, 233, 0.72)',
                                                            color: 'rgba(15, 23, 42, 0.88)'
                                                        }}
                                                        title={`#${idx + 1}: ${item.label} (${item.w.toFixed(1)} x ${item.h.toFixed(1)}) - Clique para selecionar`}
                                                    >
                                                        {/* Large Watermark ID */}
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[3px] font-black pointer-events-none select-none"
                                                            style={{
                                                                fontSize: `${Math.min(item.w, item.h) * fullscreenScale * 0.5}px`,
                                                                color: isSelected ? 'rgba(120, 53, 15, 0.2)' : isGroupHighlighted ? 'rgba(8, 47, 73, 0.18)' : 'rgba(15, 23, 42, 0.12)'
                                                            }}
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                        {/* Dimensions */}
                                                        {showDimensionLabels && (
                                                            <>
                                                                <div className={`absolute bottom-1.5 right-1.5 z-20 rounded-md border px-1.5 py-1 text-[11px] font-black leading-none tabular-nums shadow-sm backdrop-blur ${isSelected ? 'border-yellow-200 bg-yellow-50/95 text-yellow-950' : 'border-white/70 bg-white/90 text-slate-900'}`}>
                                                                    {itemFrame.horizontalLabel}
                                                                </div>
                                                                <div className="absolute left-1.5 top-0 z-20 flex h-full items-center">
                                                                    <span className={`origin-center -rotate-90 rounded-md border px-1.5 py-1 text-[11px] font-black leading-none tabular-nums shadow-sm backdrop-blur ${isSelected ? 'border-yellow-200 bg-yellow-50/95 text-yellow-950' : 'border-white/70 bg-white/90 text-slate-900'}`}>
                                                                        {itemFrame.verticalLabel}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}

                                                        {item.rotated && !isSelected && (
                                                            <div className="absolute top-1 right-1 opacity-70">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-sky-400">
                                                                    <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {isLocked && !isSelected && (
                                                            <div className="absolute top-1 left-1 opacity-80">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-400">
                                                                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {isSelected && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                                                <div className={`flex gap-2 pointer-events-auto ${needsLargerButtons ? 'scale-90' : ''}`}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (item.id) {
                                                                                if (item.h > result.rollWidth) {
                                                                                    setWarningMessage(`Não é possível girar esta peça. A dimensão de ${(item.h / 100).toFixed(2)}m é maior que a largura da bobina (${(result.rollWidth / 100).toFixed(2)}m).`);
                                                                                    return;
                                                                                }

                                                                                const currentRotated = item.rotated || false;
                                                                                setManualRotations(prev => ({
                                                                                    ...prev,
                                                                                    [item.id!]: !currentRotated
                                                                                }));
                                                                            }
                                                                        }}
                                                                        className="flex items-center justify-center w-10 h-10 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-full shadow-lg transition-colors"
                                                                        title="Girar peça 90°"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                                            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-1.373-7.227a.75.75 0 00.75-.75V1.206a.75.75 0 00-1.5 0v2.432l-.31-.31A7 7 0 001.166 6.466a.75.75 0 001.45.388 5.5 5.5 0 019.201-2.466l.312.31H9.696a.75.75 0 000 1.5h4.242z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </button>

                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (item.id) {
                                                                                setLockedItems(prev => {
                                                                                    const newLocked = { ...prev };
                                                                                    if (newLocked[item.id!]) {
                                                                                        delete newLocked[item.id!];
                                                                                    } else {
                                                                                        newLocked[item.id!] = { ...item, locked: true };
                                                                                    }
                                                                                    return newLocked;
                                                                                });
                                                                            }
                                                                        }}
                                                                        className={`flex items-center justify-center w-10 h-10 text-white rounded-full shadow-lg transition-colors ${isLocked
                                                                            ? 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                                                                            : 'bg-slate-600 hover:bg-slate-500 active:bg-slate-700'
                                                                            }`}
                                                                        title={isLocked ? 'Destravar peça' : 'Travar posição'}
                                                                    >
                                                                        {isLocked ? (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                                                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                                                <path fillRule="evenodd" d="M14.5 1A4.5 4.5 0 0010 5.5V9H3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1.5V5.5a3 3 0 116 0v2.75a.75.75 0 001.5 0V5.5A4.5 4.5 0 0014.5 1z" clipRule="evenodd" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pointer-events-none absolute bottom-4 right-4 z-40 hidden sm:block">
                                    <div className="pointer-events-auto rounded-xl border border-slate-200/90 bg-white/[0.92] p-2.5 shadow-[0_22px_50px_rgba(15,23,42,0.24)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/[0.88]">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Mapa do rolo</div>
                                                <div className="mt-0.5 text-[11px] font-black tabular-nums text-slate-900 dark:text-white">{fullscreenLinearMeters} m</div>
                                            </div>
                                            <div className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                                                {fullscreenUsage}%
                                            </div>
                                        </div>
                                        <div
                                            className="relative overflow-hidden rounded-md border border-cyan-300/35 bg-slate-950/90 shadow-inner"
                                            style={{
                                                width: `${fullscreenMinimap.width}px`,
                                                height: `${fullscreenMinimap.height}px`,
                                                backgroundImage: `
                                                    linear-gradient(to right, rgba(14,165,233,0.18) 1px, transparent 1px),
                                                    linear-gradient(to bottom, rgba(14,165,233,0.18) 1px, transparent 1px)
                                                `,
                                                backgroundSize: `${10 * fullscreenMinimap.scale}px ${10 * fullscreenMinimap.scale}px`,
                                            }}
                                        >
                                            {result.placedItems.map((item, idx) => {
                                                const isLandscape = fullscreenOrientation === 'landscape';
                                                const pieceId = getPieceId(item);
                                                const pieceGroupKey = getPieceGroupKey(item);
                                                const isMiniActive = selectedPieceId === pieceId || selectedGroupKey === pieceGroupKey;
                                                const miniLeft = (isLandscape ? item.y : item.x) * fullscreenMinimap.scale;
                                                const miniTop = (isLandscape ? item.x : item.y) * fullscreenMinimap.scale;
                                                const miniWidth = Math.max(2, (isLandscape ? item.h : item.w) * fullscreenMinimap.scale);
                                                const miniHeight = Math.max(2, (isLandscape ? item.w : item.h) * fullscreenMinimap.scale);

                                                return (
                                                    <button
                                                        key={item.id || idx}
                                                        type="button"
                                                        onClick={() => togglePieceSelection(item)}
                                                        aria-label={`Selecionar peca ${idx + 1}`}
                                                        className={`absolute rounded-[2px] border transition-colors ${isMiniActive
                                                            ? 'border-yellow-200 bg-yellow-300 shadow-[0_0_0_1px_rgba(250,204,21,0.72)]'
                                                            : 'border-cyan-200/40 bg-cyan-400/40 hover:bg-cyan-300/70'
                                                            }`}
                                                        style={{
                                                            left: `${miniLeft}px`,
                                                            top: `${miniTop}px`,
                                                            width: `${miniWidth}px`,
                                                            height: `${miniHeight}px`,
                                                        }}
                                                        title={`#${idx + 1}: ${(item.w / 100).toFixed(2)} x ${(item.h / 100).toFixed(2)} m`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                            <span>{fullscreenAxisWidthMeters} m bobina</span>
                                            <span>{fullscreenPieces} pecas</span>
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CuttingOptimizationPanel;





