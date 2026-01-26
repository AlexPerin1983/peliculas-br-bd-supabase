import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Zap } from 'lucide-react';

interface UpdateBannerProps {
    onDismiss?: () => void;
}

/**
 * Componente que detecta atualizações do Service Worker e mostra um banner amigável
 * para que usuários leigos possam atualizar o app com um clique
 */
const UpdateBanner: React.FC<UpdateBannerProps> = ({ onDismiss }) => {
    const [showBanner, setShowBanner] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateReady, setUpdateReady] = useState(false);

    // Função para forçar atualização do app
    const handleUpdate = useCallback(async () => {
        setIsUpdating(true);

        try {
            // 1. Limpa todos os caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('[UpdateBanner] Todos os caches limpos');
            }

            // 2. Se há um service worker esperando, ativa ele
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration?.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // 3. Força recarga completa da página (sem cache)
            setTimeout(() => {
                window.location.reload();
            }, 500);

        } catch (error) {
            console.error('[UpdateBanner] Erro ao atualizar:', error);
            // Mesmo com erro, tenta recarregar
            window.location.reload();
        }
    }, []);

    // Função para verificar atualizações
    const checkForUpdates = useCallback(async () => {
        if (!('serviceWorker' in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.getRegistration();

            if (registration) {
                // Força verificação de atualização
                await registration.update();

                // Se há um worker esperando, mostra o banner
                if (registration.waiting) {
                    console.log('[UpdateBanner] Nova versão detectada (waiting)');
                    setShowBanner(true);
                    setUpdateReady(true);
                }

                // Escuta quando um novo worker está instalado
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('[UpdateBanner] Nova versão sendo instalada...');

                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[UpdateBanner] Nova versão pronta!');
                            setShowBanner(true);
                            setUpdateReady(true);
                        }
                    });
                });
            }
        } catch (error) {
            console.error('[UpdateBanner] Erro ao verificar atualizações:', error);
        }
    }, []);

    // Escuta mensagens do Service Worker
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SW_UPDATED') {
                console.log('[UpdateBanner] Service Worker atualizado para:', event.data.version);
                // Se o SW foi atualizado enquanto a página estava aberta, mostra banner
                setShowBanner(true);
                setUpdateReady(true);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Verifica atualizações ao montar
        checkForUpdates();

        // Verifica periodicamente (a cada 5 minutos)
        const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            clearInterval(interval);
        };
    }, [checkForUpdates]);

    // Escuta quando o controlador muda (novo SW assumiu)
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleControllerChange = () => {
            console.log('[UpdateBanner] Controlador mudou, recarregando...');
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    const handleDismiss = () => {
        setShowBanner(false);
        onDismiss?.();
    };

    if (!showBanner) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-slideDown">
            <div className="max-w-lg mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-2xl shadow-2xl shadow-blue-500/30 overflow-hidden">
                <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                        {/* Ícone animado */}
                        <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-yellow-300 animate-pulse" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-base sm:text-lg">
                                Nova versão disponível! 🎉
                            </h3>
                            <p className="text-blue-100 text-sm mt-1">
                                Atualize agora para ter acesso às melhorias mais recentes.
                            </p>

                            {/* Botões */}
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

                        {/* Botão fechar (desktop) */}
                        <button
                            onClick={handleDismiss}
                            className="hidden sm:flex flex-shrink-0 w-8 h-8 items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Barra de progresso animada */}
                {updateReady && (
                    <div className="h-1 bg-white/20">
                        <div className="h-full bg-yellow-400 animate-pulse" style={{ width: '100%' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

// Exporta também um hook para uso em outros componentes
export const useServiceWorkerUpdate = () => {
    const [hasUpdate, setHasUpdate] = useState(false);

    const forceUpdate = useCallback(async () => {
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
        }
        window.location.reload();
    }, []);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const checkUpdate = async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg?.waiting) {
                setHasUpdate(true);
            }
        };

        checkUpdate();
    }, []);

    return { hasUpdate, forceUpdate };
};

export default UpdateBanner;
