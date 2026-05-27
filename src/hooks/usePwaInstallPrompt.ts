import { useState, useEffect, useCallback } from 'react';
import { useFeedback } from '../contexts/FeedbackContext';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
    prompt(): Promise<void>;
}

export const usePwaInstallPrompt = () => {
    const { showAlert } = useFeedback();
    const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [canInstall, setCanInstall] = useState(false);

    useEffect(() => {
        const checkIfInstalled = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIosStandalone = (navigator as any).standalone === true;
            const installed = isStandalone || isIosStandalone;

            setIsInstalled(installed);

            if (installed) {
                console.log('PWA ja esta instalado');
            }

            return installed;
        };

        const installed = checkIfInstalled();

        if (isLocalDev) {
            return;
        }

        if (!installed) {
            const handler = (event: Event) => {
                console.log('beforeinstallprompt event fired');
                event.preventDefault();
                setDeferredPrompt(event as BeforeInstallPromptEvent);
                setCanInstall(true);
            };

            window.addEventListener('beforeinstallprompt', handler);

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                    console.log('Service Worker esta ativo:', registration.active?.state);
                });
            }

            return () => {
                window.removeEventListener('beforeinstallprompt', handler);
            };
        }
    }, [isLocalDev]);

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) {
            console.warn('Prompt de instalação não disponível');

            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

            if (isIOS || isSafari) {
                showAlert({
                    title: 'Como instalar no Safari',
                    message: '1. Toque no botão "Compartilhar".\n2. Role para baixo e toque em "Adicionar à Tela de Início".\n3. Toque em "Adicionar".',
                    tone: 'info',
                    buttonText: 'Entendi'
                });
            } else {
                showAlert({
                    title: 'Como instalar o app',
                    message: '1. Abra o menu do navegador.\n2. Procure por "Instalar Películas Brasil" ou "Adicionar à tela inicial".\n3. Confirme a instalação.',
                    tone: 'info',
                    buttonText: 'Entendi'
                });
            }
            return;
        }

        try {
            console.log('Mostrando prompt de instalação...');
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            console.log(`Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação`);

            if (outcome === 'accepted') {
                setIsInstalled(true);
                setCanInstall(false);
            }

            setDeferredPrompt(null);
        } catch (error) {
            console.error('Erro ao mostrar prompt:', error);
        }
    }, [deferredPrompt, showAlert]);

    return {
        deferredPrompt,
        promptInstall,
        isInstalled,
        canInstall
    };
};
