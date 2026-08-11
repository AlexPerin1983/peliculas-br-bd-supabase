import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Zap } from 'lucide-react';

interface UpdateBannerProps {
    onDismiss?: () => void;
}

export const PWA_UPDATE_READY_EVENT = 'peliculas-br-pwa-update-ready';

const WORKER_INSTALL_TIMEOUT_MS = 5_000;
const UPDATE_RELOAD_FALLBACK_MS = 4_000;

const isLocalDevelopmentHost = () => {
    const hostname = window.location.hostname;
    return import.meta.env.DEV
        || ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)
        || hostname.endsWith('.local')
        || /^10\./.test(hostname)
        || /^192\.168\./.test(hostname)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => (
    new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            settled = true;
            resolve(fallback);
        }, timeoutMs);

        promise.then(
            (value) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                reject(error);
            }
        );
    })
);

const reloadWithCacheBust = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_app_refresh', String(Date.now()));
    window.location.replace(url.toString());
};

const waitForWorkerInstallation = (worker: ServiceWorker): Promise<boolean> => {
    if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        let timeoutId: number | undefined;

        const finish = (completed: boolean) => {
            worker.removeEventListener('statechange', handleStateChange);
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
            resolve(completed);
        };

        const handleStateChange = () => {
            if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
                finish(true);
            }
        };

        worker.addEventListener('statechange', handleStateChange);
        timeoutId = window.setTimeout(() => finish(false), WORKER_INSTALL_TIMEOUT_MS);
    });
};

const requestUpdatedWorkerActivation = async (
    registration: ServiceWorkerRegistration
): Promise<boolean> => {
    const activateWaitingWorker = () => {
        const waitingWorker = registration.waiting;
        if (!waitingWorker) return false;

        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        return true;
    };

    // Uma versao que ja esta pronta nao depende de uma nova consulta de rede.
    if (activateWaitingWorker()) return true;

    try {
        await withTimeout(
            registration.update(),
            WORKER_INSTALL_TIMEOUT_MS,
            undefined
        );
    } catch (error) {
        // A atualizacao pode ter terminado enquanto a consulta reportava erro.
        if (activateWaitingWorker()) return true;
        throw error;
    }

    if (activateWaitingWorker()) return true;

    if (!registration.waiting && registration.installing) {
        const installationFinished = await waitForWorkerInstallation(registration.installing);
        if (!installationFinished) {
            throw new Error('A nova versao ainda esta sendo instalada. Tente novamente.');
        }
    }

    return activateWaitingWorker();
};

const scheduleFreshReload = (activationRequested: boolean) => {
    if (!activationRequested) {
        reloadWithCacheBust();
        return;
    }

    // O index.html recarrega assim que recebe controllerchange. Este timeout e
    // apenas um fallback para navegadores que demoram a emitir esse evento.
    window.setTimeout(reloadWithCacheBust, UPDATE_RELOAD_FALLBACK_MS);
};

/**
 * Detecta atualizacoes do Service Worker e mostra um banner simples
 * para atualizar o app sem depender de conhecimento tecnico do usuario.
 */
const UpdateBanner: React.FC<UpdateBannerProps> = ({ onDismiss }) => {
    const [showBanner, setShowBanner] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateReady, setUpdateReady] = useState(false);
    const isLocalDev = isLocalDevelopmentHost();

    const handleUpdate = useCallback(async () => {
        setIsUpdating(true);

        try {
            const registration = await navigator.serviceWorker?.getRegistration();
            const activationRequested = registration
                ? await requestUpdatedWorkerActivation(registration)
                : false;

            scheduleFreshReload(activationRequested);
        } catch (error) {
            console.error('[UpdateBanner] Erro ao atualizar:', error);
            reloadWithCacheBust();
        }
    }, []);

    const checkForUpdates = useCallback(async () => {
        if (isLocalDev || !('serviceWorker' in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.getRegistration();

            if (registration) {
                if (registration.waiting) {
                    setShowBanner(true);
                    setUpdateReady(true);
                    return;
                }

                await withTimeout(
                    registration.update(),
                    WORKER_INSTALL_TIMEOUT_MS,
                    undefined
                );

                if (registration.waiting) {
                    setShowBanner(true);
                    setUpdateReady(true);
                }
            }
        } catch (error) {
            console.error('[UpdateBanner] Erro ao verificar atualizacoes:', error);
        }
    }, [isLocalDev]);

    useEffect(() => {
        if (isLocalDev || !('serviceWorker' in navigator)) return;

        const handleUpdateReady = () => {
            setShowBanner(true);
            setUpdateReady(true);
        };

        window.addEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);
        checkForUpdates();

        const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

        return () => {
            window.removeEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);
            clearInterval(interval);
        };
    }, [checkForUpdates, isLocalDev]);

    // O reload em 'controllerchange' é tratado uma única vez no index.html
    // (com guarda anti-loop). Não duplicamos aqui para evitar reloads repetidos.

    const handleDismiss = () => {
        setShowBanner(false);
        onDismiss?.();
    };

    if (isLocalDev || !showBanner) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-slideDown">
            <div className="max-w-lg mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-2xl shadow-2xl shadow-blue-500/30 overflow-hidden">
                <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-yellow-300 animate-pulse" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-base sm:text-lg">
                                Nova versao disponivel!
                            </h3>
                            <p className="text-blue-100 text-sm mt-1">
                                Atualize agora para ter acesso as melhorias mais recentes.
                            </p>

                            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={handleUpdate}
                                    disabled={isUpdating}
                                    className="flex-1 px-4 py-2.5 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                                >
                                    {isUpdating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Atualizando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            <span>Atualizar Agora</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleDismiss}
                                    className="px-4 py-2.5 text-white/80 hover:text-white hover:bg-white/10 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    <span>Depois</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleDismiss}
                            className="hidden sm:flex flex-shrink-0 w-8 h-8 items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {updateReady && (
                    <div className="h-1 bg-white/20">
                        <div className="h-full bg-yellow-400 animate-pulse" style={{ width: '100%' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export const useServiceWorkerUpdate = () => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const isLocalDev = isLocalDevelopmentHost();

    const forceUpdate = useCallback(async () => {
        const registration = await navigator.serviceWorker?.getRegistration();
        const activationRequested = registration
            ? await requestUpdatedWorkerActivation(registration)
            : false;
        scheduleFreshReload(activationRequested);
    }, []);

    useEffect(() => {
        if (isLocalDev || !('serviceWorker' in navigator)) return;

        const checkUpdate = async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg?.waiting) {
                setHasUpdate(true);
            }
        };

        checkUpdate();
    }, [isLocalDev]);

    return { hasUpdate, forceUpdate };
};

export default UpdateBanner;
