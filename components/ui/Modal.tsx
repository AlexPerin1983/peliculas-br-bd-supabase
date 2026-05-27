import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    wrapperClassName?: string;
    disableClose?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, wrapperClassName, disableClose = false }) => {
    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/68 p-4 backdrop-blur-md transition-opacity duration-300 ease-in-out ${wrapperClassName || ''}`}>
            <div className="flex max-h-[90vh] w-full max-w-xl scale-100 transform flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-elevated)] transition-transform duration-300 ease-in-out sm:mx-0">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-4">
                    <div className="min-w-0">
                        <p className="ui-kicker">Configurar</p>
                        <h2 className="mt-1 min-w-0 flex-grow text-xl font-bold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">{title}</h2>
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
        </div>
    );
};

export default Modal;
