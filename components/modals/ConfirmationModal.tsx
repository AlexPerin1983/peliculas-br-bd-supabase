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
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar',
    confirmButtonVariant = 'primary'
}) => {
    
    const confirmButtonClasses = {
        primary: 'bg-slate-800 text-white hover:bg-slate-700',
        danger: 'bg-red-600 text-white hover:bg-red-700'
    };

    const footer = (
        <>
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 transition-colors"
            >
                {cancelButtonText}
            </button>
            <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${confirmButtonClasses[confirmButtonVariant]}`}
            >
                {confirmButtonText}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
        >
            <div className="text-slate-600">
                {message}
            </div>
        </Modal>
    );
};

export default ConfirmationModal;