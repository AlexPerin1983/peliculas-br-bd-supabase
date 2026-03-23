// =====================================================
// SYNC STATUS INDICATOR - Indicador visual de sincronizacao
// =====================================================

import React, { useState, useEffect } from 'react';
import { subscribeSyncStatus, SyncStatus, forcSync } from '../services/syncService';
import { Wifi, WifiOff, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface SyncStatusIndicatorProps {
    showDetails?: boolean;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ showDetails = false }) => {
    const [status, setStatus] = useState<SyncStatus>({
        isOnline: navigator.onLine,
        pendingCount: 0,
        failedCount: 0,
        failedItems: [],
        lastSyncAt: null,
        syncInProgress: false,
        error: null
    });
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeSyncStatus(setStatus);
        return unsubscribe;
    }, []);

    const handleSync = async () => {
        await forcSync();
    };

    // Nao mostrar nada se esta online e nao tem pendentes
    if (status.isOnline && status.pendingCount === 0 && status.failedCount === 0 && !showDetails) {
        return null;
    }

    const getStatusIcon = () => {
        if (status.syncInProgress) {
            return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
        }
        if (!status.isOnline) {
            return <WifiOff className="w-4 h-4 text-red-500" />;
        }
        if (status.failedCount > 0) {
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        if (status.pendingCount > 0) {
            return <CloudOff className="w-4 h-4 text-yellow-500" />;
        }
        if (status.error) {
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        return <Check className="w-4 h-4 text-green-500" />;
    };

    const getStatusText = () => {
        if (status.syncInProgress) return 'Sincronizando...';
        if (!status.isOnline) return 'Offline';
        if (status.failedCount > 0) return `${status.failedCount} erro${status.failedCount > 1 ? 's' : ''}`;
        if (status.pendingCount > 0) return `${status.pendingCount} pendente${status.pendingCount > 1 ? 's' : ''}`;
        if (status.error) return 'Erro';
        return 'Sincronizado';
    };

    const getStatusColor = () => {
        if (status.syncInProgress) return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
        if (!status.isOnline) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
        if (status.failedCount > 0) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
        if (status.pendingCount > 0) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
        if (status.error) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
    };

    return (
        <div className="relative">
            <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${getStatusColor()}`}
            >
                {getStatusIcon()}
                <span className="text-slate-700 dark:text-slate-300">{getStatusText()}</span>
            </button>

            {expanded && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Conexao</span>
                            <div className="flex items-center gap-2">
                                {status.isOnline ? (
                                    <>
                                        <Wifi className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-green-600 dark:text-green-400">Online</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="w-4 h-4 text-red-500" />
                                        <span className="text-sm text-red-600 dark:text-red-400">Offline</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Pendentes</span>
                            <span className={`text-sm font-medium ${status.pendingCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                                {status.pendingCount}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Erros</span>
                            <span className={`text-sm font-medium ${status.failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {status.failedCount}
                            </span>
                        </div>

                        {status.lastSyncAt && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Ultima sync</span>
                                <span className="text-sm text-slate-500">
                                    {new Date(status.lastSyncAt).toLocaleTimeString()}
                                </span>
                            </div>
                        )}

                        {status.error && (
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="text-xs text-red-600 dark:text-red-400">{status.error}</p>
                            </div>
                        )}

                        {status.failedItems.length > 0 && (
                            <div className="space-y-2">
                                {status.failedItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/40"
                                    >
                                        <p className="text-xs font-medium text-red-700 dark:text-red-300">
                                            {item.table} • {item.action} • tentativa {item.retryCount}
                                        </p>
                                        {item.lastError && (
                                            <p className="mt-1 text-xs text-red-600 dark:text-red-400 line-clamp-2">
                                                {item.lastError}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {status.isOnline && (status.pendingCount > 0 || status.failedCount > 0) && (
                            <button
                                onClick={handleSync}
                                disabled={status.syncInProgress}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${status.syncInProgress ? 'animate-spin' : ''}`} />
                                {status.syncInProgress ? 'Sincronizando...' : 'Sincronizar Agora'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {expanded && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setExpanded(false)}
                />
            )}
        </div>
    );
};

export default SyncStatusIndicator;
