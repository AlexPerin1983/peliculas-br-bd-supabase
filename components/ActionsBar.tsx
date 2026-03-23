import React from 'react';

interface ActionsBarProps {
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    isGeneratingPdf: boolean;
    onOpenAIModal: () => void;
}

const ActionsBar: React.FC<ActionsBarProps> = ({
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    isGeneratingPdf,
    onOpenAIModal
}) => {
    return (
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3">
            {/* Adicionar Medida - Primary Action */}
            <button
                onClick={onAddMeasurement}
                className="col-span-2 sm:col-span-1 sm:flex-1 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 p-4 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-semibold"
            >
                <i className="fas fa-plus"></i>
                <span>Adicionar Medida</span>
            </button>

            {/* IA Action */}
            <button
                onClick={onOpenAIModal}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 p-4 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-semibold"
            >
                <i className="fas fa-magic"></i>
                <span>Com IA</span>
            </button>

            {/* Duplicar Action */}
            <button
                onClick={onDuplicateMeasurements}
                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 p-4 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-semibold"
            >
                <i className="far fa-copy"></i>
                <span>Duplicar</span>
            </button>

            {/* Gerar PDF Action */}
            <button
                onClick={onGeneratePdf}
                className="col-span-2 sm:col-span-1 sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700 p-4 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-semibold disabled:opacity-70 disabled:cursor-wait"
                disabled={isGeneratingPdf}
            >
                {isGeneratingPdf ? (
                    <>
                        <span className="loader-sm"></span>
                        <span>Gerando...</span>
                    </>
                ) : (
                    <>
                        <i className="fas fa-file-pdf"></i>
                        <span>Gerar PDF</span>
                    </>
                )}
            </button>

            <style>{`
                .loader-sm {
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top: 2px solid #ffffff;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default React.memo(ActionsBar);
