import React, { useState } from 'react';
import { TotalsDrawer } from './ui/TotalsDrawer';

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
    onUpdateGeneralDiscount: (value: { value: string; type: 'percentage' | 'fixed' }) => void;
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    isGeneratingPdf: boolean;
    onOpenAIModal: () => void;
}

const MobileFooter: React.FC<MobileFooterProps> = ({
    totals,
    generalDiscount,
    onOpenGeneralDiscountModal,
    onUpdateGeneralDiscount,
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    isGeneratingPdf,
    onOpenAIModal
}) => {
    const [isTotalsDrawerOpen, setIsTotalsDrawerOpen] = useState(false);

    const ActionButton: React.FC<{ onClick: () => void, label: string, icon: string, isActive?: boolean }> = ({ onClick, label, icon, isActive = false }) => (
        <button
            onClick={onClick}
            aria-label={label}
            className={`flex flex-col items-center justify-center transition-all duration-300 w-14 h-12 rounded-xl group ${isActive
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
            <i className={`${icon} text-lg transition-transform duration-300 group-active:scale-90`}></i>
            <span className="text-[9px] mt-1 font-bold uppercase tracking-wider">{label}</span>
        </button>
    );

    const PdfActionButton = () => {
        if (isGeneratingPdf) {
            return (
                <div className="flex flex-col items-center justify-center w-14 h-12 text-blue-600 dark:text-blue-400">
                    <div className="loader-xs"></div>
                    <span className="text-[9px] mt-1 font-bold uppercase tracking-wider">...</span>
                    <style jsx>{`
                        .loader-xs {
                            border: 2px solid rgba(59, 130, 246, 0.1);
                            border-top: 2px solid currentColor;
                            border-radius: 50%;
                            width: 16px;
                            height: 16px;
                            animation: spin 0.8s linear infinite;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                     `}</style>
                </div>
            );
        }
        return <ActionButton onClick={onGeneratePdf} label="PDF" icon="fas fa-file-pdf" />;
    };

    const handleUpdateDiscount = (value: string, type: 'percentage' | 'fixed') => {
        onUpdateGeneralDiscount({ value, type });
    };

    return (
        <>
            <div className="sm:hidden fixed bottom-4 left-4 right-4 z-40">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/20 dark:border-slate-800/50 rounded-2xl px-2 py-2">
                    <div className="flex justify-between items-center relative">
                        <div className="flex gap-1">
                            <ActionButton onClick={onOpenAIModal} label="IA" icon="fas fa-robot" />
                            <ActionButton onClick={onDuplicateMeasurements} label="Cópia" icon="fas fa-copy" />
                        </div>

                        {/* Floating Action Button (FAB) */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-10">
                            <button
                                onClick={onAddMeasurement}
                                aria-label="Adicionar Nova Medida"
                                className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-950 dark:from-slate-700 dark:to-slate-900 text-white rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] transition-all duration-300 transform hover:-translate-y-1 active:scale-95 border-4 border-white dark:border-slate-900"
                            >
                                <i className="fas fa-plus text-2xl"></i>
                            </button>
                        </div>

                        <div className="flex gap-1">
                            <ActionButton
                                onClick={() => setIsTotalsDrawerOpen(true)}
                                label="Totais"
                                icon="fas fa-dollar-sign"
                                isActive={isTotalsDrawerOpen}
                            />
                            <PdfActionButton />
                        </div>
                    </div>
                </div>
            </div>

            <TotalsDrawer
                isOpen={isTotalsDrawerOpen}
                onClose={() => setIsTotalsDrawerOpen(false)}
                totals={totals}
                generalDiscount={generalDiscount}
                onUpdateGeneralDiscount={handleUpdateDiscount}
            />
        </>
    );
};

export default React.memo(MobileFooter);