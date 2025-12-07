import React, { useState, useEffect, FormEvent } from 'react';
import { Film } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Tooltip from '../ui/Tooltip';
import InfoModal from './InfoModal';

interface FilmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newFilmData: Film, originalFilm: Film | null) => void;
    onDelete: (filmName: string) => void;
    film: Film | null;
    initialName?: string; // New prop
    aiData?: Partial<Film>;
    onOpenAIModal: () => void;
}

const MAX_IMAGES = 3;

const FilmModal: React.FC<FilmModalProps> = ({ isOpen, onClose, onSave, onDelete, film, initialName, aiData, onOpenAIModal }) => {
    const [formData, setFormData] = useState<Film>({
        nome: '',
        preco: 0,
        precoMetroLinear: 0,
        maoDeObra: 0,
        garantiaFabricante: 0,
        garantiaMaoDeObra: 30,
        uv: 0,
        ir: 0,
        vtl: 0,
        espessura: 0,
        tser: 0,
        imagens: [],
        customFields: {},
    });
    const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
    const [infoModalConfig, setInfoModalConfig] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

    useEffect(() => {
        if (film) {
            setFormData({
                nome: film.nome || '',
                preco: film.preco || 0,
                precoMetroLinear: film.precoMetroLinear || 0,
                maoDeObra: film.maoDeObra || 0,
                garantiaFabricante: film.garantiaFabricante || 0,
                garantiaMaoDeObra: film.garantiaMaoDeObra || 30,
                uv: film.uv || 0,
                ir: film.ir || 0,
                vtl: film.vtl || 0,
                espessura: film.espessura || 0,
                tser: film.tser || 0,
                imagens: film.imagens || [],
                customFields: film.customFields || {},
            });
            // Converter customFields de objeto para array para edição
            const fieldsArray = Object.entries(film.customFields || {}).map(([key, value]) => ({ key, value }));
            setCustomFields(fieldsArray);
        } else if (aiData) {
            setFormData({
                nome: aiData.nome || initialName || '',
                preco: Number(aiData.preco) || 0,
                precoMetroLinear: Number(aiData.precoMetroLinear) || 0,
                maoDeObra: Number(aiData.maoDeObra) || 0,
                garantiaFabricante: Number(aiData.garantiaFabricante) || 0,
                garantiaMaoDeObra: Number(aiData.garantiaMaoDeObra) || 30,
                uv: Number(aiData.uv) || 0,
                ir: Number(aiData.ir) || 0,
                vtl: Number(aiData.vtl) || 0,
                espessura: Number(aiData.espessura) || 0,
                tser: Number(aiData.tser) || 0,
                imagens: aiData.imagens || [],
                customFields: aiData.customFields || {},
            });
            const fieldsArray = Object.entries(aiData.customFields || {}).map(([key, value]) => ({ key, value }));
            setCustomFields(fieldsArray);
        } else {
            setFormData({
                nome: initialName || '', // Use initialName if provided
                preco: 0,
                precoMetroLinear: 0,
                maoDeObra: 0,
                garantiaFabricante: 0,
                garantiaMaoDeObra: 30,
                uv: 0,
                ir: 0,
                vtl: 0,
                espessura: 0,
                tser: 0,
                imagens: [],
                customFields: {},
            });
            setCustomFields([]);
        }
    }, [film, isOpen, initialName, aiData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        const isNumeric = (e.target as HTMLInputElement).type === 'number' || e.target.tagName === 'SELECT';

        let processedValue: string | number = value;
        if (isNumeric) {
            const sanitizedValue = value.replace(',', '.');
            processedValue = parseFloat(sanitizedValue);
        }

        setFormData(prev => ({ ...prev, [id]: processedValue }));
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const currentImagesCount = formData.imagens?.length || 0;
        const filesToProcess = Array.from(files).slice(0, MAX_IMAGES - currentImagesCount);

        if (filesToProcess.length === 0 && currentImagesCount >= MAX_IMAGES) {
            setInfoModalConfig({ isOpen: true, message: `Você já atingiu o limite de ${MAX_IMAGES} imagens.` });
            return;
        }

        const newImages: string[] = [];
        let filesProcessed = 0;

        filesToProcess.forEach((file: File) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                newImages.push(base64String);
                filesProcessed++;

                if (filesProcessed === filesToProcess.length) {
                    setFormData(prev => ({
                        ...prev,
                        imagens: [...(prev.imagens || []), ...newImages]
                    }));
                }
            };
            reader.readAsDataURL(file);
        });

        // Clear the input value so the same file can be selected again
        e.target.value = '';
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setFormData(prev => ({
            ...prev,
            imagens: (prev.imagens || []).filter((_, index) => index !== indexToRemove)
        }));
    };

    const addCustomField = () => {
        setCustomFields([...customFields, { key: '', value: '' }]);
    };

    const removeCustomField = (index: number) => {
        setCustomFields(customFields.filter((_, i) => i !== index));
    };

    const handleCustomFieldChange = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...customFields];
        updated[index][field] = value;
        setCustomFields(updated);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Converter array de campos customizados para objeto
        const customFieldsObject = customFields.reduce((acc, field) => {
            if (field.key.trim()) {
                acc[field.key.trim()] = field.value;
            }
            return acc;
        }, {} as { [key: string]: string });

        onSave({ ...formData, customFields: customFieldsObject }, film);
    };

    const handleDelete = () => {
        if (film) {
            onDelete(film.nome);
            onClose();
        }
    };

    const footer = (
        <>
            {film && (
                <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700"
                >
                    Excluir
                </button>
            )}
            <div className="flex-grow"></div>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300">
                Cancelar
            </button>
            <button
                type="submit"
                form="filmForm"
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold rounded-md hover:bg-slate-700 dark:hover:bg-slate-600"
            >
                {film ? 'Salvar Alterações' : 'Adicionar Película'}
            </button>
        </>
    );

    const currentImages = formData.imagens || [];
    const canAddMore = currentImages.length < MAX_IMAGES;

    const modalTitle = (
        <div className="flex justify-between items-center w-full">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                {film ? 'Editar Película' : (aiData ? 'Confirmar Dados da IA' : 'Nova Película')}
            </h2>
            {!film && !aiData && (
                <Tooltip text="Preencher com IA">
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); onOpenAIModal(); }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm"
                        aria-label="Preencher formulário com Inteligência Artificial"
                    >
                        <i className="fas fa-robot"></i>
                        <span className="hidden sm:inline">com IA</span>
                    </button>
                </Tooltip>
            )}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} footer={footer}>
            <form id="filmForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-4">
                    <Input
                        id="nome"
                        label="Nome da Película"
                        type="text"
                        value={formData.nome}
                        onChange={handleChange}
                        onFocus={handleFocus}
                        required
                        placeholder="Ex: G5 Profissional"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                            id="preco"
                            label="Preço por m² (R$)"
                            type="number"
                            value={formData.preco}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.01"
                            required
                        />
                        <Input
                            id="precoMetroLinear"
                            label="Preço Metro Linear (R$)"
                            type="number"
                            value={formData.precoMetroLinear}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.01"
                        />
                        <Input
                            id="maoDeObra"
                            label="Mão de Obra (R$)"
                            type="number"
                            value={formData.maoDeObra}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.01"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            id="garantiaFabricante"
                            label="Garantia Fabricante (Anos)"
                            type="number"
                            value={formData.garantiaFabricante}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                        />
                        <Input
                            id="garantiaMaoDeObra"
                            label="Garantia Mão de Obra (Dias)"
                            type="number"
                            value={formData.garantiaMaoDeObra}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                        />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Especificações Técnicas</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Input
                            id="uv"
                            label="Proteção UV (%)"
                            type="number"
                            value={formData.uv}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.1"
                        />
                        <Input
                            id="ir"
                            label="Rejeição IR (%)"
                            type="number"
                            value={formData.ir}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.1"
                        />
                        <Input
                            id="vtl"
                            label="VLT (%)"
                            type="number"
                            value={formData.vtl}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.1"
                        />
                        <Input
                            id="espessura"
                            label="Espessura (micras)"
                            type="number"
                            value={formData.espessura}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                        />
                        <Input
                            id="tser"
                            label="TSER (%)"
                            type="number"
                            value={formData.tser}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            min="0"
                            step="0.1"
                        />
                        {/* Adicionar um placeholder para manter o grid alinhado em 3 colunas */}
                        <div className="hidden sm:block"></div>
                    </div>

                    {/* Campos Customizados */}
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Campos Personalizados</h4>
                            <button
                                type="button"
                                onClick={addCustomField}
                                className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                                <i className="fas fa-plus" />
                                Adicionar Campo
                            </button>
                        </div>
                        {customFields.length > 0 && (
                            <div className="space-y-3">
                                {customFields.map((field, index) => (
                                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                        <Input
                                            id={`custom-key-${index}`}
                                            label={index === 0 ? "Nome do Campo" : ""}
                                            placeholder="Ex: Garantia"
                                            value={field.key}
                                            onChange={(e) => handleCustomFieldChange(index, 'key', e.target.value)}
                                        />
                                        <Input
                                            id={`custom-value-${index}`}
                                            label={index === 0 ? "Valor" : ""}
                                            placeholder="Ex: 10 anos"
                                            value={field.value}
                                            onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeCustomField(index)}
                                            className="h-10 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Remover campo"
                                        >
                                            <i className="fas fa-trash-alt" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {customFields.length === 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">Nenhum campo personalizado adicionado.</p>
                        )}
                    </div>
                </div>

                {/* Campo de Imagens - Seção separada para melhor controle de layout */}
                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold leading-6 text-slate-800 dark:text-slate-200 mb-2">
                        Imagens de Amostra ({currentImages.length}/{MAX_IMAGES})
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {currentImages.map((image, index) => (
                            <div key={index} className="relative aspect-square">
                                <img src={image} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-600" />
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveImage(index); }}
                                    className="absolute top-1 right-1 h-6 w-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                                    aria-label="Remover imagem"
                                >
                                    <i className="fas fa-times text-xs"></i>
                                </button>
                            </div>
                        ))}
                        {canAddMore && (
                            <div className="relative aspect-square">
                                <input
                                    id="film-image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="sr-only"
                                    multiple
                                />
                                <label
                                    htmlFor="film-image-upload"
                                    className={`w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-800`}
                                >
                                    <i className="fas fa-camera text-xl text-slate-400 dark:text-slate-500"></i>
                                    <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 text-center px-1">Adicionar ({MAX_IMAGES - currentImages.length} restantes)</span>
                                </label>
                            </div>
                        )}
                    </div>
                    {!canAddMore && currentImages.length === MAX_IMAGES && (
                        <p className="text-sm text-slate-500 mt-2">O limite de {MAX_IMAGES} imagens foi atingido.</p>
                    )}
                </div>
            </form>
            <InfoModal
                isOpen={infoModalConfig.isOpen}
                onClose={() => setInfoModalConfig({ isOpen: false, message: '' })}
                message={infoModalConfig.message}
            />
        </Modal >
    );
};

export default FilmModal;