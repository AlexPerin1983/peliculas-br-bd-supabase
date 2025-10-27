import React, { useState, useEffect, useCallback, memo } from 'react';
import { Measurement, Film } from '../../types';
import { AMBIENTES, TIPOS_APLICACAO } from '../../constants';
import DynamicSelector from '../ui/DynamicSelector';

type UIMeasurement = Measurement & { isNew?: boolean };

interface EditMeasurementModalProps {
    isOpen: boolean;
    onClose: () => void;
    measurement: UIMeasurement;
    films: Film[];
    onUpdate: (updatedMeasurement: Partial<Measurement>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onOpenFilmModal: (film: Film | null) => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const EditMeasurementModal: React.FC<EditMeasurementModalProps> = memo(({
    isOpen,
    onClose,
    measurement,
    films,
    onUpdate,
    onDelete,
    onDuplicate,
    onOpenFilmModal,
    onOpenFilmSelectionModal,
}) => {
    // Estado local para evitar re-renderização do App.tsx a cada digitação
    const [localMeasurement, setLocalMeasurement] = useState<UIMeasurement>(measurement);

    useEffect(() => {
        // Sincroniza o estado local com a prop inicial ao abrir
        if (isOpen) {
            setLocalMeasurement(measurement);
        }
    }, [isOpen, measurement]);

    if (!isOpen) return null;

    const handleLocalInputChange = useCallback((field: keyof Measurement, value: string | number) => {
        // Esta função é estável e só atualiza o estado local
        setLocalMeasurement(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'largura' | 'altura') => {
        const { value } = e.target;
        // Permite apenas números, vírgula e ponto
        if (/^[0-9]*[.,]?[0-9]*$/.test(value)) {
            handleLocalInputChange(field, value);
        }
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const intValue = parseInt(value, 10);
        // Permite string vazia ou número inteiro positivo
        if (value === '' || (!isNaN(intValue) && intValue >= 0)) {
            handleLocalInputChange('quantidade', value === '' ? 1 : intValue);
        }
    };
    
    const handleDiscountValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        if (/^[0-9]*[.,]?[0-9]*$/.test(value)) {
             const numericValue = parseFloat(value.replace(',', '.')) || 0;
            handleLocalInputChange('discount', numericValue);
        }
    };

    const handleDiscountTypeChange = (type: 'percentage' | 'fixed') => {
        handleLocalInputChange('discountType', type);
    };
    
    const handleSaveAndClose = () => {
        // Aplica todas as alterações ao estado global antes de fechar
        onUpdate(localMeasurement);
        onClose();
    };

    const larguraNum = parseFloat(String(localMeasurement.largura || '0').replace(',', '.'));
    const alturaNum = parseFloat(String(localMeasurement.altura || '0').replace(',', '.'));
    const quantidadeNum = Number(localMeasurement.quantidade) || 0;
    const m2 = larguraNum * alturaNum * quantidadeNum;
    const selectedFilm = films.find(f => f.nome === localMeasurement.pelicula);
    const basePrice = selectedFilm ? m2 * selectedFilm.preco : 0;
    let finalPrice = basePrice;
    const discountValue = localMeasurement.discount || 0;
    if (discountValue > 0) {
        if (localMeasurement.discountType === 'percentage') {
            finalPrice = basePrice * (1 - discountValue / 100);
        } else { // fixed
            finalPrice = basePrice - discountValue;
        }
    }
    finalPrice = Math.max(0, finalPrice);
    
    const handleEditFilm = () => {
        if (selectedFilm) {
            onClose(); // Close this modal
            onOpenFilmModal(selectedFilm); // Open film editor modal
        }
    };

    const LabeledInput: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
            {children}
        </div>
    );

    const inputClasses = "w-full text-center p-2.5 rounded-lg border text-base transition-colors duration-200 bg-white text-slate-800 border-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500";


    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
            <header className="flex-shrink-0 p-4 border-b border-slate-200 bg-white sticky top-0">
                <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold text-slate-800">Editar Medida</h2>
                    <button onClick={handleSaveAndClose} className="text-slate-500 hover:text-slate-800 h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 bg-slate-50">
                <div className="max-w-xl mx-auto space-y-4 pb-24">

                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-800 mb-3 text-base">Medidas e Quantidade</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <LabeledInput label="Largura (m)">
                                <input 
                                    type="text" 
                                    inputMode="decimal" 
                                    value={String(localMeasurement.largura)} 
                                    onChange={(e) => handleNumericInputChange(e, 'largura')} 
                                    className={inputClasses} 
                                />
                            </LabeledInput>
                            <LabeledInput label="Altura (m)">
                                <input 
                                    type="text" 
                                    inputMode="decimal" 
                                    value={String(localMeasurement.altura)} 
                                    onChange={(e) => handleNumericInputChange(e, 'altura')} 
                                    className={inputClasses} 
                                />
                            </LabeledInput>
                            <LabeledInput label="Quantidade">
                                <input 
                                    type="text" 
                                    inputMode="numeric" 
                                    value={String(localMeasurement.quantidade)} 
                                    onChange={handleQuantityChange} 
                                    className={inputClasses} 
                                />
                            </LabeledInput>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-slate-800 text-base">Película</h3>
                            {selectedFilm && (
                                <button onClick={handleEditFilm} className="text-sm text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100">
                                    <i className="fas fa-pen text-xs"></i> Editar
                                </button>
                            )}
                        </div>
                        <button onClick={() => onOpenFilmSelectionModal(localMeasurement.id)} className="w-full text-left p-3 rounded-lg hover:bg-slate-100/70 border border-slate-200 transition-colors">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-slate-800">{localMeasurement.pelicula || 'Selecione uma película'}</p>
                                    <p className="text-sm text-slate-500">{selectedFilm ? `${formatCurrency(selectedFilm.preco)} / m²` : 'Nenhum preço definido'}</p>
                                     {selectedFilm && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            Garantia: {selectedFilm.garantiaFabricante || 'N/A'}a Fab. / {selectedFilm.garantiaMaoDeObra || 'N/A'}d M.O.
                                        </p>
                                    )}
                                </div>
                                <i className="fas fa-chevron-right text-slate-400"></i>
                            </div>
                        </button>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-800 mb-3 text-base">Detalhes Adicionais</h3>
                        <div className="space-y-3">
                            <DynamicSelector
                                label="Ambiente"
                                options={AMBIENTES}
                                value={localMeasurement.ambiente}
                                // DynamicSelector chama onChange(value), que chama handleLocalInputChange(field, value)
                                onChange={(value) => handleLocalInputChange('ambiente', value)}
                                disabled={!localMeasurement.active}
                            />
                            <DynamicSelector
                                label="Tipo de Aplicação"
                                options={TIPOS_APLICACAO}
                                value={localMeasurement.tipoAplicacao}
                                // DynamicSelector chama onChange(value), que chama handleLocalInputChange(field, value)
                                onChange={(value) => handleLocalInputChange('tipoAplicacao', value)}
                                disabled={!localMeasurement.active}
                            />
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative z-20">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-slate-800 text-base">Desconto e Preço</h3>
                            <p className="font-bold text-slate-800 text-lg">{formatCurrency(finalPrice)}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Valor do Desconto</label>
                            <div className="flex">
                                <input
                                    type="text"
                                    value={String(localMeasurement.discount || '').replace('.', ',')}
                                    onChange={handleDiscountValueChange}
                                    className="w-full p-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                                    placeholder="0"
                                    inputMode="decimal"
                                />
                                <div className="flex">
                                    <button type="button" onClick={() => handleDiscountTypeChange('percentage')} className={`px-4 py-2 text-sm font-semibold border-t border-b ${localMeasurement.discountType === 'percentage' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                        %
                                    </button>
                                    <button type="button" onClick={() => handleDiscountTypeChange('fixed')} className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${localMeasurement.discountType === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                        R$
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 p-3 border-t border-slate-200 bg-white/80 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-30">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                    <button onClick={onDelete} className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex-1 text-center">Excluir</button>
                    <button onClick={onDuplicate} className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors flex-1 text-center">Duplicar</button>
                    <button onClick={handleSaveAndClose} className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex-[2] text-center">Salvar Alterações</button>
                </div>
            </footer>
             <style jsx>{`
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
});

export default EditMeasurementModal;