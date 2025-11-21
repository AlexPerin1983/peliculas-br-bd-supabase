import React from 'react';
import Modal from '../ui/Modal';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
}

const ErrorModal: React.FC<ErrorModalProps> = ({
    isOpen,
    onClose,
    message
}) => {
    const footer = (
        <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
            Fechar
        </button>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ops! Algo deu errado"
            footer={footer}
        >
            <div className="text-slate-600 flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <p className="text-base">{message}</p>
            </div>
        </Modal>
    );
};

export default ErrorModal;
