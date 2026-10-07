import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Film } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';
import Tooltip from '../ui/Tooltip';
import InfoModal from './InfoModal';
import {
    getFilmMatchingAliases,
    getFilmMatchingBrand,
    stripMatchingMetadataFromCustomFields,
    withMatchingMetadata
} from '../../utils/filmMatchingMetadata';
import { selectAllOnFocus } from '../../src/lib/selectOnFocus';
import { GARANTIA_UNIDADES, GarantiaUnidade } from '../../src/lib/filmWarranty';
import { normalizeFilmForPersistence, validateFilmForPersistence } from '../../src/lib/filmPersistence';
import { findFilmNameConflict } from '../../src/lib/filmCatalog';
import { processSampleImage, SAMPLE_IMAGE_RECOMPRESS_THRESHOLD } from '../../services/imageProcessing';

interface FilmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newFilmData: Film, originalFilm: Film | null) => Promise<void>;
    onDelete: (filmName: string) => void;
    film: Film | null;
    /** Catálogo atual, para não salvar por cima de outra película com o mesmo nome. */
    films?: Film[];
    initialName?: string;
    aiData?: Partial<Film>;
    /** Cópia de uma película existente, aberta como película nova. */
    duplicateData?: Film | null;
    onOpenAIModal: () => void;
}

const MAX_IMAGES = 3;

