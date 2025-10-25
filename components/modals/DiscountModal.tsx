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
    // Usando string para o estado para permitir a digitação de vírgulas e números parciais
    const [value, setValue] = useState(initialValue?.toString().replace('.', ',') || '');
    const [type, setType] = useState<'percentage' | 'fixed'>(initialType);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Sincroniza o estado local com as props iniciais ao abrir
            setValue(initialValue?.toString().replace('.', ',') || '');
            setType(initialType);
            // Foca o input ao abrir o modal
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue, initialType]);
    
    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Permite apenas números, vírgula e ponto
        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
            setValue(val);
        }
    };
    
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // Converte para número usando ponto como separador antes de salvar
        const numericValue = parseFloat(value.replace(',', '.')) || 0;
        onSave(numericValue, type);
    };

    const handleButtonMouseDown = (e: React.MouseEvent) => {
        // Previne que o botão roube o foco do input antes do clique ser processado
        e.preventDefault();
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
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Aplicar Desconto no Item" 
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-20 sm:pt-4"
        >
            <form id="discountForm" onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-600">Valor do Desconto</label>
                    <div className="mt-1 flex">
                        <input
                            ref={inputRef}
                            type="text"
                            value={value} // Componente controlado
                            onChange={handleValueChange}
                            onBlur={handleSubmit} // Salva ao perder o foco (Tab ou clique fora)
                            onClick={(e) => {
                                // Garante que se o usuário clicar no input, ele mantenha o foco
                                if (document.activeElement !== inputRef.current) {
                                    inputRef.current?.focus();
                                }
                            }}
                            className="w-full p-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                            placeholder="0"
                            inputMode="decimal"
                        />
                        <div className="flex">
                            <button 
                                type="button" 
                                onClick={() => setType('percentage')} 
                                onMouseDown={handleButtonMouseDown}
                                className={`px-4 py-2 text-sm font-semibold border-t border-b transition-colors ${type === 'percentage' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                %
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setType('fixed')} 
                                onMouseDown={handleButtonMouseDown}
                                className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${type === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
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