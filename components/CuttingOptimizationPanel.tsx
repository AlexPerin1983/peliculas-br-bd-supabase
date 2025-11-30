import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Measurement } from '../types';
import { CuttingOptimizer, OptimizationResult } from '../utils/CuttingOptimizer';

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
    const [history, setHistory] = useState<{
        id: string;
        timestamp: number;
        result: OptimizationResult;
        manualRotations: { [key: string]: boolean };
        methodName: string;
    }[]>([]);

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

    const handleOptimize = React.useCallback((saveToHistory: boolean = false) => {
        const width = parseFloat(rollWidth);
        const spacing = parseFloat(bladeWidth);

        if (isNaN(width) || width <= 0) {
            // alert('Largura inválida'); // Removed alert to avoid loop if called in effect
            return;
        }

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

    const getColor = (w: number, h: number) => `hsl(${(w * h * 137) % 360}, 70%, 90%)`;
    const getBorderColor = (w: number, h: number) => `hsl(${(w * h * 137) % 360}, 60%, 40%)`;

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
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">Otimizador de Corte</h3>
            </div>

            <div className="p-6">
                {/* Inputs */}
                <div className="flex flex-wrap gap-4 items-end mb-6">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Largura Bobina (cm)</label>
                        <input
                            type="number"
                            value={rollWidth}
                            onChange={e => setRollWidth(e.target.value)}
                            placeholder="Largura (cm)"
                            className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-32"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Espaçamento (Corte)</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={bladeWidth}
                                onChange={e => setBladeWidth(e.target.value)}
                                placeholder="0"
                                className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-32 pr-8"
                            />
                            <span className="absolute right-3 top-2 text-xs text-slate-400">mm</span>
                        </div>
                    </div>

                    <div className="flex items-center h-10 pb-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${respectGrain ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${respectGrain ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input
                                type="checkbox"
                                checked={respectGrain}
                                onChange={e => setRespectGrain(e.target.checked)}
                                className="hidden"
                            />
                            <span className="text-sm text-slate-700">Respeitar Veio</span>
                        </label>
                    </div>

                    <div className="flex items-center h-10 pb-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none" title="Tenta milhares de combinações para encontrar o melhor encaixe (mais lento)">
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${useDeepSearch ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${useDeepSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input
                                type="checkbox"
                                checked={useDeepSearch}
                                onChange={e => setUseDeepSearch(e.target.checked)}
                                className="hidden"
                            />
                            <span className="text-sm text-slate-700 font-medium">
                                Otimização Profunda
                                <span className="ml-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">BETA</span>
                            </span>
                        </label>
                    </div>

                    <button
                        onClick={() => handleOptimize(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors ml-auto"
                    >
                        Gerar Plano de Corte
                    </button>
                </div>

                {/* History List */}
                {history.length > 0 && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                            </svg>
                            Histórico de Versões
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {history.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setResult(item.result);
                                        setManualRotations(item.manualRotations);
                                    }}
                                    className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all min-w-[160px] ${result === item.result ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                                >
                                    <div className="text-xs text-slate-500 mb-1">
                                        {new Date(item.timestamp).toLocaleTimeString()}
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm mb-1">
                                        {item.result.totalHeight.toFixed(1)} cm
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600">{item.result.efficiency.toFixed(1)}% Efic.</span>
                                        {item.methodName === 'Otimização Profunda' && (
                                            <span className="w-2 h-2 rounded-full bg-purple-500" title="Otimização Profunda"></span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Visualization */}
                {result && (
                    <div className="animate-fade-in" ref={containerRef}>
                        {/* Stats */}
                        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-xs uppercase tracking-wider">Comprimento Total</span>
                                <span className="font-bold text-slate-800 text-lg">{result.totalHeight.toFixed(1)} cm</span>
                            </div>
                            <div className="w-px bg-slate-200 mx-2"></div>
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-xs uppercase tracking-wider">Eficiência</span>
                                <span className="font-bold text-slate-800 text-lg">{result.efficiency.toFixed(1)}%</span>
                            </div>
                            <div className="w-px bg-slate-200 mx-2"></div>
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-xs uppercase tracking-wider">Peças Encaixadas</span>
                                <span className="font-bold text-slate-800 text-lg">{result.placedItems.length}</span>
                            </div>
                        </div>

                        {/* Zoom Slider - Positioned above visualization */}
                        <div className="mb-4 flex items-center justify-center gap-3 px-4">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-500">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                            <input
                                type="range"
                                min="50"
                                max="300"
                                value={zoomLevel * 100}
                                onChange={(e) => setZoomLevel(parseInt(e.target.value) / 100)}
                                className="flex-1 max-w-xs h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                                style={{
                                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 ${((zoomLevel * 100 - 50) / 250) * 100}%, #e2e8f0 100%)`
                                }}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-500">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                            <span className="text-xs font-medium text-slate-600 min-w-[45px] text-center">{Math.round(zoomLevel * 100)}%</span>
                        </div>

                        {/* Drawing */}
                        <div className="relative overflow-x-auto pb-8 border border-slate-200 rounded-lg bg-slate-100/50 min-h-[300px] text-center">
                            <div className="inline-block relative m-8 shadow-xl" style={{ textAlign: 'initial' }}>
                                {/* Roll Background */}
                                <div
                                    className="relative bg-white border-x-2 border-slate-800"
                                    style={{
                                        width: `${result.rollWidth * scale}px`,
                                        height: `${result.totalHeight * scale}px`,
                                        backgroundImage: 'linear-gradient(45deg, #f8fafc 25%, transparent 25%, transparent 75%, #f8fafc 75%, #f8fafc), linear-gradient(45deg, #f8fafc 25%, transparent 25%, transparent 75%, #f8fafc 75%, #f8fafc)',
                                        backgroundSize: '20px 20px',
                                        backgroundPosition: '0 0, 10px 10px'
                                    }}
                                >
                                    {/* Items */}
                                    {result.placedItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className="absolute flex items-center justify-center text-xs font-bold border transition-all hover:z-10 hover:shadow-lg hover:scale-[1.02] cursor-default group"
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
                                            <div className="absolute top-0.5 left-1 text-[10px] opacity-50 font-mono">#{index + 1}</div>

                                            {item.w * scale > 50 && item.h * scale > 30 ? (
                                                <div className="flex flex-col items-center leading-tight">
                                                    <span>{(item.w).toFixed(1)}</span>
                                                    <span className="opacity-40 text-[9px]">x</span>
                                                    <span>{(item.h).toFixed(1)}</span>
                                                    {item.rotated && (
                                                        <div className="absolute bottom-1 right-1 opacity-60">
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
                                            ) : (
                                                <span>#{index + 1}</span>
                                            )}
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
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600">
                                    <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                </svg>
                                Lista de Cortes
                            </h4>
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-700 font-medium">
                                        <tr>
                                            <th className="p-3 text-left border-b">Dimensões (L x A)</th>
                                            <th className="p-3 text-center border-b">Quantidade</th>
                                            <th className="p-3 text-left border-b">Índices no Mapa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedItems.map((group, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-mono text-slate-600">
                                                    {group.w.toFixed(1)} x {group.h.toFixed(1)} cm
                                                </td>
                                                <td className="p-3 text-center font-bold text-slate-800">
                                                    {group.count}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {group.indices.map(i => (
                                                            <span key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
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
            </div>
        </div >
    );
};

export default CuttingOptimizationPanel;