const FilmModal: React.FC<FilmModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    film,
    films = [],
    initialName,
    aiData,
    duplicateData,
    onOpenAIModal
}) => {
    const [formData, setFormData] = useState<Film>({
        nome: '',
        preco: 0,
        precoMetroLinear: 0,
        precoVendaMetroLinear: 0,
        maoDeObra: 0,
        garantiaFabricante: 0,
        garantiaMaoDeObra: 30,
        garantiaMaoDeObraUnidade: 'dias',
        uv: 0,
        ir: 0,
        vtl: 0,
        espessura: 0,
        tser: 0,
        imagens: [],
        customFields: {},
    });
    const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
    const [matchingBrand, setMatchingBrand] = useState('');
    const [matchingAliases, setMatchingAliases] = useState('');
    const [infoModalConfig, setInfoModalConfig] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        setIsSaving(false);
        setError(null);
        setNameError(null);

        // Edição, cópia (Duplicar) ou dados extraídos pela IA preenchem o formulário.
        const source: Partial<Film> | undefined = film ?? duplicateData ?? aiData;
        if (source) {
            const sourceFilm = source as Film;
            const baseCustomFields = stripMatchingMetadataFromCustomFields(source.customFields);
            setFormData({
                nome: source.nome || initialName || '',
                preco: Number(source.preco) || 0,
                precoMetroLinear: Number(source.precoMetroLinear) || 0,
                precoVendaMetroLinear: Number(source.precoVendaMetroLinear) || 0,
                maoDeObra: Number(source.maoDeObra) || 0,
                garantiaFabricante: Number(source.garantiaFabricante) || 0,
                garantiaMaoDeObra: Number(source.garantiaMaoDeObra) || 30,
                garantiaMaoDeObraUnidade: source.garantiaMaoDeObraUnidade || 'dias',
                uv: Number(source.uv) || 0,
                ir: Number(source.ir) || 0,
                vtl: Number(source.vtl) || 0,
                espessura: Number(source.espessura) || 0,
                tser: Number(source.tser) || 0,
                imagens: source.imagens || [],
                customFields: baseCustomFields,
            });
            setMatchingBrand(getFilmMatchingBrand(sourceFilm));
            setMatchingAliases(getFilmMatchingAliases(sourceFilm).join(', '));
            setCustomFields(Object.entries(baseCustomFields).map(([key, value]) => ({ key, value })));
            return;
        }

        setFormData({
            nome: initialName || '',
            preco: 0,
            precoMetroLinear: 0,
            precoVendaMetroLinear: 0,
            maoDeObra: 0,
            garantiaFabricante: 0,
            garantiaMaoDeObra: 30,
            garantiaMaoDeObraUnidade: 'dias',
            uv: 0,
            ir: 0,
            vtl: 0,
            espessura: 0,
            tser: 0,
            imagens: [],
            customFields: {},
        });
        setMatchingBrand('');
        setMatchingAliases('');
        setCustomFields([]);
    }, [film, isOpen, initialName, aiData, duplicateData]);

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
        selectAllOnFocus(e);
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const currentImagesCount = formData.imagens?.length || 0;
        const filesToProcess = Array.from(files).slice(0, MAX_IMAGES - currentImagesCount);
        e.target.value = '';

        if (filesToProcess.length === 0 && currentImagesCount >= MAX_IMAGES) {
            setInfoModalConfig({ isOpen: true, message: `Você já atingiu o limite de ${MAX_IMAGES} imagens.` });
            return;
        }

        setIsProcessingImages(true);
        try {
            const newImages = await Promise.all(filesToProcess.map((file: File) => processSampleImage(file)));
            setFormData(prev => ({
                ...prev,
                imagens: [...(prev.imagens || []), ...newImages].slice(0, MAX_IMAGES)
            }));
        } catch (err) {
            setInfoModalConfig({
                isOpen: true,
                message: err instanceof Error ? err.message : 'Não foi possível adicionar a imagem.'
            });
        } finally {
            setIsProcessingImages(false);
        }
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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving || isProcessingImages) return;

        // Nome de outra película (atual ou antigo) sobrescreveria a outra ou
        // tomaria as medidas antigas dela (o nome é a chave).
        const nameConflict = findFilmNameConflict(formData.nome, films, film?.nome);
        if (nameConflict) {
            const typedName = formData.nome.trim();
            // Aviso junto do campo: o rodapé do formulário fica fora da tela no
            // celular. Só rola até ele; focar limparia o campo (selectAllOnFocus).
            setNameError(nameConflict.nome.trim().toLocaleLowerCase('pt-BR') === typedName.toLocaleLowerCase('pt-BR')
                ? `Já existe uma película chamada "${typedName}". Use outro nome.`
                : `"${typedName}" é o nome antigo da película "${nameConflict.nome}" e ainda aparece em orçamentos dela. Use outro nome.`);
            nameInputRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            return;
        }

        const customFieldsObject = customFields.reduce((acc, field) => {
            if (field.key.trim()) {
                acc[field.key.trim()] = field.value;
            }
            return acc;
        }, {} as { [key: string]: string });

        const customFieldsWithMatchingMetadata = withMatchingMetadata(
            customFieldsObject,
            matchingBrand,
            matchingAliases
        );

        setIsSaving(true);
        setError(null);
        try {
            const candidate = { ...formData, customFields: customFieldsWithMatchingMetadata };
            const validationError = validateFilmForPersistence(candidate);
            if (validationError) {
                setError(validationError);
                setIsSaving(false);
                return;
            }
            // Fotos antigas, salvas antes da compressão, encolhem na próxima edição.
            candidate.imagens = await Promise.all((candidate.imagens || []).map(image =>
                image.length > SAMPLE_IMAGE_RECOMPRESS_THRESHOLD
                    ? processSampleImage(image).catch(() => image)
                    : image
            ));
            await onSave(normalizeFilmForPersistence(candidate), film);
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar película. Tente novamente.');
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (isSaving || !film) return;
        onDelete(film.nome);
        onClose();
    };

    const footer = (
        <>
            {film && (
                <ActionButton onClick={handleDelete} disabled={isSaving} variant="danger" size="sm">
                    Excluir
                </ActionButton>
            )}
            <div className="flex-grow"></div>
            <ActionButton
                type="submit"
                form="filmForm"
                disabled={isSaving || isProcessingImages}
                loading={isSaving}
                loadingText="Salvando..."
                variant="primary"
                size="sm"
            >
                {film ? 'Salvar alterações' : 'Adicionar película'}
            </ActionButton>
        </>
    );

    const currentImages = formData.imagens || [];
    const canAddMore = currentImages.length < MAX_IMAGES;

    const modalTitle = (
        <div className="flex justify-between items-center w-full">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                {film ? 'Editar película' : duplicateData ? 'Duplicar película' : aiData ? 'Confirmar dados da IA' : 'Nova película'}
            </h2>
            {!film && !aiData && !duplicateData && (
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
        <Modal isOpen={isOpen} onClose={isSaving ? () => {} : onClose} title={modalTitle} footer={footer} disableClose={isSaving} fullScreenOnMobile>
            <form id="filmForm" onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isSaving} className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-4">
                        <div>
                            <Input
                                ref={nameInputRef}
                                id="nome"
                                label="Nome da película"
                                type="text"
                                value={formData.nome}
                                onChange={(e) => {
                                    setNameError(null);
                                    handleChange(e);
                                }}
                                onFocus={handleFocus}
                                required
                                placeholder="Ex: G5 Profissional"
                                aria-invalid={nameError ? true : undefined}
                                aria-describedby={nameError ? 'nome-erro' : undefined}
                            />
                            {nameError && (
                                <p id="nome-erro" role="alert" className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                                    {nameError}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                id="matchingBrand"
                                label="Marca (para IA)"
                                type="text"
                                value={matchingBrand}
                                onChange={(e) => setMatchingBrand(e.target.value)}
                                placeholder="Ex: 3M, SunTek"
                            />
                            <Input
                                id="matchingAliases"
                                label="Aliases (para IA)"
                                type="text"
                                value={matchingAliases}
                                onChange={(e) => setMatchingAliases(e.target.value)}
                                placeholder="Ex: black out, blecaute, fume mirror"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                id="maoDeObra"
                                label="Mão de obra (R$)"
                                type="number"
                                value={formData.maoDeObra}
                                onChange={handleChange}
                                onFocus={handleFocus}
                                min="0"
                                step="0.01"
                            />
                            <Input
                                id="precoVendaMetroLinear"
                                label="Venda linear sem preço/m² (R$)"
                                type="number"
                                value={formData.precoVendaMetroLinear}
                                onChange={handleChange}
                                onFocus={handleFocus}
                                min="0"
                                step="0.01"
                            />
                            <Input
                                id="precoMetroLinear"
                                label="Custo metro linear (R$)"
                                type="number"
                                value={formData.precoMetroLinear}
                                onChange={handleChange}
                                onFocus={handleFocus}
                                min="0"
                                step="0.01"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                id="garantiaFabricante"
                                label="Garantia fabricante (anos)"
                                type="number"
                                value={formData.garantiaFabricante}
                                onChange={handleChange}
                                onFocus={handleFocus}
                                min="0"
                            />
                            <div>
                                <label htmlFor="garantiaMaoDeObra" className="ui-label block">Garantia mão de obra</label>
                                <div className="mt-1 flex items-stretch gap-2">
                                    <input
                                        id="garantiaMaoDeObra"
                                        type="number"
                                        min="0"
                                        inputMode="numeric"
                                        value={Number.isFinite(formData.garantiaMaoDeObra) ? formData.garantiaMaoDeObra : ''}
                                        onChange={handleChange}
                                        onFocus={handleFocus}
                                        className="ui-field block w-full min-w-0 flex-1 px-3 py-2.5 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                    <select
                                        aria-label="Unidade da garantia de mão de obra"
                                        value={formData.garantiaMaoDeObraUnidade || 'dias'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, garantiaMaoDeObraUnidade: e.target.value as GarantiaUnidade }))}
                                        className="ui-field block w-24 shrink-0 px-2.5 py-2.5 text-sm"
                                    >
                                        {GARANTIA_UNIDADES.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Especificações técnicas</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <Input id="uv" label="Proteção UV (%)" type="number" value={formData.uv} onChange={handleChange} onFocus={handleFocus} min="0" max="100" step="any" />
                            <Input id="ir" label="Rejeição IR (%)" type="number" value={formData.ir} onChange={handleChange} onFocus={handleFocus} min="0" max="100" step="any" />
                            <Input id="vtl" label="VTL (%)" type="number" value={formData.vtl} onChange={handleChange} onFocus={handleFocus} min="0" max="100" step="any" />
                            <Input id="espessura" label="Espessura (micras)" type="number" value={formData.espessura} onChange={handleChange} onFocus={handleFocus} min="0" step="any" />
                            <Input id="tser" label="TSER (%)" type="number" value={formData.tser} onChange={handleChange} onFocus={handleFocus} min="0" max="100" step="any" />
                            <div className="hidden sm:block"></div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Campos personalizados</h4>
                                <button
                                    type="button"
                                    onClick={addCustomField}
                                    className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                    <i className="fas fa-plus" />
                                    Adicionar campo
                                </button>
                            </div>
                            {customFields.length > 0 && (
                                <div className="space-y-3">
                                    {customFields.map((field, index) => (
                                        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                            <Input
                                                id={`custom-key-${index}`}
                                                label={index === 0 ? 'Nome do campo' : ''}
                                                placeholder="Ex: Garantia"
                                                value={field.key}
                                                onChange={(e) => handleCustomFieldChange(index, 'key', e.target.value)}
                                            />
                                            <Input
                                                id={`custom-value-${index}`}
                                                label={index === 0 ? 'Valor' : ''}
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

                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-base font-semibold leading-6 text-slate-800 dark:text-slate-200 mb-2">
                            Imagens de amostra ({currentImages.length}/{MAX_IMAGES})
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
                                        disabled={isProcessingImages}
                                        className="sr-only"
                                        multiple
                                    />
                                    <label
                                        htmlFor="film-image-upload"
                                        aria-busy={isProcessingImages}
                                        className="w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-800"
                                    >
                                        <i className={`fas ${isProcessingImages ? 'fa-spinner fa-spin' : 'fa-camera'} text-xl text-slate-400 dark:text-slate-500`}></i>
                                        <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 text-center px-1">
                                            {isProcessingImages
                                                ? 'Otimizando foto…'
                                                : `Adicionar (${MAX_IMAGES - currentImages.length} restantes)`}
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>
                        {!canAddMore && currentImages.length === MAX_IMAGES && (
                            <p className="text-sm text-slate-500 mt-2">O limite de {MAX_IMAGES} imagens foi atingido.</p>
                        )}
                    </div>
                </fieldset>
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md" role="alert">
                        {error}
                    </div>
                )}
            </form>
            <InfoModal
                isOpen={infoModalConfig.isOpen}
                onClose={() => setInfoModalConfig({ isOpen: false, message: '' })}
                message={infoModalConfig.message}
            />
        </Modal>
    );
};

export default FilmModal;
