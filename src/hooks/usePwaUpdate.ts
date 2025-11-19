import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerRegistrationWithUpdate extends ServiceWorkerRegistration {
    waiting: ServiceWorker | null;
}

export const usePwaUpdate = () => {
    const [newVersionAvailable, setNewVersionAvailable] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

    const handleUpdate = useCallback(() => {
        if (waitingWorker) {
            // Envia uma mensagem para o Service Worker esperando para pular a etapa 'waiting'
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            
            // Recarrega a página após o Service Worker ser ativado
            waitingWorker.addEventListener('statechange', (e) => {
                if ((e.target as ServiceWorker).state === 'activated') {
                    window.location.reload();
                }
            });
        }
    }, [waitingWorker]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                const reg = registration as ServiceWorkerRegistrationWithUpdate;

                // 1. Listener para o evento 'updatefound'
                reg.addEventListener('updatefound', () => {
                    const installingWorker = reg.installing;
                    if (installingWorker) {
                        installingWorker.addEventListener('statechange', () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // Nova versão instalada e esperando para ser ativada
                                setNewVersionAvailable(true);
                                setWaitingWorker(reg.waiting);
                                console.log('🔄 Nova versão do PWA disponível.');
                            }
                        });
                    }
                });

                // 2. Verifica se já existe um Service Worker esperando (caso o usuário tenha fechado e reaberto o app)
                if (reg.waiting) {
                    setNewVersionAvailable(true);
                    setWaitingWorker(reg.waiting);
                }
            });
            
            // 3. Listener para o evento 'controllerchange' (recarrega a página após a atualização forçada)
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    window.location.reload();
                    refreshing = true;
                }
            });
        }
    }, []);

    return { newVersionAvailable, handleUpdate };
};