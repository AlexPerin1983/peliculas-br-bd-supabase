import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Measurement } from '../types';
import { CuttingOptimizer, OptimizationResult, Rect } from '../utils/CuttingOptimizer';
import ConfirmationModal from './modals/ConfirmationModal';

interface CuttingOptimizationPanelProps {
    measurements: Measurement[];
    clientId?: number;
    optionId?: number;
}

const CuttingOptimizationPanel: React.FC<CuttingOptimizationPanelProps> = ({ measurements, clientId, optionId }) => {
    const [rollWidth, setRollWidth] = useState<string>('152');
    const [bladeWidth, setBladeWidth] = useState<string>('0');
    const [respectGrain, setRespectGrain] = useState<boolean>(false);
    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [manualRotations, setManualRotations] = useState<{ [key: string]: boolean }>({});
    const [useDeepSearch, setUseDeepSearch] = useState<boolean>(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [history, setHistory] = useState<{
        id: string;
        timestamp: number;
        result: OptimizationResult;
        manualRotations: { [key: string]: boolean };
        methodName: string;
    }[]>([]);
    const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

    // Storage key for this client/option combination
    const storageKey = clientId && optionId ? `cutting_history_${clientId}_${optionId}` : null;

    // Load history from localStorage on mount or when client/option changes
    useEffect(() => {
        if (storageKey) {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const parsedHistory = JSON.parse(stored);
                    setHistory(parsedHistory);
                }
            } catch (e) {
                console.error('Failed to load cutting history:', e);
            }
        } else {
            // Clear history if no valid storage key
            setHistory([]);
        }
    }, [storageKey]);

    // Save history to localStorage whenever it changes
    useEffect(() => {
        if (storageKey && history.length > 0) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save cutting history:', e);
            }
        }
    }, [history, storageKey]);

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
        const width = parseFloat(rollWidth);
        const spacing = parseFloat(bladeWidth);

        if (isNaN(width) || width <= 0) {
            return;
        }

        // Create a signature of the current parameters
        const currentParams = JSON.stringify({
            width,
            spacing,
            respectGrain,
            measurements: measurements.map(m => ({
                id: m.id,
                largura: m.largura,
                altura: m.altura,
                quantidade: m.quantidade,
                active: m.active
            })),
            manualRotations,
            useDeepSearch
        });

        // If saving to history and parameters haven't changed, reuse the existing result
        if (saveToHistory && resultRef.current && lastParamsRef.current === currentParams) {
            setHistory(prev => [
                {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    result: resultRef.current!,
                    manualRotations: { ...manualRotations },
                    methodName: useDeepSearch ? 'Otimização Profunda' : 'Automático'
                },
                ...prev
            ].slice(0, 10));
            return;
        }

        setIsOptimizing(true);

        // Use setTimeout to allow UI to update (show loading state) before heavy calculation
        setTimeout(() => {
            const optimizer = new CuttingOptimizer({
                rollWidth: width,
                bladeWidth: isNaN(spacing) ? 0 : spacing / 10, // mm to cm
                allowRotation: !respectGrain
            });

            measurements.forEach(m => {
                if (!m.active) return; // Skip inactive measurements

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

            const newResult = optimizer.optimize(manualRotations, useDeepSearch);
            setResult(newResult);
            lastParamsRef.current = currentParams;
            setIsOptimizing(false);

            if (saveToHistory && newResult) {
                setHistory(prev => [
                    {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        result: newResult,
                        manualRotations: { ...manualRotations },
                        methodName: useDeepSearch ? 'Otimização Profunda' : 'Automático'
                    },
                    ...prev
                ].slice(0, 10)); // Keep last 10
            }
        }, 50);
    }, [rollWidth, bladeWidth, respectGrain, measurements, manualRotations, useDeepSearch]);

    // Auto-optimize when dependencies change
    useEffect(() => {
        const timer = setTimeout(() => {
            handleOptimize(false);
        }, 500); // Debounce slightly
        return () => clearTimeout(timer);
    }, [handleOptimize]);

    // Calculate dynamic scale
    const availableWidth = Math.max(0, containerWidth - 48);
    const baseScale = result && result.rollWidth > 0 ? availableWidth / result.rollWidth : 2;
    const scale = baseScale * zoomLevel;

    const getColor = (w: number, h: number) => `hsla(${(w * h * 137) % 360}, 70%, 85%, 0.3)`;
    const getBorderColor = (w: number, h: number) => `hsl(${(w * h * 137) % 360}, 70%, 30%)`;

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
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">Otimizador de Corte</h3>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="sm:hidden flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                        </svg>
                        {isSettingsOpen ? 'Ocultar' : 'Configurar'}
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
                                value={rollWidth}
                                onChange={e => setRollWidth(e.target.value)}
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
                                    value={bladeWidth}
                                    onChange={e => setBladeWidth(e.target.value)}
                                    placeholder="0"
                                    className="border border-slate-300 dark:border-slate-600 p-2.5 sm:p-2 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none w-full sm:w-32 pr-8 text-base sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                />
                                <span className="absolute right-3 top-2.5 sm:top-2 text-xs text-slate-400 dark:text-slate-500">mm</span>
                            </div>
                        </div>

                        <div className="col-span-1 flex items-center justify-center sm:justify-start h-12 sm:h-10 pb-0 sm:pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className={`w-10 h-6 sm:w-10 sm:h-6 rounded-full p-1 transition-colors ${respectGrain ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-4 h-4 sm:w-4 sm:h-4 rounded-full shadow-sm transform transition-transform ${respectGrain ? 'translate-x-4 sm:translate-x-4' : 'translate-x-0'}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    checked={respectGrain}
                                    onChange={e => setRespectGrain(e.target.checked)}
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
                                        className="absolute top-1 right-1 p-1 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Excluir versão"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4">
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
                        <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs sm:text-sm">
                            <div className="flex flex-col flex-1 min-w-[80px]">
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Comprimento Total</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{result.totalHeight.toFixed(1)} cm</span>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1 sm:mx-2"></div>
                            <div className="flex flex-col flex-1 min-w-[80px]">
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Eficiência</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{result.efficiency.toFixed(1)}%</span>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1 sm:mx-2"></div>
                            <div className="flex flex-col flex-1 min-w-[80px]">
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Peças Encaixadas</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{result.placedItems.length}</span>
                            </div>
                        </div>

                        {/* Zoom Slider - Positioned above visualization */}
                        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3 px-2 sm:px-4">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-500 dark:text-slate-400">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                            <input
                                type="range"
                                min="50"
                                max="300"
                                value={zoomLevel * 100}
                                onChange={(e) => setZoomLevel(parseInt(e.target.value) / 100)}
                                className="flex-1 max-w-xs h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 touch-manipulation"
                                style={{
                                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 100%)`
                                }}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-500 dark:text-slate-400">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                            <span className="text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[40px] sm:min-w-[45px] text-center">{Math.round(zoomLevel * 100)}%</span>
                        </div>

                        {/* Drawing */}
                        <div className="relative overflow-x-auto pb-8 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100/50 dark:bg-slate-900/50 min-h-[300px] text-center">
                            <div className="inline-block relative m-8 shadow-xl" style={{ textAlign: 'initial' }}>
                                {/* Roll Background */}
                                <div
                                    className="relative bg-slate-800 border-x-2 border-slate-700 shadow-inner"
                                    style={{
                                        width: `${result.rollWidth * scale}px`,
                                        height: `${result.totalHeight * scale}px`,
                                        backgroundImage: `
                                            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
                                        `,
                                        backgroundSize: `${scale}px ${scale}px`
                                    }}
                                >
                                    {/* Items */}
                                    {result.placedItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className="absolute flex items-center justify-center text-xs font-bold border transition-all hover:z-10 hover:shadow-lg hover:scale-[1.02] cursor-default group backdrop-blur-[1px]"
                                            style={{
                                                left: `${item.x * scale}px`,
                                                top: `${item.y * scale}px`,
                                                width: `${item.w * scale}px`,
                                                height: `${item.h * scale}px`,
                                                backgroundColor: getColor(item.w, item.h),
                                                borderColor: getBorderColor(item.w, item.h),
                                                color: getBorderColor(item.w, item.h)
                                            }}
                                            title={`#${index + 1}: ${item.label} (${item.w.toFixed(1)} x ${item.h.toFixed(1)})`}
                                        >
                                            <div className="absolute top-0.5 left-1 opacity-70 font-mono leading-none" style={{ fontSize: `${Math.max(8, Math.min(10, (item.w * scale) / 6))}px` }}>#{index + 1}</div>

                                            {item.w * scale > 25 && item.h * scale > 25 && (
                                                <>
                                                    {/* Width - Bottom Center */}
                                                    <div
                                                        className="absolute bottom-0.5 left-0 w-full text-center leading-none pointer-events-none font-mono"
                                                        style={{ fontSize: `${Math.max(8, Math.min(14, (item.w * scale) / 5))}px` }}
                                                    >
                                                        {item.w.toFixed(1)}
                                                    </div>

                                                    {/* Height - Right Center (Rotated) */}
                                                    <div
                                                        className="absolute right-0 top-0 h-full flex items-center justify-center pointer-events-none"
                                                        style={{ width: '1.5em' }}
                                                    >
                                                        <div
                                                            className="origin-center rotate-90 whitespace-nowrap leading-none font-mono"
                                                            style={{ fontSize: `${Math.max(8, Math.min(14, (item.h * scale) / 5))}px` }}
                                                        >
                                                            {item.h.toFixed(1)}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {item.rotated && (
                                                <div className="absolute top-1 right-1 opacity-60">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                                        <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
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
                                                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 z-20"
                                                title="Girar peça"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-600">
                                                    <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Dimensions Labels */}
                                <div className="absolute -top-6 left-0 w-full text-center text-xs font-mono text-slate-500">
                                    {result.rollWidth} cm
                                </div>
                                <div className="absolute top-0 -left-8 h-full flex items-center">
                                    <div className="origin-center -rotate-90 whitespace-nowrap text-xs font-mono text-slate-500">
                                        {result.totalHeight.toFixed(1)} cm
                                    </div>
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
        </div>
    );
};

export default CuttingOptimizationPanel;
