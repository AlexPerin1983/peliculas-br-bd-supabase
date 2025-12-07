import React from 'react';
import Modal from '../ui/Modal';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
}

const InfoModal: React.FC<InfoModalProps> = ({
    isOpen,
    onClose,
    title = "Atenção",
    message
}) => {
    const footer = (
        <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
            OK
        </button>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
            wrapperClassName="z-[100]"
        >
            <div className="text-slate-600 flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <i className="fas fa-info text-blue-600 text-xl"></i>
                </div>
                <p className="text-base">{message}</p>
            </div>
        </Modal>
    );
};

export default InfoModal;
