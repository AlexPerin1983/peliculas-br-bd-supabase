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

const FilmModal: React.FC<FilmModalProps> = ({ isOpen, onClose, onSave, onDelete, film }) => {
    const [formData, setFormData] = useState<Film>({
        nome: '',
        preco: 0,
        garantiaFabricante: 0,
        garantiaMaoDeObra: 30,
        uv: 0,
        ir: 0,
        vtl: 0,
        espessura: 0,
        tser: 0,
    });

    useEffect(() => {
        if (film) {
            setFormData({
                nome: film.nome || '',
                preco: film.preco || 0,
                garantiaFabricante: film.garantiaFabricante || 0,
                garantiaMaoDeObra: film.garantiaMaoDeObra || 30,
                uv: film.uv || 0,
                ir: film.ir || 0,
                vtl: film.vtl || 0,
                espessura: film.espessura || 0,
                tser: film.tser || 0,
            });
        } else {
            setFormData({
                nome: '',
                preco: 0,
                garantiaFabricante: 0,
                garantiaMaoDeObra: 30,
                uv: 0,
                ir: 0,
                vtl: 0,
                espessura: 0,
                tser: 0,
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
                </div>
                
                <div className="pt-4 mt-4 border-t border-slate-200">
                    <h3 className="text-base font-semibold leading-6 text-slate-800 mb-2">
                        Garantias
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default FilmModal;