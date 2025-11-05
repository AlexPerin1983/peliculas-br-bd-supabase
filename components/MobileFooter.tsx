import React, { useState } from 'react';

interface Totals {
    totalM2: number;
    subtotal: number;
    totalItemDiscount: number;
    generalDiscountAmount: number;
    finalTotal: number;
}

interface MobileFooterProps {
    totals: Totals;
    generalDiscount: { value: string; type: 'percentage' | 'fixed' };
    onOpenGeneralDiscountModal: () => void;
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    isGeneratingPdf: boolean;
    onOpenAIModal: () => void;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const MobileFooter: React.FC<MobileFooterProps> = ({
    totals,
    generalDiscount,
    onOpenGeneralDiscountModal,
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    isGeneratingPdf,
    onOpenAIModal
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const hasGeneralDiscount = !!(parseFloat(String(generalDiscount.value).replace(',', '.')) || 0);

    const SummaryRow: React.FC<{label: string; value: string, className?: string}> = ({label, value, className}) => (
        <div className={`flex justify-between items-center text-sm ${className}`}>
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
        </div>
    );
    
    const ActionButton: React.FC<{onClick: () => void, label: string, icon: string, isActive?: boolean}> = ({ onClick, label, icon, isActive = false }) => (
        <button onClick={onClick} aria-label={label} className={`flex flex-col items-center justify-center transition-colors w-16 h-full ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <i className={`${icon} text-xl h-6`}></i>
            <span className="text-[10px] mt-1 font-medium">{label}</span>
        </button>
    );

    const PdfActionButton = () => {
        if (isGeneratingPdf) {
            return (
                <div className="flex flex-col items-center justify-center w-16 h-full text-slate-500">
                     <div className="loader-sm"></div>
                     <span className="text-[10px] mt-1 font-medium">Gerando...</span>
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
        }
        return <ActionButton onClick={onGeneratePdf} label="Gerar PDF" icon="fas fa-file-pdf" />;
    };

    return (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-[0_-8px_20px_rgba(0,0,0,0.1)] border-t border-slate-200 z-30">
            <div className="container mx-auto px-2">
                {/* Expandable Content */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-80 opacity-100 p-4 border-b border-slate-200/80' : 'max-h-0 opacity-0 p-0'}`}>
                    <div className="space-y-1.5">
                        <SummaryRow label={`Subtotal (${totals.totalM2.toFixed(2)} m²)`} value={formatNumberBR(totals.subtotal)} />
                        {totals.totalItemDiscount > 0 && <SummaryRow label="Descontos (itens)" value={`-${formatNumberBR(totals.totalItemDiscount)}`} />}
                        {totals.generalDiscountAmount > 0 && <SummaryRow label="Desconto Geral" value={`-${formatNumberBR(totals.generalDiscountAmount)}`} />}
                         <div className="pt-1.5 mt-1.5 border-t border-slate-200">
                            <SummaryRow label="Total" value={formatNumberBR(totals.finalTotal)} className='text-base' />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <button 
                            onClick={onOpenGeneralDiscountModal}
                            className="w-full text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg py-2.5 transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-percent"></i> 
                            {hasGeneralDiscount ? 'Editar Desconto Geral' : 'Adicionar Desconto Geral'}
                        </button>
                    </div>
                </div>
                
                {/* Main Action Bar */}
                <div className="relative">
                    <div className="flex justify-around items-center h-16">
                        <ActionButton onClick={onOpenAIModal} label="com IA" icon="fas fa-robot" />
                        <ActionButton onClick={onDuplicateMeasurements} label="Duplicar" icon="fas fa-copy" />

                        {/* Floating Action Button */}
                        <div className="-translate-y-5">
                            <button
                                onClick={onAddMeasurement}
                                aria-label="Adicionar Nova Medida"
                                className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                            >
                                <i className="fas fa-plus text-xl"></i>
                            </button>
                        </div>

                        <ActionButton 
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                            label="Totais" 
                            icon="fas fa-dollar-sign"
                            isActive={isExpanded}
                        />
                        <PdfActionButton />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MobileFooter);