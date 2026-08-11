import React, { ReactNode, useEffect, useId, useRef, useState } from 'react';
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
    /** Mantém as ações do rodapé acessíveis logo acima do teclado virtual. */
    keyboardAwareFooter?: boolean;
    /**
     * Mantido por compatibilidade. No mobile todos os modais já abrem como
     * bottom sheet em tela cheia (com alça + arrastar para fechar), então esta
     * flag não muda mais o comportamento — fica só para não quebrar chamadas.
     */
    fullScreenOnMobile?: boolean;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    wrapperClassName,
    disableClose = false,
    keyboardAwareFooter = false,
}) => {
    const isMobile = useIsMobile();
    const scrollRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    const disableCloseRef = useRef(disableClose);
    const titleId = useId();
    const [mobileViewport, setMobileViewport] = useState<{ top: number; height: number } | null>(null);

    onCloseRef.current = onClose;
    disableCloseRef.current = disableClose;

    // No desktop, mantém o foco dentro do diálogo e permite fechar com Escape.
    useEffect(() => {
        if (isMobile || !isOpen) return;

        const focusFrame = window.requestAnimationFrame(() => {
            const dialog = dialogRef.current;
            if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
        });
        const onDocumentKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || disableCloseRef.current) return;
            event.preventDefault();
            onCloseRef.current();
        };

        document.addEventListener('keydown', onDocumentKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', onDocumentKeyDown);
        };
    }, [isMobile, isOpen]);

    // Mantém o campo em foco visível acima do teclado. Nos modais cujo rodapé
    // precisa continuar acessível, o próprio Drawer é redimensionado pelo vaul;
    // aqui cuidamos apenas do scroll do conteúdo, sem deslocar o footer isolado.
    useEffect(() => {
        if (!isOpen || (!isMobile && !keyboardAwareFooter)) return;
        const container = scrollRef.current;
        const vv = window.visualViewport;
        if (!container) return;

        const getViewport = () => ({
            top: vv?.offsetTop ?? 0,
            height: vv?.height ?? window.innerHeight,
        });
        const keyboardHeight = () => {
            const viewport = getViewport();
            return Math.max(0, window.innerHeight - viewport.height - viewport.top);
        };
        const isFormControl = (target: HTMLElement | null): target is HTMLElement => (
            !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
        );

        const syncKeyboardSpace = () => {
            const kb = keyboardHeight();
            // Quando o vaul redimensiona o Drawer, a região rolável já encolhe
            // junto com ele. O padding manual continua apenas no fluxo legado.
            container.style.paddingBottom = !keyboardAwareFooter && kb > 120 ? `${kb}px` : '';
        };

        const ensureVisible = (el: HTMLElement) => {
            const top = container.getBoundingClientRect().top + 12;
            const viewport = getViewport();
            const viewportBottom = viewport.top + viewport.height;
            const bottom = Math.min(viewportBottom, container.getBoundingClientRect().bottom) - 12;
            const rect = el.getBoundingClientRect();
            if (rect.bottom > bottom) container.scrollTop += rect.bottom - bottom;
            else if (rect.top < top) container.scrollTop -= top - rect.top;
        };

        let disposed = false;
        let focusTimer: number | undefined;
        let ensureFrame: number | undefined;

        const scheduleEnsureVisible = (target: HTMLElement) => {
            if (ensureFrame !== undefined) window.cancelAnimationFrame(ensureFrame);
            ensureFrame = window.requestAnimationFrame(() => {
                ensureFrame = undefined;
                if (!disposed && document.contains(target)) ensureVisible(target);
            });
        };

        const syncViewport = () => {
            syncKeyboardSpace();
            const activeElement = document.activeElement as HTMLElement | null;
            if (isFormControl(activeElement) && container.contains(activeElement)) {
                scheduleEnsureVisible(activeElement);
            }
        };

        const onFocusIn = (event: FocusEvent) => {
            const target = event.target as HTMLElement | null;
            if (!isFormControl(target)) return;
            syncViewport();
            scheduleEnsureVisible(target);
            if (focusTimer !== undefined) window.clearTimeout(focusTimer);
            // Fallback para navegadores que não emitem todos os frames da abertura.
            focusTimer = window.setTimeout(() => {
                if (disposed) return;
                syncViewport();
                scheduleEnsureVisible(target);
            }, 450);
        };

        container.addEventListener('focusin', onFocusIn);
        vv?.addEventListener('resize', syncViewport);
        vv?.addEventListener('scroll', syncViewport);
        window.addEventListener('resize', syncViewport);
        syncViewport();
        return () => {
            disposed = true;
            container.removeEventListener('focusin', onFocusIn);
            vv?.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('scroll', syncViewport);
            window.removeEventListener('resize', syncViewport);
            if (focusTimer !== undefined) window.clearTimeout(focusTimer);
            if (ensureFrame !== undefined) window.cancelAnimationFrame(ensureFrame);
            container.style.paddingBottom = '';
        };
    }, [isMobile, isOpen, keyboardAwareFooter]);

    // Fallback para navegadores que ignoram interactive-widget=resizes-content:
    // enquadra o sheet inteiro na área visual, como já fazemos no seletor mobile.
    useEffect(() => {
        if (!isOpen || !keyboardAwareFooter) {
            setMobileViewport(null);
            return;
        }

        const vv = window.visualViewport;

        const syncViewportFrame = () => {
            const nextViewport = {
                top: vv?.offsetTop ?? 0,
                height: vv?.height ?? window.innerHeight,
            };
            setMobileViewport((currentViewport) => (
                currentViewport
                && currentViewport.top === nextViewport.top
                && currentViewport.height === nextViewport.height
                    ? currentViewport
                    : nextViewport
            ));
        };

        syncViewportFrame();
        vv?.addEventListener('resize', syncViewportFrame);
        vv?.addEventListener('scroll', syncViewportFrame);
        window.addEventListener('resize', syncViewportFrame);
        return () => {
            vv?.removeEventListener('resize', syncViewportFrame);
            vv?.removeEventListener('scroll', syncViewportFrame);
            window.removeEventListener('resize', syncViewportFrame);
        };
    }, [isMobile, isOpen, keyboardAwareFooter]);

    const handleDesktopKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return;

        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
            'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        )).filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0);

        if (focusableElements.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
            event.preventDefault();
            first.focus();
        }
    };

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
                // O enquadramento pelo visualViewport acima é atualizado também
                // quando o teclado fecha, evitando a altura inline presa do vaul.
                repositionInputs={false}
            >
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[10000] bg-slate-950/68 backdrop-blur-md" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 right-0 z-[10001] flex h-[100dvh] max-h-[100dvh] flex-col border-t border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] outline-none"
                        style={mobileViewport ? {
                            top: `${mobileViewport.top}px`,
                            bottom: 'auto',
                            height: `${mobileViewport.height}px`,
                            maxHeight: `${mobileViewport.height}px`,
                        } : undefined}
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
                        <div ref={scrollRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-[var(--surface)] p-5">
                            {children}
                        </div>
                        {footer && (
                            <div
                                className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"
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

    // Desktop e viewports largas: diálogo centralizado.
    if (!isOpen) return null;

    return createPortal(
        <div
            className={`pointer-events-auto fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/68 p-4 backdrop-blur-md transition-opacity duration-300 ease-in-out ${wrapperClassName || ''}`}
            style={mobileViewport ? {
                top: `${mobileViewport.top}px`,
                bottom: 'auto',
                height: `${mobileViewport.height}px`,
            } : undefined}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={handleDesktopKeyDown}
                className="flex w-full max-h-[90vh] max-w-xl scale-100 transform flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-elevated)] outline-none transition-transform duration-300 ease-in-out sm:mx-0"
                style={mobileViewport ? { maxHeight: '90%' } : undefined}
            >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="min-w-0 flex-grow text-xl font-bold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">{title}</h2>
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
                <div ref={scrollRef} className="min-h-0 max-h-[70vh] space-y-6 overflow-y-auto bg-[var(--surface)] p-5 text-[var(--text-body)]">
                    {children}
                </div>
                {footer && (
                    <div className="relative z-10 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
