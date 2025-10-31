import React from 'react';

interface ActionsBarProps {
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    isGeneratingPdf: boolean;
    onOpenAIMeasurementModal: () => void;
}

const ActionsBar: React.FC<ActionsBarProps> = ({
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    isGeneratingPdf,
    onOpenAIMeasurementModal
}) => {
    const baseButton = "w-full p-4 rounded-lg transition duration-300 shadow-md font-semibold text-sm flex items-center justify-center";
    
    return (
        <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onAddMeasurement} className={`${baseButton} bg-slate-800 text-white hover:bg-slate-700`}>
                Adicionar Medida
            </button>
            <button onClick={onOpenAIMeasurementModal} className={`${baseButton} bg-slate-800 text-white hover:bg-slate-700`}>
                <i className="fas fa-robot mr-2"></i> com IA
            </button>
            <button onClick={onDuplicateMeasurements} className={`${baseButton} bg-slate-200 text-slate-700 hover:bg-slate-300`}>
                Duplicar Medidas
            </button>
            <button 
                onClick={onGeneratePdf} 
                className={`${baseButton} bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-500 disabled:cursor-wait`}
                disabled={isGeneratingPdf}
            >
                {isGeneratingPdf ? <span className="loader-sm"></span> : 'Gerar PDF'}
            </button>
            <style jsx>{`
                .loader-sm {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #3498db;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
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