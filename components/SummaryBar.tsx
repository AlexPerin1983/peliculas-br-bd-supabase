import React from 'react';

interface Totals {
    totalM2: number;
    subtotal: number;
    totalItemDiscount: number;
    generalDiscountAmount: number;
    finalTotal: number;
}

interface SummaryBarProps {
    totals: Totals;
    generalDiscount: { value: string; type: 'percentage' | 'fixed' };
    onOpenGeneralDiscountModal: () => void;
    isDesktop?: boolean;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const SummaryBar: React.FC<SummaryBarProps> = ({ totals, generalDiscount, onOpenGeneralDiscountModal, isDesktop = false }) => {
    
    const hasGeneralDiscount = !!(parseFloat(String(generalDiscount.value).replace(',', '.')) || 0);

    const SummaryRow: React.FC<{label: string; value: string, className?: string}> = ({label, value, className}) => (
        <div className={`flex justify-between items-center text-sm ${className}`}>
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
        </div>
    );

    const TotalsBlock = ({ isMobile }: { isMobile?: boolean }) => (
        <div className={`space-y-1.5 ${isMobile ? 'p-3 bg-slate-100 rounded-lg' : 'pt-1'}`}>
            <SummaryRow label={`Subtotal (${totals.totalM2.toFixed(2)} m²)`} value={formatNumberBR(totals.subtotal)} />
            {totals.totalItemDiscount > 0 && <SummaryRow label="Descontos (itens)" value={`-${formatNumberBR(totals.totalItemDiscount)}`} />}
            {totals.generalDiscountAmount > 0 && <SummaryRow label="Desconto Geral" value={`-${formatNumberBR(totals.generalDiscountAmount)}`} />}
            <div className={`pt-1.5 mt-1.5 border-t ${isMobile ? 'border-slate-200/80' : 'border-slate-200'}`}>
                <SummaryRow label="Total" value={formatNumberBR(totals.finalTotal)} className={isMobile ? 'text-base' : 'text-lg'} />
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <div className="grid grid-cols-2 gap-x-8 items-start mb-4">
                <div>
                    <button 
                        onClick={onOpenGeneralDiscountModal}
                        className="text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 transition-colors duration-200 flex items-center gap-2"
                    >
                        <i className="fas fa-percent"></i> 
                        {hasGeneralDiscount ? 'Editar Desconto Geral' : 'Adicionar Desconto Geral'}
                    </button>
                </div>
                <TotalsBlock />
            </div>
        );
    }

    // Mobile layout
    return (
        <div className="space-y-3">
            <TotalsBlock isMobile />
            <button 
                onClick={onOpenGeneralDiscountModal}
                className="w-full text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 transition-colors duration-200 flex items-center justify-center gap-2"
            >
                <i className="fas fa-percent"></i> 
                {hasGeneralDiscount ? 'Editar Desconto Geral' : 'Adicionar Desconto Geral'}
            </button>
        </div>
    );
};

export default React.memo(SummaryBar);