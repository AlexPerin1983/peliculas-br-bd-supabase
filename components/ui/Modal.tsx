import React, { ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ease-in-out z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl transform transition-transform duration-300 ease-in-out max-w-lg w-full mx-4 sm:mx-0 scale-100 flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-800 flex-grow min-w-0">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 focus:outline-none h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 flex-shrink-0 ml-2">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>
                {footer && (
                    <div className="flex justify-end items-center p-4 border-t border-slate-200 bg-slate-50 space-x-3 rounded-b-lg">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;