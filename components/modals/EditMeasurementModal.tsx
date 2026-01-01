import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Measurement, Film, UserInfo, Location } from '../../types';
import { AMBIENTES, TIPOS_APLICACAO } from '../../constants';
import DynamicSelector from '../ui/DynamicSelector';
import Accordion from '../ui/Accordion';
import LocationSearchInput from '../ui/LocationSearchInput';
import { locationService } from '../../services/locationService';
import { useAuth } from '../../contexts/AuthContext';

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
    userInfo: UserInfo | null;
    onOpenLocationImport: () => void;
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
    userInfo,
    onOpenLocationImport
}) => {
    const { user } = useAuth();

    const [localMeasurement, setLocalMeasurement] = useState<UIMeasurement>(measurement);
    const [shouldShare, setShouldShare] = useState(false);
    const [isSavingToGlobal, setIsSavingToGlobal] = useState(false);
    const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
    // Estado para validação visual - campos com erro ficam em vermelho
    const [fieldErrors, setFieldErrors] = useState<{ largura: boolean; altura: boolean }>({ largura: false, altura: false });

    useEffect(() => {
        if (isOpen) {
            setLocalMeasurement(measurement);
            // Limpar erros ao abrir modal
            setFieldErrors({ largura: false, altura: false });
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
        // Limpar erro do campo quando usuário digita
        if ('largura' in updatedData) {
            setFieldErrors(prev => ({ ...prev, largura: false }));
        }
        if ('altura' in updatedData) {
            setFieldErrors(prev => ({ ...prev, altura: false }));
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'largura' | 'altura' | 'quantidade' | 'discount' | 'observation') => {
        const { value } = e.target;

        if (field === 'largura' || field === 'altura') {
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

    const handleSave = async () => {
        // Se marcou para compartilhar e tem locationId, valida e salva na base global
        if (shouldShare && localMeasurement.locationId && user) {
            const larguraStr = String(localMeasurement.largura || '').replace(',', '.').trim();
            const alturaStr = String(localMeasurement.altura || '').replace(',', '.').trim();
            const larguraNumVal = parseFloat(larguraStr);
            const alturaNumVal = parseFloat(alturaStr);

            const isLarguraValid = larguraStr !== '' && !isNaN(larguraNumVal) && larguraNumVal > 0;
            const isAlturaValid = alturaStr !== '' && !isNaN(alturaNumVal) && alturaNumVal > 0;

            // Se houver campos inválidos, marcar em vermelho e não salvar
            if (!isLarguraValid || !isAlturaValid) {
                setFieldErrors({
                    largura: !isLarguraValid,
                    altura: !isAlturaValid
                });
                return; // Não salva e não fecha o modal
            }

            setIsSavingToGlobal(true);
            try {
                await locationService.addMeasurement({
                    location_id: localMeasurement.locationId,
                    name: localMeasurement.ambiente || 'Vidro',
                    largura: larguraStr,
                    altura: alturaStr,
                    quantidade: localMeasurement.quantidade || 1,
                    ambiente: localMeasurement.ambiente || '',
                    tipo_aplicacao: localMeasurement.tipoAplicacao || '',
                    observacao: localMeasurement.observation || '',
                    created_by_user_id: user.id,
                    created_by_company_name: userInfo?.empresa || ''
                });
            } catch (error) {
                // Erro silencioso - não usar console.error nem alert
            } finally {
                setIsSavingToGlobal(false);
            }
        }
        onUpdate(localMeasurement);
        onClose();
    };

    // Cálculos
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
        } else {
            finalPrice = basePrice - discountValue;
        }
    }
    finalPrice = Math.max(0, finalPrice);

    const handleEditFilm = () => {
        if (selectedFilm) {
            onClose();
            onOpenFilmModal(selectedFilm);
        }
    };

    const handleDeleteClick = () => {
        onClose();
        onDelete();
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.target.select();
    };

    const LabeledInput: React.FC<{ label: string; children: React.ReactNode; hasError?: boolean }> = ({ label, children, hasError }) => (
        <div>
            <label className={`block text-sm font-medium mb-1 ${hasError ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {label} {hasError && <span className="text-red-500">*</span>}
            </label>
            {children}
        </div>
    );

    const inputClasses = "w-full text-center p-2.5 rounded-lg border text-base transition-colors duration-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500";
    const inputErrorClasses = "w-full text-center p-2.5 rounded-lg border-2 text-base transition-colors duration-200 bg-red-50 dark:bg-red-900/20 text-slate-800 dark:text-slate-200 border-red-500 dark:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500";

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

                    {/* Seção 1: Medidas */}
                    <Accordion title="Medidas e Quantidade" defaultOpen={true}>
                        <div className="grid grid-cols-3 gap-3">
                            <LabeledInput label="Largura (m)" hasError={fieldErrors.largura}>
                                <input
                                    ref={larguraRef}
                                    type="text"
                                    inputMode="decimal"
                                    enterKeyHint="next"
                                    defaultValue={String(localMeasurement.largura)}
                                    onBlur={(e) => handleBlur(e, 'largura')}
                                    onFocus={handleFocus}
                                    onKeyDown={(e) => handleKeyDown(e, alturaRef)}
                                    className={fieldErrors.largura ? inputErrorClasses : inputClasses}
                                />
                            </LabeledInput>
                            <LabeledInput label="Altura (m)" hasError={fieldErrors.altura}>
                                <input
                                    ref={alturaRef}
                                    type="text"
                                    inputMode="decimal"
                                    enterKeyHint="next"
                                    defaultValue={String(localMeasurement.altura)}
                                    onBlur={(e) => handleBlur(e, 'altura')}
                                    onFocus={handleFocus}
                                    onKeyDown={(e) => handleKeyDown(e, quantidadeRef)}
                                    className={fieldErrors.altura ? inputErrorClasses : inputClasses}
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
                        {/* Mensagem de erro */}
                        {(fieldErrors.largura || fieldErrors.altura) && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                <i className="fas fa-exclamation-circle"></i>
                                Preencha os campos em vermelho para compartilhar
                            </p>
                        )}
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
                                    <p className="font-semibold text-slate-800 dark:text-white">{localMeasurement.pelicula || 'Selecione uma película'}</p>
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

                    {/* Seção 3: Detalhes e Localização */}
                    <Accordion title="Detalhes e Localização" defaultOpen={true}>
                        <div className="space-y-4">
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

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Observações (Privado)</label>
                                <textarea
                                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none text-sm"
                                    rows={3}
                                    placeholder="Anotações para seu controle..."
                                    defaultValue={localMeasurement.observation || ''}
                                    onBlur={(e) => handleBlur(e, 'observation')}
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Vincular a Localização (Global)</label>
                                    {(localMeasurement.locationId || localMeasurement.locationName) && (
                                        <button
                                            onClick={onOpenLocationImport}
                                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                            <i className="fas fa-download"></i>
                                            Importar Medidas
                                        </button>
                                    )}
                                </div>

                                <LocationSearchInput
                                    value={localMeasurement.locationId}
                                    locationName={localMeasurement.locationName}
                                    companyName={userInfo?.empresa}
                                    onChange={(location) => {
                                        handleLocalUpdate({
                                            locationId: location?.id,
                                            locationName: location?.name
                                        });
                                        if (!location) setShouldShare(false);
                                    }}
                                    onFormStateChange={setIsLocationFormOpen}
                                    onShareChange={setShouldShare}
                                />

                                {localMeasurement.locationId && (
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3 animate-fade-in">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="share-measurement"
                                                checked={shouldShare}
                                                onChange={(e) => setShouldShare(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                            />
                                            <label htmlFor="share-measurement" className="text-sm font-bold text-blue-800 dark:text-blue-300 cursor-pointer">
                                                Compartilhar observações com outros aplicadores
                                            </label>
                                        </div>

                                        {shouldShare && (
                                            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1 pl-6 border-l-2 border-blue-300 dark:border-blue-700">
                                                <p className="font-semibold">O que outros verão:</p>
                                                <p>• Acabamento (ex: esquadria de alumínio)</p>
                                                <p>• Acesso (ex: precisa de escada)</p>
                                                <p>• Estado do vidro (ex: trincado, película antiga)</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Accordion>

                    {/* Seção 4: Desconto e Preço */}
                    <Accordion title="Desconto e Preço" defaultOpen={true}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-medium text-slate-600 dark:text-slate-400">Preço Final</span>
                            <p className="font-bold text-slate-800 dark:text-white text-xl">{formatCurrency(finalPrice)}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Aplicar Desconto</label>
                            <div className="flex">
                                <input
                                    type="text"
                                    defaultValue={localMeasurement.discount?.value || ''}
                                    onBlur={(e) => handleBlur(e, 'discount')}
                                    onFocus={handleFocus}
                                    className="w-full p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
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

            {!isLocationFormOpen && (
                <footer className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-30">
                    <div className="max-w-xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                        <button onClick={handleDeleteClick} className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex-1 text-center">Excluir</button>
                        <button
                            onClick={handleSave}
                            disabled={isSavingToGlobal}
                            className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors flex-1 text-center disabled:opacity-50"
                        >
                            {isSavingToGlobal ? (
                                <><i className="fas fa-spinner fa-spin mr-2"></i> Salvando...</>
                            ) : 'Salvar Alterações'}
                        </button>
                    </div>
                </footer>
            )}
            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default EditMeasurementModal;