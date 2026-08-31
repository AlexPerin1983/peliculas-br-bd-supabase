import React, { useState, useEffect } from 'react';
import { subscribeSyncStatus, type SyncStatus, forcSync } from '../services/syncService';
import { Wifi, WifiOff, CloudOff, RefreshCw, Check, AlertCircle, Copy } from 'lucide-react';
import { canAutomaticallyRetrySyncError, getSyncErrorInfo, getSyncErrorPresentation, getSyncTableLabel } from '../src/lib/syncErrors';
import { buildSyncDiagnostic } from '../src/lib/syncDiagnostics';

interface SyncStatusIndicatorProps { showDetails?: boolean; }
const formatTime = (value?: number | null) => value ? new Date(value).toLocaleTimeString('pt-BR') : '—';

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ showDetails = false }) => {
    const [status, setStatus] = useState<SyncStatus>({
        isOnline: navigator.onLine, pendingCount: 0, failedCount: 0, failedItems: [],
        lastSyncAt: null, syncInProgress: false, error: null
    });
    const [expanded, setExpanded] = useState(false);
    const [copyMessage, setCopyMessage] = useState('');
    const [diagnosticFallback, setDiagnosticFallback] = useState('');
    const [retryError, setRetryError] = useState('');

    useEffect(() => subscribeSyncStatus(setStatus), []);

    const handleSync = async () => {
        setRetryError('');
        try { await forcSync(); }
        catch { setRetryError('Não foi possível iniciar o envio. Copie o diagnóstico e fale com o suporte.'); }
    };
    const handleCopy = async () => {
        const diagnostic = buildSyncDiagnostic(status);
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(diagnostic);
            setDiagnosticFallback('');
            setCopyMessage('Diagnóstico copiado. Envie ao suporte.');
        } catch {
            setDiagnosticFallback(diagnostic);
            setCopyMessage('Selecione e copie o texto abaixo para enviar ao suporte.');
        }
    };

    const notSentCount = status.pendingCount + status.failedCount;
    const currentError = getSyncErrorInfo({ lastError: status.error, errorInfo: status.errorInfo });
    const hasConnectionFailure = (status.error && currentError.category === 'network')
        || status.failedItems.some(item => getSyncErrorInfo(item).category === 'network');
    const hasProblem = notSentCount > 0 || !!status.error;
    const lastAttemptAt = status.lastAttemptAt || Math.max(0, ...status.failedItems.map(item => item.lastAttemptAt || 0));

    if (status.isOnline && !hasProblem && !status.syncInProgress && !showDetails) return null;

    const text = status.syncInProgress ? 'Sincronizando...'
        : !status.isOnline ? (notSentCount > 0 ? 'Salvo no aparelho' : 'Offline')
        : hasConnectionFailure ? 'Salvo no aparelho'
        : notSentCount > 0 ? notSentCount + ' não enviado' + (notSentCount > 1 ? 's' : '')
        : status.error ? 'Envio precisa de atenção'
        : status.lastSyncAt ? 'Sincronizado' : 'Sem pendências';
    const color = status.syncInProgress ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
        : !status.isOnline ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
        : hasProblem ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
        : 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
    const icon = status.syncInProgress ? <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
        : !status.isOnline ? <WifiOff className="w-4 h-4 text-red-500" />
        : hasConnectionFailure ? <CloudOff className="w-4 h-4 text-amber-500" />
        : hasProblem ? <AlertCircle className="w-4 h-4 text-amber-500" />
        : <Check className="w-4 h-4 text-green-500" />;

    return (
        <div className="relative">
            <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
                className={'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' + color}>
                {icon}<span className="text-slate-700 dark:text-slate-300">{text}</span>
            </button>
            {expanded && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50">
                    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                            <span>Conexão</span>
                            <span className="flex items-center gap-2">
                                {status.isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                                {status.isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div className="flex justify-between"><span>Ainda não enviados</span><strong>{notSentCount}</strong></div>
                        <div className="flex justify-between"><span>Com falha</span><strong>{status.failedCount}</strong></div>
                        <div className="flex justify-between gap-2"><span>Última tentativa</span><span>{formatTime(lastAttemptAt)}</span></div>
                        <div className="flex justify-between gap-2">
                            <span>Último envio completo</span>
                            <span className="text-right text-xs">{status.lastSyncAt ? formatTime(status.lastSyncAt) : 'Sem confirmação nesta sessão'}</span>
                        </div>
                        {notSentCount > 0 && (
                            <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                Há alterações neste aparelho que ainda não chegaram ao servidor. Estar online não confirma o envio. Não limpe os dados nem reinstale o aplicativo.
                            </p>
                        )}
                        {status.error && status.failedItems.length === 0 && (
                            <div className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                <p className="font-medium">{getSyncErrorPresentation(currentError).title}</p>
                                <p>{getSyncErrorPresentation(currentError).message}</p>
                            </div>
                        )}
                        {status.failedItems.slice(0, 3).map(item => {
                            const info = getSyncErrorInfo(item);
                            const presentation = getSyncErrorPresentation(info, item.table);
                            const retry = canAutomaticallyRetrySyncError(info, item.retryCount);
                            return (
                                <div key={item.id} className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs leading-5 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                                    <p className="font-medium">{getSyncTableLabel(item.table)} • {presentation.title}</p>
                                    <p className="mt-1">{presentation.message}</p>
                                    <p className="mt-1">{retry ? 'Nova tentativa automática habilitada.' : 'Tentativa automática pausada; alteração preservada.'}</p>
                                </div>
                            );
                        })}
                        {status.failedCount > 3 && <p className="text-xs">Mais {status.failedCount - 3} falha(s). O diagnóstico inclui até 20.</p>}
                        {status.nextRetryAt && status.isOnline && (
                            <p className="text-xs">Nova tentativa automática prevista para {formatTime(status.nextRetryAt)}.</p>
                        )}
                        {status.isOnline && hasProblem && (
                            <button onClick={handleSync} disabled={status.syncInProgress}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                                <RefreshCw className={'w-4 h-4 ' + (status.syncInProgress ? 'animate-spin' : '')} />
                                {status.syncInProgress ? 'Sincronizando...' : 'Tentar novamente'}
                            </button>
                        )}
                        {retryError && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{retryError}</p>}
                        <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm">
                            <Copy className="w-4 h-4" /> Copiar diagnóstico
                        </button>
                        <p className="text-xs text-slate-500 dark:text-slate-400">O diagnóstico não inclui nomes, contatos, medidas, valores ou senhas. Nada é enviado automaticamente ao suporte.</p>
                        {copyMessage && <p role="status" className="text-xs">{copyMessage}</p>}
                        {diagnosticFallback && <textarea aria-label="Diagnóstico para o suporte" readOnly value={diagnosticFallback} onFocus={event => event.target.select()} className="w-full h-36 rounded border p-2 text-xs bg-transparent" />}
                    </div>
                </div>
            )}
            {expanded && <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />}
        </div>
    );
};

export default SyncStatusIndicator;
