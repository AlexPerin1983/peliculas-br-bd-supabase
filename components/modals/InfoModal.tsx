import React from 'react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    message: React.ReactNode;
    tone?: 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
}

const toneConfig = {
    info: {
        iconWrap: 'bg-blue-100 dark:bg-blue-900/30',
        icon: 'fas fa-info text-blue-600 dark:text-blue-400'
    },
    success: {
        iconWrap: 'bg-emerald-100 dark:bg-emerald-900/30',
        icon: 'fas fa-check text-emerald-600 dark:text-emerald-400'
    },
    warning: {
        iconWrap: 'bg-amber-100 dark:bg-amber-900/30',
        icon: 'fas fa-exclamation-triangle text-amber-600 dark:text-amber-400'
    },
    error: {
        iconWrap: 'bg-red-100 dark:bg-red-900/30',
        icon: 'fas fa-exclamation-circle text-red-600 dark:text-red-400'
    }
} as const;

const InfoModal: React.FC<InfoModalProps> = ({
    isOpen,
    onClose,
    title = 'Atencao',
    message,
    tone = 'info',
    buttonText = 'OK'
}) => {
    const toneStyle = toneConfig[tone];

    const footer = (
        <ActionButton
            onClick={onClose}
            variant="primary"
            size="md"
            className="w-full sm:w-auto min-w-[120px]"
        >
            {buttonText}
        </ActionButton>
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${toneStyle.iconWrap}`}>
                    <i className={`${toneStyle.icon} text-xl`}></i>
                </div>
                <div className="text-base whitespace-pre-line">{message}</div>
            </div>
        </Modal>
    );
};

export default InfoModal;
