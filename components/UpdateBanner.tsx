import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Zap } from 'lucide-react';

interface UpdateBannerProps {
    onDismiss?: () => void;
}

/**
 * Detecta atualizacoes do Service Worker e mostra um banner simples
 * para atualizar o app sem depender de conhecimento tecnico do usuario.
 */
const UpdateBanner: React.FC<UpdateBannerProps> = ({ onDismiss }) => {
    const [showBanner, setShowBanner] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateReady, setUpdateReady] = useState(false);
    const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const handleUpdate = useCallback(async () => {
        setIsUpdating(true);

        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration?.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (error) {
            console.error('[UpdateBanner] Erro ao atualizar:', error);
            window.location.reload();
        }
    }, []);

    const checkForUpdates = useCallback(async () => {
        if (isLocalDev || !('serviceWorker' in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.getRegistration();

            if (registration) {
                await registration.update();

                if (registration.waiting) {
                    setShowBanner(true);
                    setUpdateReady(true);
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            setShowBanner(true);
                            setUpdateReady(true);
                        }
                    });
                });
            }
        } catch (error) {
            console.error('[UpdateBanner] Erro ao verificar atualizacoes:', error);
        }
    }, [isLocalDev]);

    useEffect(() => {
        if (isLocalDev || !('serviceWorker' in navigator)) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SW_UPDATED') {
                setShowBanner(true);
                setUpdateReady(true);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        checkForUpdates();

        const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            clearInterval(interval);
        };
    }, [checkForUpdates, isLocalDev]);

    useEffect(() => {
        if (isLocalDev || !('serviceWorker' in navigator)) return;

        const handleControllerChange = () => {
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, [isLocalDev]);

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
    const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const forceUpdate = useCallback(async () => {
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
        }
        window.location.reload();
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
