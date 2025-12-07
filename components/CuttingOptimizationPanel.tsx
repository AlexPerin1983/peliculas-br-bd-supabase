import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Measurement, Film } from '../types';
import { CuttingOptimizer, OptimizationResult, Rect } from '../utils/CuttingOptimizer';
import ConfirmationModal from './modals/ConfirmationModal';

interface CuttingOptimizationPanelProps {
    measurements: Measurement[];
    clientId?: number;
    optionId?: number;
    films: Film[];
}

const CuttingOptimizationPanel: React.FC<CuttingOptimizationPanelProps> = ({ measurements, clientId, optionId, films }) => {
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
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
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

    // Storage key for this client/option combination
    const storageKey = clientId && optionId ? `cutting_history_${clientId}_${optionId}` : null;

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
                if (key?.startsWith('cutting_history_')) {
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
            setHistory(prev => [
                {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    result: resultRef.current!,
                    manualRotations: { ...manualRotations },
                    lockedItems: { ...lockedItemsRef.current },
                    methodName: useDeepSearch ? 'Otimização Profunda' : 'Automático',
                    filmName: activeFilm
                },
                ...prev
            ].slice(0, 10));

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
                setHistory(prev => [
                    {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        result: newResult,
                        manualRotations: { ...manualRotations },
                        lockedItems: { ...lockedItemsRef.current },
                        methodName: useDeepSearch ? 'Otimização Profunda' : 'Automático',
                        filmName: activeFilm
                    },
                    ...prev
                ].slice(0, 10)); // Keep last 10
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

    // Calculate dynamic scale
    const availableWidth = Math.max(0, containerWidth - 48);
    const baseScale = result && result.rollWidth > 0 ? availableWidth / result.rollWidth : 2;
    const scale = baseScale * zoomLevel;



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

                {/* Mobile Header (Merged Tabs + Config Icon) */}
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

                    {/* Config Button (Icon Only) */}
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`p-2 rounded-lg transition-colors flex-shrink-0 my-2 ${isSettingsOpen
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        aria-label="Configurar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="p-3 sm:p-6">
                {/* Inputs - Collapsible on mobile */}
                <div className={`${isSettingsOpen ? 'block' : 'hidden'} sm:block mb-4 sm:mb-6`}>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4 items-end">
                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Largura Bobina (cm)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                value={currentSettings.rollWidth}
                                onChange={e => updateCurrentSettings('rollWidth', e.target.value)}
                                placeholder="Largura (cm)"
                                className="border border-slate-300 dark:border-slate-600 p-2.5 sm:p-2 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none w-full sm:w-32 text-base sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Espaçamento (Corte)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={currentSettings.bladeWidth}
                                    onChange={e => updateCurrentSettings('bladeWidth', e.target.value)}
                                    placeholder="0"
                                    className="border border-slate-300 dark:border-slate-600 p-2.5 sm:p-2 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none w-full sm:w-32 pr-8 text-base sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                />
                                <span className="absolute right-3 top-2.5 sm:top-2 text-xs text-slate-400 dark:text-slate-500">mm</span>
                            </div>
                        </div>

                        <div className="col-span-1 flex items-center justify-center sm:justify-start h-12 sm:h-10 pb-0 sm:pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className={`w-10 h-6 sm:w-10 sm:h-6 rounded-full p-1 transition-colors ${currentSettings.respectGrain ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-4 h-4 sm:w-4 sm:h-4 rounded-full shadow-sm transform transition-transform ${currentSettings.respectGrain ? 'translate-x-4 sm:translate-x-4' : 'translate-x-0'}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    checked={currentSettings.respectGrain}
                                    onChange={e => updateCurrentSettings('respectGrain', e.target.checked)}
                                    className="hidden"
                                />
                                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">Resp. Veio</span>
                            </label>
                        </div>

                        <div className="col-span-1 flex items-center justify-center sm:justify-start h-12 sm:h-10 pb-0 sm:pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none" title="Tenta milhares de combinações para encontrar o melhor encaixe (mais lento)">
                                <div className={`w-10 h-6 sm:w-10 sm:h-6 rounded-full p-1 transition-colors ${useDeepSearch ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-4 h-4 sm:w-4 sm:h-4 rounded-full shadow-sm transform transition-transform ${useDeepSearch ? 'translate-x-4 sm:translate-x-4' : 'translate-x-0'}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    checked={useDeepSearch}
                                    onChange={e => setUseDeepSearch(e.target.checked)}
                                    className="hidden"
                                />
                                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                                    <span className="sm:hidden">Otim. Prof.</span>
                                    <span className="hidden sm:inline">Otimização Profunda</span>
                                    <span className="text-[9px] sm:text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">BETA</span>
                                </span>
                            </label>
                        </div>

                        <button
                            onClick={() => handleOptimize(true)}
                            disabled={!result || isOptimizing}
                            className={`col-span-2 sm:col-span-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 sm:py-2 rounded-lg font-medium transition-colors sm:ml-auto text-base sm:text-sm min-h-[48px] sm:min-h-0 flex items-center justify-center gap-2 ${(!result || isOptimizing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isOptimizing ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Otimizando...</span>
                                </>
                            ) : (
                                'Gerar Plano de Corte'
                            )}
                        </button>
                    </div>
                </div>

                {/* History List */}
                {history.length > 0 && (
                    <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 sm:mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-600 dark:text-slate-400">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                            </svg>
                            Histórico de Versões
                        </h4>
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className={`relative flex-shrink-0 p-2 sm:p-3 rounded-lg border text-left transition-all min-w-[140px] sm:min-w-[160px] group ${result === item.result ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 ring-1 ring-blue-500 dark:ring-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'}`}
                                >
                                    <button
                                        onClick={() => {
                                            setResult(item.result);
                                            setManualRotations(item.manualRotations);
                                            setLockedItems(item.lockedItems || {});
                                        }}
                                        className="w-full text-left"
                                    >
                                        <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">
                                            {new Date(item.timestamp).toLocaleTimeString()}
                                        </div>
                                        <div className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm mb-1">
                                            {item.result.totalHeight.toFixed(1)} cm
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] sm:text-xs">
                                            <span className="text-slate-600 dark:text-slate-400">{item.result.efficiency.toFixed(1)}% Efic.</span>
                                            {item.methodName === 'Otimização Profunda' && (
                                                <span className="w-2 h-2 rounded-full bg-purple-500" title="Otimização Profunda"></span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setHistoryToDelete(item.id);
                                        }}
                                        className="absolute top-1 right-1 p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors bg-white/50 dark:bg-slate-800/50 rounded-full backdrop-blur-sm"
                                        title="Excluir versão"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                                            <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.49 1.478l-.565 9.064a2.625 2.625 0 01-2.622 2.44h-5.402a2.625 2.625 0 01-2.622-2.44L5.11 6.695a48.866 48.866 0 01-3.878-.512.75.75 0 11.49-1.478 48.818 48.818 0 013.878-.512h9.752zM15 9a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0115 9zm-3 0a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0112 9zm-3 0a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 019 9z" clipRule="evenodd" />
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
                        {/* Stats */}
                        <div className="flex flex-nowrap gap-2 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs sm:text-sm overflow-x-auto no-scrollbar">
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider truncate" title="Comprimento Total">
                                    <span className="sm:hidden">Comp.</span>
                                    <span className="hidden sm:inline">Comprimento Total</span>
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg whitespace-nowrap">{result.totalHeight.toFixed(1)} cm</span>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1 sm:mx-2 flex-shrink-0"></div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider truncate" title="Eficiência">
                                    <span className="sm:hidden">Efic.</span>
                                    <span className="hidden sm:inline">Eficiência</span>
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg whitespace-nowrap">{result.efficiency.toFixed(1)}%</span>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1 sm:mx-2 flex-shrink-0"></div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider truncate" title="Peças Encaixadas">
                                    <span className="sm:hidden">Peças</span>
                                    <span className="hidden sm:inline">Peças Encaixadas</span>
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg whitespace-nowrap">{result.placedItems.length}</span>
                            </div>
                        </div>

                        {/* Estimated Cost */}
                        {(() => {
                            const film = films.find(f => f.nome === activeFilm);
                            if (!film || !film.precoMetroLinear) return null;
                            const cost = (result.totalHeight / 100) * film.precoMetroLinear;
                            return (
                                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-green-700 dark:text-green-400 uppercase tracking-wider font-medium">Custo Estimado de Material</span>
                                        <span className="font-bold text-green-800 dark:text-green-300 text-lg">R$ {cost.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    <div className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-1">
                                        {(result.totalHeight / 100).toFixed(2)}m Ã— R$ {film.precoMetroLinear.toFixed(2)}/m
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Zoom Slider - Positioned above visualization */}
                        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-3 px-2 sm:px-4 w-full max-w-3xl mx-auto">
                            <input
                                type="range"
                                min="50"
                                max="300"
                                value={zoomLevel * 100}
                                onChange={(e) => setZoomLevel(parseInt(e.target.value) / 100)}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600 hover:accent-green-700 touch-manipulation"
                                style={{
                                    background: `linear-gradient(to right, #16a34a 0%, #16a34a ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 100%)`
                                }}
                            />
                            <span className="text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[40px] sm:min-w-[45px] text-center">{Math.round(zoomLevel * 100)}%</span>
                        </div>

                        {/* Drawing */}
                        <div className="relative overflow-x-auto pb-8 border border-slate-800 rounded-lg bg-slate-950 min-h-[400px] text-center shadow-2xl">
                            <div className="inline-block relative m-12" style={{ textAlign: 'initial' }}>

                                {/* Horizontal Ruler (Top) */}
                                <div className="absolute top-[-30px] left-0 w-full h-[30px] border-b border-slate-700">
                                    {Array.from({ length: Math.ceil(result.rollWidth / 10) + 1 }).map((_, i) => {
                                        const val = i * 10;
                                        if (val > result.rollWidth) return null;
                                        const isMajor = true; // Every 10cm is major in this loop
                                        return (
                                            <div key={val} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${val * scale}px`, transform: 'translateX(-50%)' }}>
                                                <span className="text-[10px] font-mono text-slate-400 mb-1">{val === 0 ? '0' : (val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                                                <div className="h-2 w-px bg-slate-500"></div>
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
                                <div className="absolute left-[-35px] top-0 h-full w-[35px] border-r border-slate-700">
                                    {Array.from({ length: Math.ceil(result.totalHeight / 10) + 1 }).map((_, i) => {
                                        const val = i * 10;
                                        if (val > result.totalHeight) return null;
                                        return (
                                            <div key={val} className="absolute right-0 flex items-center" style={{ top: `${val * scale}px`, transform: 'translateY(-50%)' }}>
                                                <span className="text-[10px] font-mono text-slate-400 mr-1">{val === 0 ? '0' : (val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                                                <div className="w-2 h-px bg-slate-500"></div>
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
                                    className="relative bg-slate-900/50 shadow-inner overflow-hidden"
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
                                    {/* Items */}
                                    {result.placedItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className="absolute flex items-center justify-center text-xs font-bold border transition-all hover:z-10 hover:shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:scale-[1.005] cursor-default group backdrop-blur-[1px]"
                                            style={{
                                                left: `${item.x * scale}px`,
                                                top: `${item.y * scale}px`,
                                                width: `${item.w * scale}px`,
                                                height: `${item.h * scale}px`,
                                                backgroundColor: 'rgba(14, 165, 233, 0.15)', // Sky-500 with low opacity
                                                borderColor: 'rgba(56, 189, 248, 0.6)', // Sky-400
                                                color: 'rgba(224, 242, 254, 0.9)' // Sky-100
                                            }}
                                            title={`#${index + 1}: ${item.label} (${item.w.toFixed(1)} x ${item.h.toFixed(1)})`}
                                        >
                                            {/* Large Watermark ID */}
                                            <div
                                                className="absolute inset-0 flex items-center justify-center font-black text-white/10 pointer-events-none select-none"
                                                style={{ fontSize: `${Math.min(item.w, item.h) * scale * 0.6}px` }}
                                            >
                                                {index + 1}
                                            </div>

                                            {/* Dimensions - Only show if piece is big enough */}
                                            {item.w * scale > 40 && item.h * scale > 40 && (
                                                <>
                                                    {/* Width Label (Bottom Right inside) */}
                                                    <div className="absolute bottom-1 right-2 text-[10px] sm:text-xs font-mono text-sky-200 font-medium bg-slate-900/40 px-1 rounded">
                                                        {(item.w / 100).toFixed(2)}
                                                    </div>

                                                    {/* Height Label (Left inside) */}
                                                    <div className="absolute left-1 top-0 h-full flex items-center">
                                                        <span className="origin-center -rotate-90 text-[10px] sm:text-xs font-mono text-sky-200 font-medium bg-slate-900/40 px-1 rounded">
                                                            {(item.h / 100).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </>
                                            )}

                                            {/* Width on the bottom (only for bottom-most items in their column to avoid clutter? Or just all?) 
                                                Let's stick to the internal label for width as per the reference image having internal numbers.
                                                Actually reference has internal numbers like 1.00, 0.85.
                                            */}

                                            {item.rotated && (
                                                <div className="absolute top-1 right-1 opacity-60">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-sky-400">
                                                        <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}

                                            {/* Lock Toggle Button */}
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
                                                className={`absolute -top-2 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 bg-slate-800 border border-slate-600 rounded-full p-1 shadow-md transition-all hover:bg-slate-700 z-20 ${lockedItems[item.id!] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                title={lockedItems[item.id!] ? "Destravar peça" : "Travar peça"}
                                            >
                                                {lockedItems[item.id!] ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-red-500">
                                                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-slate-400">
                                                        <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 01-1.5 0V6.75a3.75 3.75 0 10-7.5 0v3a.75.75 0 01-1.5 0v-3A5.25 5.25 0 0118 1.5zM12.625 14.75a.75.75 0 00-1.25 0v2.625c0 .414.336.75.75.75h3.5a.75.75 0 00.75-.75v-2.625a.75.75 0 00-1.25 0H12.625z" />
                                                        <path fillRule="evenodd" d="M12.971 10.286a3 3 0 00-1.942 0A6 6 0 004.5 16.125v2.25a3 3 0 003 3h9a3 3 0 003-3v-2.25a6 6 0 00-6.529-5.839z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>

                                            {/* Rotation Toggle Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.id) {
                                                        const currentRotated = item.rotated || false;
                                                        setManualRotations(prev => ({
                                                            ...prev,
                                                            [item.id!]: !currentRotated
                                                        }));
                                                    }
                                                }}
                                                className="absolute -top-2 -right-2 bg-slate-800 border border-slate-600 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700 z-20"
                                                title="Girar peça"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-sky-400">
                                                    <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
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
            </div>
        </div >
    );
};

export default CuttingOptimizationPanel;
