import React, { useEffect, useState } from 'react';

interface PdfGenerationStatusModalProps {
    status: 'generating' | 'success';
    onClose: () => void;
    onGoToHistory: () => void;
    onShare: () => Promise<'shared' | 'downloaded' | 'unavailable'>;
    canShare: boolean;
}

const PdfGenerationStatusModal: React.FC<PdfGenerationStatusModalProps> = ({ status, onClose, onGoToHistory, onShare, canShare }) => {
    const [isSharing, setIsSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState('');

    useEffect(() => {
        if (status === 'generating') setShareMessage('');
    }, [status]);

    const handleShare = async () => {
        setIsSharing(true);
        setShareMessage('');
        try {
            const result = await onShare();
            setShareMessage(result === 'shared'
                ? 'PDF compartilhado com sucesso.'
                : result === 'downloaded'
                    ? 'Este navegador não anexa PDFs diretamente. O arquivo foi baixado para você enviar.'
                    : 'O PDF ainda não está disponível para compartilhar.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') setShareMessage('Não foi possível compartilhar. Tente novamente.');
        } finally {
            setIsSharing(false);
        }
    };
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
                        Seu PDF foi salvo e baixado. Agora você também pode compartilhá-lo diretamente com o cliente.
                    </p>
                    <div className="mt-6 w-full space-y-3">
                        <button
                            type="button"
                            onClick={() => { void handleShare(); }}
                            disabled={!canShare || isSharing}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-55"
                        >
                            <i className={`fas ${isSharing ? 'fa-spinner fa-spin' : 'fa-share-nodes'}`} aria-hidden="true"></i>
                            {isSharing ? 'Preparando...' : 'Compartilhar PDF'}
                        </button>
                        <button
                            onClick={onGoToHistory}
                            className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            Ver Histórico
                        </button>
                        {shareMessage ? <p role="status" className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{shareMessage}</p> : null}
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
