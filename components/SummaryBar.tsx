
import React, { useState, useEffect } from 'react';

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
    onGeneralDiscountChange: (discount: { value: string; type: 'percentage' | 'fixed' }) => void;
    isDesktop?: boolean;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const SummaryBar: React.FC<SummaryBarProps> = ({ totals, generalDiscount, onGeneralDiscountChange, isDesktop = false }) => {
    
    const hasExistingDiscount = !!(parseFloat(String(generalDiscount.value).replace(',', '.')) || 0);
    const [showDiscountControls, setShowDiscountControls] = useState(hasExistingDiscount);
    
    useEffect(() => {
        setShowDiscountControls(!!(parseFloat(String(generalDiscount.value).replace(',', '.')) || 0));
    }, [generalDiscount.value]);

    const handleDiscountValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const isValidFormat = /^[0-9]*[.,]?[0-9]*$/.test(value);
        if (isValidFormat) {
            onGeneralDiscountChange({ ...generalDiscount, value });
        }
    };
    
    const handleDiscountTypeChange = (type: 'percentage' | 'fixed') => {
        onGeneralDiscountChange({ ...generalDiscount, type });
    };

    const SummaryRow: React.FC<{label: string; value: string, className?: string}> = ({label, value, className}) => (
        <div className={`flex justify-between items-center text-sm ${className}`}>
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
        </div>
    );

    const DiscountControls = () => (
        <div className="mt-3">
            <label className="block text-sm font-medium text-slate-600">Desconto Geral</label>
            <div className="mt-1 flex">
                <input
                    type="text"
                    value={generalDiscount.value}
                    onChange={handleDiscountValueChange}
                    className="w-full p-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                    placeholder="0"
                    inputMode="decimal"
                />
                <div className="flex">
                    <button type="button" onClick={() => handleDiscountTypeChange('percentage')} className={`px-4 py-2 text-sm font-semibold border-t border-b ${generalDiscount.type === 'percentage' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                        %
                    </button>
                    <button type="button" onClick={() => handleDiscountTypeChange('fixed')} className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${generalDiscount.type === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                        R$
                    </button>
                </div>
            </div>
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
                     {!showDiscountControls && (
                        <button 
                            onClick={() => setShowDiscountControls(true)}
                            className="text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 transition-colors duration-200 flex items-center gap-2"
                        >
                            <i className="fas fa-percent"></i> Adicionar Desconto Geral
                        </button>
                    )}
                    {showDiscountControls && <DiscountControls />}
                </div>
                <TotalsBlock />
            </div>
        );
    }

    // Mobile layout
    return (
        <div className="space-y-3">
             <TotalsBlock isMobile />
             {!showDiscountControls && (
                <button 
                    onClick={() => setShowDiscountControls(true)}
                    className="w-full text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                    <i className="fas fa-percent"></i> Adicionar Desconto Geral
                </button>
            )}
            {showDiscountControls && <DiscountControls />}
        </div>
    );
};

export default React.memo(SummaryBar);