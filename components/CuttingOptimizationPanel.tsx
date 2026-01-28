import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Measurement, Film } from '../types';
import { CuttingOptimizer, OptimizationResult, Rect } from '../utils/CuttingOptimizer';
import ConfirmationModal from './modals/ConfirmationModal';
import Modal from './ui/Modal';
import { useSubscription } from '../contexts/SubscriptionContext';
import { LockedScreen } from './subscription/SubscriptionComponents';

interface CuttingOptimizationPanelProps {
    measurements: Measurement[];
    clientId?: number;
    optionId?: number;
    films: Film[];
}

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
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [fullscreenZoom, setFullscreenZoom] = useState<number>(1);

    // Virtualização: rastrear posição do scroll para renderizar apenas peças visíveis
    const [scrollTop, setScrollTop] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    const availableWidth = Math.max(0, containerWidth - 48);
    const baseScale = result && result.rollWidth > 0 ? availableWidth / result.rollWidth : 2;
    const scale = baseScale * zoomLevel;

    // Virtualização: calcular quais peças estão visíveis na viewport
    const VIEWPORT_HEIGHT = 600; // Altura aproximada da viewport visível
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
        const groups: { [key: string]: { w: number, h: number, count: number, indices: number[] } } = {};

        result.placedItems.forEach((item, index) => {
            const key = `${item.w}x${item.h}`;
            if (!groups[key]) groups[key] = { w: item.w, h: item.h, count: 0, indices: [] };
            groups[key].count++;
            groups[key].indices.push(index + 1);
        });

        return Object.values(groups).sort((a, b) => (b.w * b.h) - (a.w * a.h));
    }, [result]);

    return (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Bloqueio para quem não tem módulo */}
            {!canUseCorteInteligente ? (
                <LockedScreen
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
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Otimizador de Corte
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 font-semibold">BETA</span>
                            </h3>

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
                                        className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeFilm === film
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
                        <div className={`block mb-3 sm:mb-6`}>
                            {/* Mobile: Premium compact layout */}
                            <div className="sm:hidden bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3">
                                {/* Row 1: Inputs with icons */}
                                <div className="flex gap-3 mb-3">
                                    {/* Bobina Field */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1 mb-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-blue-400">
                                                <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z" />
                                                <path d="M3.75 9a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4a5 5 0 015 5v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V15c0-3.866-3.134-7-7-7h-.25z" />
                                                <path d="M7 15a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Bobina</label>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={currentSettings.rollWidth}
                                                onChange={e => updateCurrentSettings('rollWidth', e.target.value)}
                                                placeholder="152"
                                                className="border border-slate-300 dark:border-slate-600/50 bg-white dark:bg-slate-900/80 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full text-sm text-slate-900 dark:text-white font-medium pr-9"
                                            />
                                            <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-medium">cm</span>
                                        </div>
                                    </div>
                                    {/* Sangria Field */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1 mb-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-amber-400">
                                                <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                            </svg>
                                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sangria</label>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={currentSettings.bladeWidth}
                                                onChange={e => updateCurrentSettings('bladeWidth', e.target.value)}
                                                placeholder="0"
                                                className="border border-slate-300 dark:border-slate-600/50 bg-white dark:bg-slate-900/80 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full text-sm text-slate-900 dark:text-white font-medium pr-10"
                                            />
                                            <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-medium">mm</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Divider */}
                                <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600/50 to-transparent mb-3"></div>
                                {/* Row 2: Toggles and Button */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {/* Toggle Veio */}
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <div className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${currentSettings.respectGrain ? 'bg-blue-600 shadow-blue-500/30 shadow-md' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                <div className={`absolute top-0.5 left-0.5 bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 ${currentSettings.respectGrain ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                            </div>
                                            <input type="checkbox" checked={currentSettings.respectGrain} onChange={e => updateCurrentSettings('respectGrain', e.target.checked)} className="hidden" />
                                            <span className={`text-[11px] font-medium transition-colors ${currentSettings.respectGrain ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>Veio</span>
                                        </label>
                                        {/* Toggle Pro */}
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Otimização Profunda">
                                            <div className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${useDeepSearch ? 'bg-purple-600 shadow-purple-500/30 shadow-md' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                <div className={`absolute top-0.5 left-0.5 bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 ${useDeepSearch ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                            </div>
                                            <input type="checkbox" checked={useDeepSearch} onChange={e => setUseDeepSearch(e.target.checked)} className="hidden" />
                                            <span className={`text-[11px] font-medium flex items-center gap-0.5 transition-colors ${useDeepSearch ? 'text-purple-400' : 'text-slate-400'}`}>
                                                Pro<span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded font-bold">β</span>
                                            </span>
                                        </label>
                                    </div>
                                    {/* Button */}
                                    <button
                                        onClick={() => handleOptimize(true)}
                                        disabled={!result || isOptimizing}
                                        className={`bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white px-4 py-2 rounded-lg font-semibold transition-all text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 ${(!result || isOptimizing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isOptimizing ? (
                                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" /></svg>
                                        )}
                                        {isOptimizing ? 'Salvando' : 'Salvar'}
                                    </button>
                                </div>
                            </div>

                            {/* Desktop: Original layout */}
                            <div className="hidden sm:flex sm:flex-wrap gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Largura Bobina (cm)</label>
                                    <input type="number" inputMode="decimal" value={currentSettings.rollWidth} onChange={e => updateCurrentSettings('rollWidth', e.target.value)} placeholder="152" className="border border-slate-300 dark:border-slate-600 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none w-32 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Espaçamento (Corte)</label>
                                    <div className="relative">
                                        <input type="number" inputMode="decimal" value={currentSettings.bladeWidth} onChange={e => updateCurrentSettings('bladeWidth', e.target.value)} placeholder="0" className="border border-slate-300 dark:border-slate-600 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none w-32 pr-8 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                                        <span className="absolute right-2 top-2 text-xs text-slate-400 dark:text-slate-500">mm</span>
                                    </div>
                                </div>
                                <div className="flex items-center h-10">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${currentSettings.respectGrain ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${currentSettings.respectGrain ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <input type="checkbox" checked={currentSettings.respectGrain} onChange={e => updateCurrentSettings('respectGrain', e.target.checked)} className="hidden" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Resp. Veio</span>
                                    </label>
                                </div>
                                <div className="flex items-center h-10">
                                    <label className="flex items-center gap-2 cursor-pointer select-none" title="Otimização Profunda">
                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${useDeepSearch ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${useDeepSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <input type="checkbox" checked={useDeepSearch} onChange={e => setUseDeepSearch(e.target.checked)} className="hidden" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">Otimização Profunda<span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">β</span></span>
                                    </label>
                                </div>
                                <button onClick={() => handleOptimize(true)} disabled={!result || isOptimizing} className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors ml-auto text-sm flex items-center gap-2 ${(!result || isOptimizing) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isOptimizing ? (<><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Otimizando...</span></>) : (<><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" /></svg><span>Gerar Plano de Corte</span></>)}
                                </button>
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
                                <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-6 p-2 sm:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {/* Stats - distributed evenly */}
                                    <div className="flex items-center gap-2 sm:gap-4 flex-1">
                                        <div className="flex items-baseline gap-1 flex-1 justify-center sm:justify-start">
                                            <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{result.totalHeight.toFixed(0)}</span>
                                            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">cm</span>
                                        </div>
                                        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600"></div>
                                        <div className="flex items-baseline gap-1 flex-1 justify-center sm:justify-start">
                                            <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{result.efficiency.toFixed(0)}</span>
                                            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">%</span>
                                        </div>
                                        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600"></div>
                                        <div className="flex items-baseline gap-1 flex-1 justify-center sm:justify-start">
                                            <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{result.placedItems.length}</span>
                                            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">pçs</span>
                                        </div>
                                    </div>
                                    {/* Zoom controls inline on mobile */}
                                    <div className="flex items-center gap-1.5 sm:hidden border-l border-slate-300 dark:border-slate-600 pl-2">
                                        <button
                                            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                                            className="p-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-300"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 min-w-[36px] text-center">{Math.round(zoomLevel * 100)}%</span>
                                        <button
                                            onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                                            className="p-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-300"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                            </svg>
                                        </button>
                                    </div>
                                    {/* Botão Expandir - Mobile */}
                                    <button
                                        onClick={() => {
                                            setFullscreenZoom(1);
                                            setIsFullscreen(true);
                                        }}
                                        className="sm:hidden p-1.5 rounded bg-blue-600 text-white active:bg-blue-700 ml-1"
                                        title="Expandir tela cheia"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM12.22 13.28l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 00-1.06 1.06zM3.5 4.56l3.22 3.22a.75.75 0 001.06-1.06L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0V4.56z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Estimated Cost - Compact */}
                                {(() => {
                                    const film = films.find(f => f.nome === activeFilm);
                                    if (!film || !film.precoMetroLinear) return null;
                                    const cost = (result.totalHeight / 100) * film.precoMetroLinear;
                                    return (
                                        <div className="mb-2 sm:mb-4 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] sm:text-xs text-green-700 dark:text-green-400 font-medium">
                                                    <span className="sm:hidden">Custo Material</span>
                                                    <span className="hidden sm:inline">Custo Estimado de Material</span>
                                                </span>
                                                <span className="font-bold text-green-800 dark:text-green-300 text-sm sm:text-lg">R$ {cost.toFixed(2).replace('.', ',')}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Zoom Slider - Desktop only, mobile uses buttons in stats bar */}
                                <div className="hidden sm:flex mb-4 items-center justify-center gap-3 px-4 w-full max-w-3xl mx-auto">
                                    <input
                                        type="range"
                                        min="50"
                                        max="300"
                                        value={zoomLevel * 100}
                                        onChange={(e) => setZoomLevel(parseInt(e.target.value) / 100)}
                                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600 hover:accent-green-700"
                                        style={{
                                            background: `linear-gradient(to right, #16a34a 0%, #16a34a ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 100%)`
                                        }}
                                    />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[45px] text-center">{Math.round(zoomLevel * 100)}%</span>
                                    {/* Botão Expandir - Desktop */}
                                    <button
                                        onClick={() => {
                                            setFullscreenZoom(1);
                                            setIsFullscreen(true);
                                        }}
                                        className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5"
                                        title="Expandir tela cheia"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM12.22 13.28l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 00-1.06 1.06zM3.5 4.56l3.22 3.22a.75.75 0 001.06-1.06L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0V4.56z" />
                                        </svg>
                                        <span className="text-xs font-medium">Expandir</span>
                                    </button>
                                </div>

                                {/* Drawing - Container com virtualização */}
                                <div
                                    ref={scrollContainerRef}
                                    onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                                    className="relative overflow-auto pb-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-100 dark:bg-slate-950 min-h-[400px] max-h-[70vh] text-center shadow-2xl"
                                >
                                    <div className="inline-block relative m-12" style={{ textAlign: 'initial' }}>

                                        {/* Horizontal Ruler (Top) */}
                                        <div className="absolute top-[-30px] left-0 w-full h-[30px] border-b border-slate-300 dark:border-slate-700">
                                            {Array.from({ length: Math.ceil(result.rollWidth / 10) + 1 }).map((_, i) => {
                                                const val = i * 10;
                                                if (val > result.rollWidth) return null;
                                                const isMajor = true; // Every 10cm is major in this loop
                                                return (
                                                    <div key={val} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${val * scale}px`, transform: 'translateX(-50%)' }}>
                                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">{val === 0 ? '0' : (val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                                                        <div className="h-2 w-px bg-slate-400 dark:bg-slate-500"></div>
                                                    </div>
                                                );
                                            })}
                                            {/* Last Value Marker (if not exact multiple) */}
                                            {result.rollWidth % 10 !== 0 && (
                                                <div className="absolute bottom-0 flex flex-col items-center" style={{ left: `${result.rollWidth * scale}px`, transform: 'translateX(-50%)' }}>
                                                    <span className="text-[10px] font-mono text-cyan-400 font-bold mb-1">{(result.rollWidth / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    <div className="h-3 w-px bg-cyan-500"></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Vertical Ruler (Left) */}
                                        <div className="absolute left-[-35px] top-0 h-full w-[35px] border-r border-slate-300 dark:border-slate-700">
                                            {Array.from({ length: Math.ceil(result.totalHeight / 10) + 1 }).map((_, i) => {
                                                const val = i * 10;
                                                if (val > result.totalHeight) return null;
                                                return (
                                                    <div key={val} className="absolute right-0 flex items-center" style={{ top: `${val * scale}px`, transform: 'translateY(-50%)' }}>
                                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mr-1">{val === 0 ? '0' : (val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                                                        <div className="w-2 h-px bg-slate-400 dark:bg-slate-500"></div>
                                                    </div>
                                                );
                                            })}
                                            {/* Last Height Marker */}
                                            <div className="absolute right-0 flex items-center" style={{ top: `${result.totalHeight * scale}px`, transform: 'translateY(-50%)' }}>
                                                <span className="text-[10px] font-mono text-cyan-400 font-bold mr-1">{(result.totalHeight / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                <div className="w-3 h-px bg-cyan-500"></div>
                                            </div>
                                        </div>

                                        {/* Roll Background & Grid */}
                                        <div
                                            className="relative bg-white dark:bg-slate-900/50 shadow-inner overflow-hidden"
                                            style={{
                                                width: `${result.rollWidth * scale}px`,
                                                height: `${result.totalHeight * scale}px`,
                                                backgroundImage: `
                                            linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
                                        `,
                                                backgroundSize: `
                                            ${10 * scale}px ${10 * scale}px,
                                            ${10 * scale}px ${10 * scale}px,
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
                                                const isSelected = selectedPieceId === item.id;
                                                const isLocked = lockedItems[item.id!];
                                                // Encontrar índice original para exibição
                                                const originalIndex = result.placedItems.findIndex(p => p.id === item.id);

                                                return (
                                                    <div
                                                        key={item.id || originalIndex}
                                                        onClick={() => {
                                                            // Toggle selection
                                                            if (selectedPieceId === item.id) {
                                                                setSelectedPieceId(null);
                                                            } else {
                                                                setSelectedPieceId(item.id || null);
                                                            }
                                                        }}
                                                        className={`absolute flex items-center justify-center text-xs font-bold border-2 transition-all cursor-pointer backdrop-blur-[1px] ${isSelected
                                                            ? 'z-20 shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-[1.02]'
                                                            : 'hover:z-10 hover:shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                                                            }`}
                                                        style={{
                                                            left: `${item.x * scale}px`,
                                                            top: `${item.y * scale}px`,
                                                            width: `${item.w * scale}px`,
                                                            height: `${item.h * scale}px`,
                                                            backgroundColor: isSelected
                                                                ? 'rgba(250, 204, 21, 0.25)' // Yellow for selected
                                                                : isLocked
                                                                    ? 'rgba(239, 68, 68, 0.15)' // Red tint for locked
                                                                    : 'rgba(14, 165, 233, 0.15)', // Sky-500 default
                                                            borderColor: isSelected
                                                                ? 'rgba(250, 204, 21, 0.9)' // Yellow border
                                                                : isLocked
                                                                    ? 'rgba(239, 68, 68, 0.6)' // Red border for locked
                                                                    : 'rgba(56, 189, 248, 0.6)', // Sky-400 default
                                                            color: 'rgba(224, 242, 254, 0.9)'
                                                        }}
                                                        title={`#${originalIndex + 1}: ${item.label} (${item.w.toFixed(1)} x ${item.h.toFixed(1)}) - Clique para selecionar`}
                                                    >
                                                        {/* Large Watermark ID */}
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center font-black pointer-events-none select-none"
                                                            style={{
                                                                fontSize: `${Math.min(item.w, item.h) * scale * 0.6}px`,
                                                                color: isSelected ? 'rgba(250, 204, 21, 0.3)' : 'rgba(255, 255, 255, 0.1)'
                                                            }}
                                                        >
                                                            {originalIndex + 1}
                                                        </div>

                                                        {/* Dimensions - Only show if piece is big enough */}
                                                        {item.w * scale > 40 && item.h * scale > 40 && (
                                                            <>
                                                                {/* Width Label (Bottom Right inside) */}
                                                                <div className={`absolute bottom-1 right-2 text-[10px] sm:text-xs font-mono font-medium px-1 rounded ${isSelected ? 'text-yellow-200 bg-yellow-900/50' : 'text-sky-200 bg-slate-900/40'}`}>
                                                                    {(item.w / 100).toFixed(2)}
                                                                </div>

                                                                {/* Height Label (Left inside) */}
                                                                <div className="absolute left-1 top-0 h-full flex items-center">
                                                                    <span className={`origin-center -rotate-90 text-[10px] sm:text-xs font-mono font-medium px-1 rounded ${isSelected ? 'text-yellow-200 bg-yellow-900/50' : 'text-sky-200 bg-slate-900/40'}`}>
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
                                <div className="mt-8">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600 dark:text-blue-400">
                                            <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                        </svg>
                                        Lista de Cortes
                                    </h4>
                                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium">
                                                <tr>
                                                    <th className="p-3 text-left border-b border-slate-200 dark:border-slate-700">Dimensões (L x A)</th>
                                                    <th className="p-3 text-center border-b border-slate-200 dark:border-slate-700">Quantidade</th>
                                                    <th className="p-3 text-left border-b border-slate-200 dark:border-slate-700">Índices no Mapa</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {groupedItems.map((group, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                                            {group.w.toFixed(1)} x {group.h.toFixed(1)} cm
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-100">
                                                            {group.count}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {group.indices.map(i => (
                                                                    <span key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-600">
                                                                        {i}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
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

                        {/* Fullscreen Modal - Rendered via Portal */}
                        {isFullscreen && result && createPortal(
                            <div className="fixed inset-0 bg-slate-100 dark:bg-slate-950 flex flex-col" style={{ zIndex: 99999 }}>
                                {/* Barra de controles minimalista */}
                                <div className="flex items-center justify-between px-3 py-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                                    {/* Zoom Controls */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setFullscreenZoom(prev => Math.max(0.25, prev - 0.25))}
                                            className="p-2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white active:bg-slate-300 dark:active:bg-slate-600"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <span className="text-sm font-mono text-slate-800 dark:text-white min-w-[50px] text-center">{Math.round(fullscreenZoom * 100)}%</span>
                                        <button
                                            onClick={() => setFullscreenZoom(prev => Math.min(5, prev + 0.25))}
                                            className="p-2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white active:bg-slate-300 dark:active:bg-slate-600"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => setFullscreenZoom(1)}
                                            className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white text-xs active:bg-slate-300 dark:active:bg-slate-600"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    {/* Close Button */}
                                    <button
                                        onClick={() => setIsFullscreen(false)}
                                        className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Fullscreen Content */}
                                <div className="flex-1 overflow-auto flex items-start justify-center p-2">
                                    <div className="inline-block relative my-4" style={{ marginLeft: '40px', marginTop: '35px' }}>

                                        {/* Horizontal Ruler (Top) - Fullscreen */}
                                        <div className="absolute left-0 right-0 h-[30px] border-b border-slate-300 dark:border-slate-700" style={{ top: '-30px' }}>
                                            {(() => {
                                                const fsScale = baseScale * fullscreenZoom;
                                                const step = fullscreenZoom < 0.5 ? 20 : 10;
                                                return Array.from({ length: Math.ceil(result.rollWidth / step) + 1 }).map((_, i) => {
                                                    const val = i * step;
                                                    if (val > result.rollWidth) return null;
                                                    return (
                                                        <div key={val} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${val * fsScale}px`, transform: 'translateX(-50%)' }}>
                                                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">{val === 0 ? '0' : (val / 100).toFixed(1)}</span>
                                                            <div className="h-2 w-px bg-slate-400 dark:bg-slate-500"></div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                            {/* Largura total marker */}
                                            {result.rollWidth % 10 !== 0 && (
                                                <div className="absolute flex flex-col items-center" style={{ left: `${result.rollWidth * baseScale * fullscreenZoom}px`, bottom: '8px', transform: 'translateX(-50%)' }}>
                                                    <span className="text-[9px] font-mono text-cyan-400 font-bold mb-0.5 bg-slate-900/80 px-1 rounded">{(result.rollWidth / 100).toFixed(2)}</span>
                                                    <div className="h-3 w-px bg-cyan-500"></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Vertical Ruler (Left) - Fullscreen */}
                                        <div className="absolute top-0 bottom-0 w-[35px] border-r border-slate-300 dark:border-slate-700" style={{ left: '-35px' }}>
                                            {(() => {
                                                const fsScale = baseScale * fullscreenZoom;
                                                const step = fullscreenZoom < 0.5 ? 20 : 10;
                                                return Array.from({ length: Math.ceil(result.totalHeight / step) + 1 }).map((_, i) => {
                                                    const val = i * step;
                                                    if (val > result.totalHeight) return null;
                                                    return (
                                                        <div key={val} className="absolute right-0 flex items-center" style={{ top: `${val * fsScale}px`, transform: 'translateY(-50%)' }}>
                                                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mr-1">{val === 0 ? '0' : (val / 100).toFixed(1)}</span>
                                                            <div className="w-2 h-px bg-slate-400 dark:bg-slate-500"></div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                            {/* Altura total marker */}
                                            <div className="absolute right-0 flex items-center" style={{ top: `${result.totalHeight * baseScale * fullscreenZoom}px`, transform: 'translateY(-50%)' }}>
                                                <span className="text-[9px] font-mono text-cyan-400 font-bold mr-1">{(result.totalHeight / 100).toFixed(2)}</span>
                                                <div className="w-3 h-px bg-cyan-500"></div>
                                            </div>
                                        </div>

                                        {/* Fullscreen Roll Drawing */}
                                        <div
                                            className="relative bg-white dark:bg-slate-900/50 shadow-inner overflow-hidden border border-slate-200 dark:border-slate-700 rounded"
                                            style={{
                                                width: `${result.rollWidth * baseScale * fullscreenZoom}px`,
                                                height: `${result.totalHeight * baseScale * fullscreenZoom}px`,
                                                backgroundImage: `
                                            linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
                                        `,
                                                backgroundSize: `${10 * baseScale * fullscreenZoom}px ${10 * baseScale * fullscreenZoom}px`
                                            }}
                                        >
                                            {/* Items */}
                                            {result.placedItems.map((item, idx) => {
                                                const fsScale = baseScale * fullscreenZoom;
                                                return (
                                                    <div
                                                        key={item.id || idx}
                                                        className="absolute flex items-center justify-center text-xs font-bold border-2 transition-all"
                                                        style={{
                                                            left: `${item.x * fsScale}px`,
                                                            top: `${item.y * fsScale}px`,
                                                            width: `${item.w * fsScale}px`,
                                                            height: `${item.h * fsScale}px`,
                                                            backgroundColor: 'rgba(14, 165, 233, 0.15)',
                                                            borderColor: 'rgba(56, 189, 248, 0.6)',
                                                            color: 'rgba(224, 242, 254, 0.9)'
                                                        }}
                                                    >
                                                        {/* Large Watermark ID */}
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center font-black pointer-events-none select-none"
                                                            style={{
                                                                fontSize: `${Math.min(item.w, item.h) * fsScale * 0.5}px`,
                                                                color: 'rgba(255, 255, 255, 0.15)'
                                                            }}
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                        {/* Dimensions */}
                                                        {item.w * fsScale > 50 && item.h * fsScale > 50 && (
                                                            <>
                                                                <div className="absolute bottom-1 right-2 text-[11px] font-mono font-medium px-1 rounded text-sky-200 bg-slate-900/60">
                                                                    {(item.w / 100).toFixed(2)}
                                                                </div>
                                                                <div className="absolute left-1 top-0 h-full flex items-center">
                                                                    <span className="origin-center -rotate-90 text-[11px] font-mono font-medium px-1 rounded text-sky-200 bg-slate-900/60">
                                                                        {(item.h / 100).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
