import React, { ReactNode } from 'react';
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
