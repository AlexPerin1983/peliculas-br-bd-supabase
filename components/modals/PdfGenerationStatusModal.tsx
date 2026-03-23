import React from 'react';

interface PdfGenerationStatusModalProps {
    status: 'generating' | 'success';
    onClose: () => void;
    onGoToHistory: () => void;
}

const PdfGenerationStatusModal: React.FC<PdfGenerationStatusModalProps> = ({ status, onClose, onGoToHistory }) => {
    if (status === 'generating') {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 text-center flex flex-col items-center">
                    <div className="loader mb-4"></div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Gerando Orçamento...</h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">Por favor, aguarde um momento.</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 text-center flex flex-col items-center max-w-sm w-full">
                    <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-check-circle text-4xl text-green-500 dark:text-green-400"></i>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Orçamento Gerado!</h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Seu PDF foi baixado. Você também pode encontrá-lo a qualquer momento na aba <strong>Histórico</strong>.
                    </p>
                    <div className="mt-6 w-full space-y-3">
                        <button
                            onClick={onGoToHistory}
                            className="w-full px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white text-base font-semibold rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                        >
                            Ver Histórico
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 text-sm font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
      <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .animate-fade-in {
                        animation: fade-in 0.2s ease-out forwards;
                    }
                `}</style>
            </div>
        );
    }

    return null;
};

export default PdfGenerationStatusModal;
