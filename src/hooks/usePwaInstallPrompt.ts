import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
    prompt(): Promise<void>;
}

export const usePwaInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [canInstall, setCanInstall] = useState(false);

    useEffect(() => {
        // Check if already installed
        const checkIfInstalled = () => {
            // Check for standalone mode (installed PWA)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIosStandalone = (navigator as any).standalone === true;
            const isInstalled = isStandalone || isIosStandalone;
            
            setIsInstalled(isInstalled);
            
            if (isInstalled) {
                console.log('✅ PWA já está instalado');
            }
            
            return isInstalled;
        };

        const installed = checkIfInstalled();

        // Only listen for install prompt if not already installed
        if (!installed) {
            const handler = (e: Event) => {
                console.log('📱 beforeinstallprompt event fired');
                e.preventDefault();
                setDeferredPrompt(e as BeforeInstallPromptEvent);
                setCanInstall(true);
            };

            window.addEventListener('beforeinstallprompt', handler);

            // For debugging: check if service worker is registered
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                    console.log('✅ Service Worker está ativo:', registration.active?.state);
                });
            }

            return () => {
                window.removeEventListener('beforeinstallprompt', handler);
            };
        }
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) {
            console.warn('⚠️ Prompt de instalação não disponível');
            
            // Detect browser and provide specific instructions
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            
            if (isIOS || isSafari) {
                alert('Para instalar no Safari/iOS:\n\n1. Toque no botão "Compartilhar" (ícone de quadrado com seta)\n2. Role para baixo e toque em "Adicionar à Tela de Início"\n3. Toque em "Adicionar"');
            } else {
                alert('Para instalar:\n\n1. Clique no menu do navegador (⋮)\n2. Procure por "Instalar Películas Brasil" ou "Adicionar à tela inicial"\n3. Confirme a instalação');
            }
            return;
        }

        try {
            console.log('📱 Mostrando prompt de instalação...');
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            console.log(`👤 Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação`);
            
            if (outcome === 'accepted') {
                setIsInstalled(true);
                setCanInstall(false);
            }
            
            setDeferredPrompt(null);
        } catch (error) {
            console.error('❌ Erro ao mostrar prompt:', error);
        }
    }, [deferredPrompt]);

    return { 
        deferredPrompt, 
        promptInstall, 
        isInstalled,
        canInstall 
    };
};