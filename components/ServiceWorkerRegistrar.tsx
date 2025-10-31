import React, { useEffect } from 'react';

const ServiceWorkerRegistrar: React.FC = () => {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Pequeno atraso para garantir que o ambiente de desenvolvimento esteja estável
            const timer = setTimeout(() => {
                navigator.serviceWorker.register('/service-worker.js', { 
                    scope: '/'
                })
                    .then(registration => {
                        console.log('✅ Service Worker registrado:', registration.scope);
                        
                        // Check for updates
                        registration.update();
                        
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            console.log('🔄 Nova versão do Service Worker encontrada');
                            
                            if (newWorker) {
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'activated') {
                                        console.log('✅ Service Worker ativado');
                                    }
                                });
                            }
                        });
                    })
                    .catch(error => {
                        console.error('❌ Falha ao registrar Service Worker:', error);
                    });
            }, 500); // Pequeno atraso
            
            return () => clearTimeout(timer);
        } else {
            console.warn('⚠️ Service Workers não são suportados neste navegador');
        }
    }, []);

    return null;
};

export default ServiceWorkerRegistrar;