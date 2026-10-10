import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { useIsMobile } from '../../src/hooks/useIsMobile';

interface BottomSheetProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    /** Ações fixas embaixo (ex.: Editar / Excluir). */
    footer?: React.ReactNode;
    /** Largura da caixa no computador. */
    width?: 'sm' | 'md';
    bodyClassName?: string;
}

/**
 * Gaveta curta: no celular sobe de baixo só até a altura do conteúdo (arrastar fecha);
 * no computador vira uma caixa pequena no centro. Para menus de ações e fichas rápidas;
 * formulários longos continuam no Modal de tela cheia.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
    isOpen,
    title,
    subtitle,
    onClose,
    children,
    footer,
    width = 'sm',
    bodyClassName = 'mt-2 space-y-1',
}) => {
    const isMobile = useIsMobile();

    useEffect(() => {
        if (!isOpen || isMobile) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, isOpen, onClose]);

    const header = (
        <div className="min-w-0 px-2">
            <p className="truncate text-lg font-bold leading-tight text-[var(--text-strong)]">{title}</p>
            {subtitle ? <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
    );
    const footerBlock = footer ? <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">{footer}</div> : null;

    if (isMobile) {
        return (
            <Drawer.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[10020] bg-slate-950/50" />
                    <Drawer.Content
                        aria-describedby={undefined}
                        className="fixed bottom-0 left-0 right-0 z-[10021] flex max-h-[85dvh] flex-col rounded-t-[20px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none"
                    >
                        <div className="overflow-y-auto overscroll-contain px-3 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <Drawer.Title asChild>{header}</Drawer.Title>
                            <div className={bodyClassName}>{children}</div>
                            {footerBlock}
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/50 p-4">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`relative max-h-[90vh] w-full overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-2xl ${width === 'md' ? 'max-w-md' : 'max-w-sm'}`}
            >
                <div className="flex items-start justify-between gap-2">
                    {header}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
                <div className={bodyClassName}>{children}</div>
                {footerBlock}
            </div>
        </div>,
        document.body
    );
};

export default BottomSheet;
