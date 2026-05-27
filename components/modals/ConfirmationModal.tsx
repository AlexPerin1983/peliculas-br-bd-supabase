import React, { ReactNode, useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: ReactNode;
    confirmButtonText?: string;
    cancelButtonText?: string;
    confirmButtonVariant?: 'danger' | 'primary';
    isProcessing?: boolean;
    processingText?: string;
    presentation?: 'modal' | 'drawer' | 'auto';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar',
    confirmButtonVariant = 'primary',
    isProcessing = false,
    processingText = 'Processando...',
    presentation = 'modal'
}) => {
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

        syncViewport();
        mediaQuery.addEventListener('change', syncViewport);

        return () => mediaQuery.removeEventListener('change', syncViewport);
    }, []);

    const shouldUseDrawer = presentation === 'drawer' || (presentation === 'auto' && isMobileViewport);

    const footer = (
        <>
            <ActionButton
                onClick={onClose}
                disabled={isProcessing}
                variant="ghost"
                size="md"
            >
                {cancelButtonText}
            </ActionButton>
            <ActionButton
                onClick={onConfirm}
                disabled={isProcessing}
                variant={confirmButtonVariant}
                size="md"
                loading={isProcessing}
                loadingText={processingText}
                className="min-w-[132px]"
            >
                {confirmButtonText}
            </ActionButton>
        </>
    );

    if (shouldUseDrawer) {
        return (
            <Drawer.Root
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open && !isProcessing) {
                        onClose();
                    }
                }}
            >
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm" />
                    <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[10001] flex max-h-[85vh] flex-col rounded-t-[28px] border-t border-slate-200 bg-white outline-none shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:left-1/2 sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-[28px]">
                        <div className="flex-shrink-0 px-5 pb-4 pt-3">
                            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <Drawer.Title className="text-lg font-semibold text-slate-900 dark:text-white">
                                {title}
                            </Drawer.Title>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 pb-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {message}
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/70">
                            <ActionButton
                                onClick={onConfirm}
                                disabled={isProcessing}
                                variant={confirmButtonVariant}
                                size="lg"
                                loading={isProcessing}
                                loadingText={processingText}
                                className="w-full"
                            >
                                {confirmButtonText}
                            </ActionButton>
                            <ActionButton
                                onClick={onClose}
                                disabled={isProcessing}
                                variant="ghost"
                                size="lg"
                                className="w-full"
                            >
                                {cancelButtonText}
                            </ActionButton>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={isProcessing ? () => {} : onClose}
            title={title}
            footer={footer}
            disableClose={isProcessing}
        >
            <div className="text-slate-600">
                {message}
            </div>
        </Modal>
    );
};

export default ConfirmationModal;
