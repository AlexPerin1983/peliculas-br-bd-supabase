import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    wrapperClassName?: string;
    disableClose?: boolean;
    fullScreenOnMobile?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, wrapperClassName, disableClose = false, fullScreenOnMobile = false }) => {
    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className={`fixed inset-0 z-[10000] flex bg-slate-950/68 backdrop-blur-md transition-opacity duration-300 ease-in-out ${fullScreenOnMobile ? 'items-stretch justify-center p-0 sm:items-center sm:justify-center sm:p-4' : 'items-center justify-center p-4'} ${wrapperClassName || ''}`}>
            <div className={`flex w-full transform flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--shadow-elevated)] transition-transform duration-300 ease-in-out ${fullScreenOnMobile ? 'h-full max-h-full max-w-full rounded-none sm:mx-0 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-[var(--radius-panel)] sm:border sm:border-[var(--border-subtle)]' : 'max-h-[90vh] max-w-xl scale-100 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] sm:mx-0'}`}>
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
                <div className={`space-y-6 overflow-y-auto bg-[var(--surface)] p-5 text-[var(--text-body)] ${fullScreenOnMobile ? 'flex-1 sm:max-h-[70vh] sm:flex-none' : 'max-h-[70vh]'}`}>
                    {children}
                </div>
                {footer && (
                    <div className={`flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 ${fullScreenOnMobile ? 'pb-[max(16px,env(safe-area-inset-bottom))] sm:pb-4' : ''}`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
