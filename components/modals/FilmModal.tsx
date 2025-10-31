import React, { useState, useEffect, FormEvent } from 'react';
import { Film } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface FilmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newFilmData: Film, originalFilm: Film | null) => void;
    onDelete: (filmName: string) => void;
    film: Film | null;
}

const MAX_IMAGES = 3;

const FilmModal: React.FC<FilmModalProps> = ({ isOpen, onClose, onSave, onDelete, film }) => {
    const [formData, setFormData] = useState<Film>({
        nome: '',
        preco: 0,
        maoDeObra: 0, // Inicializando o novo campo
        garantiaFabricante: 0,
        garantiaMaoDeObra: 30,
        uv: 0,
        ir: 0,
        vtl: 0,
        espessura: 0,
        tser: 0,
        imagens: [],
    });

    useEffect(() => {
        if (film) {
            setFormData({
                nome: film.nome || '',
                preco: film.preco || 0,
                maoDeObra: film.maoDeObra || 0, // Carregando o novo campo
                garantiaFabricante: film.garantiaFabricante || 0,
                garantiaMaoDeObra: film.garantiaMaoDeObra || 30,
                uv: film.uv || 0,
                ir: film.ir || 0,
                vtl: film.vtl || 0,
                espessura: film.espessura || 0,
                tser: film.tser || 0,
                imagens: film.imagens || [],
            });
        } else {
            setFormData({
                nome: '',
                preco: 0,
                maoDeObra: 0, // Inicializando para novo filme
                garantiaFabricante: 0,
                garantiaMaoDeObra: 30,
                uv: 0,
                ir: 0,
                vtl: 0,
                espessura: 0,
                tser: 0,
                imagens: [],
            });
        }
    }, [film, isOpen]);

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
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const currentImagesCount = formData.imagens?.length || 0;
        const filesToProcess = Array.from(files).slice(0, MAX_IMAGES - currentImagesCount);

        if (filesToProcess.length === 0 && currentImagesCount >= MAX_IMAGES) {
            alert(`Você já atingiu o limite de ${MAX_IMAGES} imagens.`);
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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData, film);
    };
    
    const handleDelete = () => {
        if (film) {
            onDelete(film.nome);
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
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="submit"
          form="filmForm"
          className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
        >
          {film ? 'Salvar Alterações' : 'Adicionar Película'}
        </button>
      </>
    );
    
    const currentImages = formData.imagens || [];
    const canAddMore = currentImages.length < MAX_IMAGES;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={film ? 'Editar Película' : 'Adicionar Nova Película'} footer={footer}>
            <form id="filmForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                    <div>
                        <Input
                            id="nome"
                            label="Nome da Película"
                            type="text"
                            value={formData.nome}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 items-start">
                        <Input
                            id="preco"
                            label="Preço por m² (R$)"
                            type="number"
                            value={formData.preco}
                            onChange={handleChange}
                            min="0"
                            step="0.01"
                            required
                        />
                        <Input
                            id="maoDeObra"
                            label="Valor Mão de Obra (R$)"
                            type="number"
                            value={formData.maoDeObra}
                            onChange={handleChange}
                            min="0"
                            step="0.01"
                            placeholder="Opcional"
                        />
                    </div>
                </div>
                
                <div className="pt-4 mt-4 border-t border-slate-200">
                    <h3 className="text-base font-semibold leading-6 text-slate-800 mb-2">
                        Garantias
                    </h3>
                    <div className="grid grid-cols-2 gap-4 items-start">
                        <Input
                            as="select"
                            id="garantiaFabricante"
                            label="Fabricante (Anos)"
                            value={formData.garantiaFabricante}
                            onChange={handleChange}
                            required
                        >
                            {[0,1,2,3,5,7,10,15].map(v => <option key={v} value={v}>{v === 0 ? 'N/A' : v}</option>)}
                        </Input>
                        <Input
                            as="select"
                            id="garantiaMaoDeObra"
                            label="Mão de Obra (Dias)"
                            value={formData.garantiaMaoDeObra}
                            onChange={handleChange}
                            required
                        >
                            {[30,60,90,120,180,360].map(v => <option key={v} value={v}>{v}</option>)}
                        </Input>
                    </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200">
                    <h3 className="text-base font-semibold leading-6 text-slate-800 mb-2">
                        Dados Técnicos
                    </h3>
                    {/* Grid de Dados Técnicos - 2 colunas em mobile, 3 em desktop */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Input
                            id="uv"
                            label="UV (%)"
                            type="number"
                            value={formData.uv}
                            onChange={handleChange}
                            min="0"
                            step="0.1"
                        />
                        <Input
                            id="ir"
                            label="IR (%)"
                            type="number"
                            value={formData.ir}
                            onChange={handleChange}
                            min="0"
                            step="0.1"
                        />
                        <Input
                            id="vtl"
                            label="VTL (%)"
                            type="number"
                            value={formData.vtl}
                            onChange={handleChange}
                            min="0"
                            step="0.1"
                        />
                        <Input
                            id="espessura"
                            label="Espessura (mc)"
                            type="number"
                            value={formData.espessura}
                            onChange={handleChange}
                            min="0"
                        />
                        <Input
                            id="tser"
                            label="TSER (%)"
                            type="number"
                            value={formData.tser}
                            onChange={handleChange}
                            min="0"
                            step="0.1"
                        />
                        {/* Adicionar um placeholder para manter o grid alinhado em 3 colunas */}
                        <div className="hidden sm:block"></div> 
                    </div>
                </div>
                        
                {/* Campo de Imagens - Seção separada para melhor controle de layout */}
                <div className="pt-4 mt-4 border-t border-slate-200">
                    <h3 className="text-base font-semibold leading-6 text-slate-800 mb-2">
                        Imagens de Amostra ({currentImages.length}/{MAX_IMAGES})
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {currentImages.map((image, index) => (
                            <div key={index} className="relative aspect-square">
                                <img src={image} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-slate-200" />
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
                                    className={`w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer border-slate-300 hover:border-slate-400 bg-slate-50`}
                                >
                                    <i className="fas fa-camera text-xl text-slate-400"></i>
                                    <span className="text-xs text-slate-600 mt-1 text-center px-1">Adicionar ({MAX_IMAGES - currentImages.length} restantes)</span>
                                </label>
                            </div>
                        )}
                    </div>
                    {!canAddMore && currentImages.length === MAX_IMAGES && (
                        <p className="text-sm text-slate-500 mt-2">O limite de {MAX_IMAGES} imagens foi atingido.</p>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default FilmModal;