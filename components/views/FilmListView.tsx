import React, { useState, useRef, useEffect } from 'react';
import { Film } from '../../types';

interface FilmListViewProps {
    films: Film[];
    onAdd: () => void;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FilmCard: React.FC<{
    film: Film;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    swipedItemName: string | null;
    onSetSwipedItem: (name: string | null) => void;
}> = ({ film, onEdit, onDelete, isExpanded, onToggleExpand, swipedItemName, onSetSwipedItem }) => {
    const [translateX, setTranslateX] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDraggingCard = useRef(false);
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const swipeableRef = useRef<HTMLDivElement>(null);
    const currentTranslateX = useRef(0);
    const ACTIONS_WIDTH = 160;

    useEffect(() => {
        if (swipedItemName !== film.nome && swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
        }
    }, [swipedItemName, film.nome]);

    const handleTouchStart = (e: React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.technical-data-section')) {
            isDraggingCard.current = false;
            return;
        }

        if (swipedItemName && swipedItemName !== film.nome) {
            onSetSwipedItem(null);
        }
        isDraggingCard.current = true;
        gestureDirection.current = null;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingCard.current || !swipeableRef.current) return;

        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        if (gestureDirection.current === null) {
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                gestureDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }
        }
        if (gestureDirection.current === 'vertical') return;
        if (e.cancelable) e.preventDefault();

        const newTranslateX = currentTranslateX.current + deltaX;
        let finalTranslateX = newTranslateX;
        if (newTranslateX > 0) {
            finalTranslateX = Math.pow(newTranslateX, 0.7);
        } else if (newTranslateX < -ACTIONS_WIDTH) {
            const overflow = -ACTIONS_WIDTH - newTranslateX;
            finalTranslateX = -ACTIONS_WIDTH - Math.pow(overflow, 0.7);
        }
        swipeableRef.current.style.transform = `translateX(${finalTranslateX}px)`;
    };

    const handleTouchEnd = () => {
        if (!isDraggingCard.current || !swipeableRef.current) return;
        isDraggingCard.current = false;
        if (gestureDirection.current === 'vertical') {
            gestureDirection.current = null;
            return;
        }
        gestureDirection.current = null;

        const transformValue = swipeableRef.current.style.transform;
        const matrix = new DOMMatrix(transformValue);
        const currentX = matrix.m41;

        swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        const threshold = -ACTIONS_WIDTH / 2;
        if (currentX < threshold) {
            swipeableRef.current.style.transform = `translateX(-${ACTIONS_WIDTH}px)`;
            currentTranslateX.current = -ACTIONS_WIDTH;
            setTranslateX(-ACTIONS_WIDTH);
            onSetSwipedItem(film.nome);
        } else {
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
            if (swipedItemName === film.nome) {
                onSetSwipedItem(null);
            }
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(film.nome);
        onSetSwipedItem(null);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(film);
        onSetSwipedItem(null);
    };
    
    const hasTechnicalData = film.uv || film.ir || film.vtl || film.espessura || film.tser;
    
    const TechnicalDataItem: React.FC<{ label: string; value: number | undefined; unit: string; }> = ({ label, value, unit }) => {
        if (!value) return null;
        return (
            <div>
                <span className="text-xs text-slate-500">{label}</span>
                <p className="font-medium text-slate-700">{value}{unit}</p>
            </div>
        );
    };

    return (
        <div className="relative rounded-lg sm:overflow-visible overflow-hidden bg-white border border-slate-200 shadow-sm">
            <div className="absolute inset-y-0 right-0 flex">
                <button
                    onClick={handleEditClick}
                    className="w-20 h-full bg-slate-500 text-white flex flex-col items-center justify-center transition-colors hover:bg-slate-600"
                    aria-label={`Editar película ${film.nome}`}
                >
                    <i className="fas fa-pen text-lg"></i>
                    <span className="text-xs mt-1">Editar</span>
                </button>
                <button
                    onClick={handleDeleteClick}
                    className="w-20 h-full bg-red-600 text-white flex flex-col items-center justify-center transition-colors hover:bg-red-700"
                    aria-label={`Excluir película ${film.nome}`}
                >
                    <i className="fas fa-trash-alt text-lg"></i>
                    <span className="text-xs mt-1">Excluir</span>
                </button>
            </div>

            <div
                ref={swipeableRef}
                style={{ touchAction: 'pan-y' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative z-10 w-full bg-white rounded-lg"
            >
                <div
                    onClick={onToggleExpand}
                    className="p-4 cursor-pointer"
                    role="button"
                    aria-expanded={isExpanded}
                >
                    <div className="flex justify-between items-start">
                        <p className="font-bold text-slate-800 text-lg pr-4">{film.nome}</p>
                        <div className="text-right flex-shrink-0">
                            <p className="font-bold text-slate-800 text-lg">{formatCurrency(film.preco)}</p>
                            <p className="text-sm text-slate-500">/ m²</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100">
                        <div>
                            <span className="text-xs text-slate-500">Garantia Fab.</span>
                            <p className="font-medium">{film.garantiaFabricante || 'N/A'} anos</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500">Mão de Obra</span>
                            <p className="font-medium">{film.garantiaMaoDeObra || 'N/A'} dias</p>
                        </div>
                    </div>

                    {hasTechnicalData && (
                         <div className="text-center text-slate-400 mt-3 -mb-1">
                             <i className={`fas fa-chevron-down transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                         </div>
                    )}
                </div>

                <div className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 pt-3 bg-slate-50/70 border-t border-slate-200/80 technical-data-section">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Dados Técnicos</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            <TechnicalDataItem label="UV" value={film.uv} unit="%" />
                            <TechnicalDataItem label="IR" value={film.ir} unit="%" />
                            <TechnicalDataItem label="VTL" value={film.vtl} unit="%" />
                            <TechnicalDataItem label="Espessura" value={film.espessura} unit="mc" />
                            <TechnicalDataItem label="TSER" value={film.tser} unit="%" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FilmListView: React.FC<FilmListViewProps> = ({ films, onAdd, onEdit, onDelete }) => {
    const [expandedFilmName, setExpandedFilmName] = useState<string | null>(null);
    const [swipedItemName, setSwipedItemName] = useState<string | null>(null);

    const handleToggleExpand = (filmName: string) => {
        setExpandedFilmName(prev => (prev === filmName ? null : filmName));
    };

    return (
        <div className="space-y-4 p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800">Minhas Películas</h2>
                {films.length > 0 && (
                    <button
                        onClick={onAdd}
                        className="px-5 py-2.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-sm flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Nova Película
                    </button>
                )}
            </div>

            {films.length > 0 ? (
                <div className="space-y-3">
                    {films.map(film => (
                        <FilmCard
                            key={film.nome}
                            film={film}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isExpanded={expandedFilmName === film.nome}
                            onToggleExpand={() => handleToggleExpand(film.nome)}
                            swipedItemName={swipedItemName}
                            onSetSwipedItem={setSwipedItemName}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 mt-4">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-layer-group fa-2x text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Cadastre sua Primeira Película</h3>
                    <p className="mt-2 text-slate-600 max-w-xs mx-auto">Adicione os tipos de películas com que você trabalha, incluindo preços e detalhes técnicos.</p>
                    <button
                        onClick={onAdd}
                        className="mt-6 px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Película
                    </button>
                </div>
            )}
        </div>
    );
};

export default FilmListView;