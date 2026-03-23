import React, { ReactNode } from 'react';
import Modal from '../ui/Modal';

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
    processingText = 'Processando...'
}) => {
    
    const confirmButtonClasses = {
        primary: 'bg-slate-800 text-white hover:bg-slate-700',
        danger: 'bg-red-600 text-white hover:bg-red-700'
    };

    const footer = (
        <>
            <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {cancelButtonText}
            </button>
            <button
                onClick={onConfirm}
                disabled={isProcessing}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors min-w-[132px] inline-flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed ${confirmButtonClasses[confirmButtonVariant]}`}
            >
                {isProcessing && <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>}
                <span>{isProcessing ? processingText : confirmButtonText}</span>
            </button>
        </>
    );

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
