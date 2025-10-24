import React from 'react';
import Modal from '../ui/Modal';

interface PwaInstallPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInstall: () => void;
}

const PwaInstallPromptModal: React.FC<PwaInstallPromptModalProps> = ({ isOpen, onClose, onInstall }) => {
    
    const footer = (
        <>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Agora Não
            </button>
            <button
                onClick={onInstall}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                <i className="fas fa-download mr-2"></i>
                Instalar Aplicativo
            </button>
        </>
    );

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Instalar como Aplicativo" 
            footer={footer}
        >
            <div className="text-center space-y-4">
                <img 
                    src="/icon-512x512.png" 
                    alt="Ícone do Aplicativo" 
                    className="w-20 h-20 mx-auto rounded-xl shadow-lg"
                />
                <h3 className="text-xl font-bold text-slate-800">Películas Brasil</h3>
                <p className="text-slate-600">
                    Instale esta ferramenta diretamente no seu dispositivo para acesso rápido e uso offline, como um aplicativo nativo.
                </p>
                <div className="flex justify-center gap-4 text-slate-500 text-sm">
                    <div className="flex items-center gap-1">
                        <i className="fas fa-mobile-alt"></i>
                        <span>Acesso Rápido</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <i className="fas fa-wifi"></i>
                        <span>Funciona Offline</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default PwaInstallPromptModal;