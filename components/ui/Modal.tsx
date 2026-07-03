import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { useIsMobile } from '../../src/hooks/useIsMobile';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    wrapperClassName?: string;
    disableClose?: boolean;
    /**
     * Mantido por compatibilidade. No mobile todos os modais já abrem como
     * bottom sheet em tela cheia (com alça + arrastar para fechar), então esta
     * flag não muda mais o comportamento — fica só para não quebrar chamadas.
     */
    fullScreenOnMobile?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, wrapperClassName, disableClose = false }) => {
    const isMobile = useIsMobile();

    if (typeof document === 'undefined') return null;

    // Mobile: bottom sheet em tela cheia, com alça e fechar arrastando para baixo
    // (padrão popularizado pelo iOS). Mesma base do Totais/ConfirmationModal.
    if (isMobile) {
        return (
            <Drawer.Root
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open && !disableClose) {
                        onClose();
                    }
                }}
                dismissible={!disableClose}
                // O sheet é sempre tela cheia (h-[100dvh]) e o teclado só encolhe o
                // visual viewport, então o reposicionamento automático do vaul não
                // ajuda — e ainda deixa uma altura inline "presa" no Drawer.Content
                // quando o teclado é aberto por um overlay externo (ex.: o seletor de
                // cliente do SearchableSelect), fazendo o modal ficar cortado ao meio
                // depois que o teclado some. Desligar mantém o sheet em tela cheia.
                repositionInputs={false}
            >
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[10000] bg-slate-950/68 backdrop-blur-md" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 right-0 z-[10001] flex h-[100dvh] max-h-[100dvh] flex-col border-t border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] outline-none"
                        onInteractOutside={(event) => {
                            // Menus/dropdowns portalados para o body (ex.: PickerField) ficam
                            // fora do Drawer.Content; tocar neles não deve fechar o sheet.
                            const target = event.target as HTMLElement | null;
                            if (target?.closest('[data-modal-companion]')) {
                                event.preventDefault();
                            }
                        }}
                    >
                        <div
                            className="flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 pb-3"
                            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
                        >
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
                            <div className="flex items-start justify-between gap-4">
                                <Drawer.Title className="min-w-0 flex-grow text-xl font-bold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">
                                    {title}
                                </Drawer.Title>
                                <button
                                    onClick={onClose}
                                    disabled={disableClose}
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Fechar"
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 space-y-6 overflow-y-auto bg-[var(--surface)] p-5">
                            {children}
                        </div>
                        {footer && (
                            <div
                                className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"
                                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                            >
                                {footer}
                            </div>
                        )}
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    // Desktop: diálogo centralizado (inalterado).
    if (!isOpen) return null;

    return createPortal(
        <div className={`pointer-events-auto fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/68 p-4 backdrop-blur-md transition-opacity duration-300 ease-in-out ${wrapperClassName || ''}`}>
            <div className="flex w-full max-h-[90vh] max-w-xl scale-100 transform flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-elevated)] transition-transform duration-300 ease-in-out sm:mx-0">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-4">
                    <div className="min-w-0">
                        <h2 className="min-w-0 flex-grow text-xl font-bold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={disableClose}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
                <div className="max-h-[70vh] space-y-6 overflow-y-auto bg-[var(--surface)] p-5 text-[var(--text-body)]">
                    {children}
                </div>
                {footer && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
