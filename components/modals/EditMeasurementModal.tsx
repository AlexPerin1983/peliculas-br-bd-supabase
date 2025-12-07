import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Measurement, Film } from '../../types';
import { AMBIENTES, TIPOS_APLICACAO } from '../../constants';
import DynamicSelector from '../ui/DynamicSelector';
import Accordion from '../ui/Accordion';

type UIMeasurement = Measurement & { isNew?: boolean };

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

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
    numpadConfig: NumpadConfig;
    onOpenNumpad: (measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const EditMeasurementModal: React.FC<EditMeasurementModalProps> = ({
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
    // Estado local para isolar as alterações
    const [localMeasurement, setLocalMeasurement] = useState<UIMeasurement>(measurement);

    // Sincroniza o estado local ao abrir o modal ou se a medida externa mudar (ex: numpad)
    useEffect(() => {
        if (isOpen) {
            setLocalMeasurement(measurement);
        }
    }, [measurement, isOpen]);

    const larguraRef = useRef<HTMLInputElement>(null);
    const alturaRef = useRef<HTMLInputElement>(null);
    const quantidadeRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextRef: React.RefObject<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    if (!isOpen) return null;

    const handleLocalUpdate = (updatedData: Partial<Measurement>) => {
        setLocalMeasurement(prev => ({ ...prev, ...updatedData }));
    };

    // Função para garantir que o valor no estado local seja o valor final do input
    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'largura' | 'altura' | 'quantidade' | 'discount' | 'observation') => {
        const { value } = e.target;

        if (field === 'largura' || field === 'altura') {
            // Garante que o valor final seja salvo no formato esperado (com vírgula)
            const sanitizedValue = value.replace(/[^0-9,.]/g, '');
            const finalValue = sanitizedValue.replace('.', ',');
            handleLocalUpdate({ [field]: finalValue });
        } else if (field === 'quantidade') {
            const intValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
            handleLocalUpdate({ quantidade: isNaN(intValue) || intValue < 1 ? 1 : intValue });
        } else if (field === 'discount') {
            const sanitizedValue = value.replace(/[^0-9,.]/g, '');
            handleLocalUpdate({
                discount: {
                    value: sanitizedValue,
                    type: localMeasurement.discount?.type || 'percentage'
                }
            });
        } else if (field === 'observation') {
            handleLocalUpdate({ observation: value });
        }
    };

    const handleDiscountTypeChange = (type: 'percentage' | 'fixed') => {
        handleLocalUpdate({
            discount: {
                value: localMeasurement.discount?.value || '0',
                type: type
            }
        });
    };

    const handleSave = () => {
        onUpdate(localMeasurement);
        onClose();
    };

    // Cálculos usando o estado local
    const larguraNum = parseFloat(String(localMeasurement.largura || '0').replace(',', '.'));
    const alturaNum = parseFloat(String(localMeasurement.altura || '0').replace(',', '.'));
    const quantidadeNum = Number(localMeasurement.quantidade) || 0;
    const m2 = larguraNum * alturaNum * quantidadeNum;
    const selectedFilm = films.find(f => f.nome === localMeasurement.pelicula);

    const pricePerM2 = useMemo(() => {
        if (selectedFilm) {
            if (selectedFilm.preco > 0) return selectedFilm.preco;
            if (selectedFilm.maoDeObra && selectedFilm.maoDeObra > 0) return selectedFilm.maoDeObra;
        }
        return 0;
    }, [selectedFilm]);

    const basePrice = pricePerM2 * m2;
    let finalPrice = basePrice;
    const discountObj = localMeasurement.discount || { value: '0', type: 'percentage' };
    const discountValue = parseFloat(discountObj.value.replace(',', '.')) || 0;

    if (discountValue > 0) {
        if (discountObj.type === 'percentage') {
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

    const handleDeleteClick = () => {
        onClose(); // Fecha o modal de edição
        onDelete(); // Chama a função que irá abrir o modal de confirmação no App.tsx
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.target.select();
    };

    const LabeledInput: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
            {children}
        </div>
    );

    const inputClasses = "w-full text-center p-2.5 rounded-lg border text-base transition-colors duration-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500";


    return (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col animate-fade-in">
            <header className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-40">
                <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Editar Medida</h2>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
                <div className="max-w-xl mx-auto space-y-4 pb-24">

                    {/* Seção 1: Medidas (Sempre aberta por padrão) */}
                    <Accordion title="Medidas e Quantidade" defaultOpen={true}>
                        <div className="grid grid-cols-3 gap-3">
                            <LabeledInput label="Largura (m)">
                                <input
                                    ref={larguraRef}
                                    type="text"
                                    inputMode="decimal"
                                    enterKeyHint="next"
                                    defaultValue={String(localMeasurement.largura)}
                                    onBlur={(e) => handleBlur(e, 'largura')}
                                    onFocus={handleFocus}
                                    onKeyDown={(e) => handleKeyDown(e, alturaRef)}
                                    className={inputClasses}
                                />
                            </LabeledInput>
                            <LabeledInput label="Altura (m)">
                                <input
                                    ref={alturaRef}
                                    type="text"
                                    inputMode="decimal"
                                    enterKeyHint="next"
                                    defaultValue={String(localMeasurement.altura)}
                                    onBlur={(e) => handleBlur(e, 'altura')}
                                    onFocus={handleFocus}
                                    onKeyDown={(e) => handleKeyDown(e, quantidadeRef)}
                                    className={inputClasses}
                                />
                            </LabeledInput>
                            <LabeledInput label="Quantidade">
                                <input
                                    ref={quantidadeRef}
                                    type="text"
                                    inputMode="numeric"
                                    enterKeyHint="done"
                                    defaultValue={String(localMeasurement.quantidade)}
                                    onBlur={(e) => handleBlur(e, 'quantidade')}
                                    onFocus={handleFocus}
                                    className={inputClasses}
                                />
                            </LabeledInput>
                        </div>
                    </Accordion>

                    {/* Seção 2: Película */}
                    <Accordion title="Película" defaultOpen={true}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Película selecionada</span>
                            {selectedFilm && (
                                <button onClick={handleEditFilm} className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <i className="fas fa-pen text-xs"></i> Editar
                                </button>
                            )}
                        </div>
                        <button onClick={() => onOpenFilmSelectionModal(localMeasurement.id)} className="w-full text-left p-3 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-600 transition-colors">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{localMeasurement.pelicula || 'Selecione uma película'}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {pricePerM2 > 0 ? `${formatCurrency(pricePerM2)} / m²` : 'Nenhum preço definido'}
                                    </p>
                                    {selectedFilm && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            Garantia: {selectedFilm.garantiaFabricante || 'N/A'}a Fab. / {selectedFilm.garantiaMaoDeObra || 'N/A'}d M.O.
                                        </p>
                                    )}
                                </div>
                                <i className="fas fa-chevron-right text-slate-400"></i>
                            </div>
                        </button>
                    </Accordion>

                    {/* Seção 3: Detalhes Adicionais */}
                    <Accordion title="Detalhes Adicionais" defaultOpen={true}>
                        <div className="space-y-3">
                            <DynamicSelector
                                label="Ambiente"
                                options={AMBIENTES}
                                value={localMeasurement.ambiente}
                                onChange={(value) => handleLocalUpdate({ ambiente: value })}
                                disabled={!localMeasurement.active}
                            />
                            <DynamicSelector
                                label="Tipo de Aplicação"
                                options={TIPOS_APLICACAO}
                                value={localMeasurement.tipoAplicacao}
                                onChange={(value) => handleLocalUpdate({ tipoAplicacao: value })}
                                disabled={!localMeasurement.active}
                            />
                        </div>
                    </Accordion>

                    {/* Seção 4: Observações (NOVO) */}
                    <Accordion title="Observações">
                        <textarea
                            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 resize-none"
                            rows={3}
                            placeholder="Adicione observações sobre esta medida (ex: vidro com difícil acesso, necessidade de andaime...)"
                            defaultValue={localMeasurement.observation || ''}
                            onBlur={(e) => handleBlur(e, 'observation')}
                        />
                    </Accordion>

                    {/* Seção 5: Desconto e Preço */}
                    <Accordion title="Desconto e Preço" defaultOpen={true}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-medium text-slate-600 dark:text-slate-400">Preço Final</span>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xl">{formatCurrency(finalPrice)}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Aplicar Desconto</label>
                            <div className="flex">
                                <input
                                    type="text"
                                    defaultValue={localMeasurement.discount?.value || ''}
                                    onBlur={(e) => handleBlur(e, 'discount')}
                                    onFocus={handleFocus}
                                    className="w-full p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                                    placeholder="0"
                                    inputMode="decimal"
                                />
                                <div className="flex">
                                    <button type="button" onClick={() => handleDiscountTypeChange('percentage')} className={`px-4 py-2 text-sm font-semibold border-t border-b ${localMeasurement.discount?.type === 'percentage' ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700 z-10' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                        %
                                    </button>
                                    <button type="button" onClick={() => handleDiscountTypeChange('fixed')} className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${localMeasurement.discount?.type === 'fixed' ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700 z-10' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                        R$
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                </div>
            </main>

            <footer className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-30">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                    <button onClick={handleDeleteClick} className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex-1 text-center">Excluir</button>
                    <button onClick={handleSave} className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors flex-1 text-center">Salvar Alterações</button>
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
};

export default EditMeasurementModal;