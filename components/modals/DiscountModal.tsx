
import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (discount: number, discountType: 'percentage' | 'fixed') => void;
    initialValue?: number;
    initialType?: 'percentage' | 'fixed';
}

const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, onSave, initialValue, initialType = 'percentage' }) => {
    const [value, setValue] = useState(initialValue?.toString().replace('.', ',') || '');
    const [type, setType] = useState<'percentage' | 'fixed'>(initialType);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue?.toString().replace('.', ',') || '');
            setType(initialType);
        }
    }, [isOpen, initialValue, initialType]);
    
    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
            setValue(val);
        }
    };
    
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const numericValue = parseFloat(value.replace(',', '.')) || 0;
        onSave(numericValue, type);
    };

    const footer = (
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="submit"
          form="discountForm"
          className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
        >
          Salvar Desconto
        </button>
      </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aplicar Desconto no Item" footer={footer}>
            <form id="discountForm" onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-600">Valor do Desconto</label>
                    <div className="mt-1 flex">
                        <input
                            type="text"
                            value={value}
                            onChange={handleValueChange}
                            onFocus={(e) => e.target.select()}
                            className="w-full p-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                            placeholder="0"
                            inputMode="decimal"
                            autoFocus
                        />
                        <div className="flex">
                            <button type="button" onClick={() => setType('percentage')} className={`px-4 py-2 text-sm font-semibold border-t border-b ${type === 'percentage' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                %
                            </button>
                            <button type="button" onClick={() => setType('fixed')} className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${type === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                R$
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default DiscountModal;
