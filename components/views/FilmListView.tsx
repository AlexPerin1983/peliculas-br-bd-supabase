import React, { useState, useRef, useEffect } from 'react';
import { Film } from '../../types';

interface FilmListViewProps {
    films: Film[];
    onAdd: () => void;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
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
    onOpenGallery: (images: string[], initialIndex: number) => void;
}> = ({ film, onEdit, onDelete, isExpanded, onToggleExpand, swipedItemName, onSetSwipedItem, onOpenGallery }) => {
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

    const handleImageClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (film.imagens && film.imagens.length > 0) {
            onOpenGallery(film.imagens, index);
        }
    };

    const hasTechnicalData = film.uv || film.ir || film.vtl || film.espessura || film.tser;
    const hasImages = (film.imagens?.length || 0) > 0;
    const hasExpandableContent = hasTechnicalData || hasImages;

    const TechnicalDataItem: React.FC<{ label: string; value: number | undefined; unit: string; }> = ({ label, value, unit }) => {
        if (!value) return null;
        return (
            <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                <p className="font-medium text-slate-700 dark:text-slate-300">{value}{unit}</p>
            </div>
        );
    };

    const pricePerM2 = film.preco || film.maoDeObra || 0;
    const priceLabel = film.preco > 0 ? 'Preço' : (film.maoDeObra > 0 ? 'Mão de Obra' : 'Preço');

    return (
        <div className="relative rounded-lg sm:overflow-visible overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
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
                className="relative z-10 w-full bg-white dark:bg-slate-800 rounded-lg"
            >
                <div
                    onClick={hasExpandableContent ? onToggleExpand : undefined}
                    className={`p-4 ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'}`}
                    role="button"
                    aria-expanded={isExpanded}
                >
                    <div className="flex justify-between items-start">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg pr-4">{film.nome}</p>
                        <div className="text-right flex-shrink-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{formatCurrency(pricePerM2)}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">/ m² ({priceLabel})</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Garantia Fab.</span>
                            <p className="font-medium dark:text-slate-300">{film.garantiaFabricante || 'N/A'} anos</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Mão de Obra</span>
                            <p className="font-medium dark:text-slate-300">{film.garantiaMaoDeObra || 'N/A'} dias</p>
                        </div>
                    </div>

                    {hasExpandableContent && (
                        <div className="text-center text-slate-400 dark:text-slate-500 mt-3 -mb-1">
                            <i className={`fas fa-chevron-down transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                        </div>
                    )}
                </div>

                <div className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 pt-3 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-700 technical-data-section">

                        {hasTechnicalData && (
                            <>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Dados Técnicos</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                                    <TechnicalDataItem label="UV" value={film.uv} unit="%" />
                                    <TechnicalDataItem label="IR" value={film.ir} unit="%" />
                                    <TechnicalDataItem label="VTL" value={film.vtl} unit="%" />
                                    <TechnicalDataItem label="Espessura" value={film.espessura} unit="mc" />
                                    <TechnicalDataItem label="TSER" value={film.tser} unit="%" />
                                </div>
                            </>
                        )}

                        {hasImages && (
                            <>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                    {film.imagens!.length} Imagens de Amostra
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {film.imagens!.map((image, index) => (
                                        <div key={index} className="aspect-square overflow-hidden rounded-lg shadow-md cursor-pointer">
                                            <img
                                                src={image}
                                                alt={`Amostra ${index + 1} de ${film.nome}`}
                                                onClick={(e) => handleImageClick(index, e)}
                                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FilmListView: React.FC<FilmListViewProps> = ({ films, onAdd, onEdit, onDelete, onOpenGallery }) => {
    const [expandedFilmName, setExpandedFilmName] = useState<string | null>(null);
    const [swipedItemName, setSwipedItemName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);

    const filteredFilms = React.useMemo(() => {
        if (!searchTerm.trim()) return films;
        const lowerTerm = searchTerm.toLowerCase().trim();
        return films.filter(film =>
            film.nome.toLowerCase().includes(lowerTerm) ||
            (film.preco && film.preco.toString().includes(lowerTerm)) ||
            (film.maoDeObra && film.maoDeObra.toString().includes(lowerTerm))
        );
    }, [films, searchTerm]);

    const displayedFilms = React.useMemo(() => {
        return filteredFilms.slice(0, visibleCount);
    }, [filteredFilms, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const handleToggleExpand = (filmName: string) => {
        setExpandedFilmName(prev => (prev === filmName ? null : filmName));
    };

    return (
        <div className="space-y-4 p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Minhas Películas</h2>
                {films.length > 0 && (
                    <button
                        onClick={onAdd}
                        className="px-5 py-2.5 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition duration-300 shadow-sm flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Nova Película
                    </button>
                )}
            </div>

            {/* Search Bar */}
            {films.length > 0 && (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <i className="fas fa-search text-slate-400 text-lg"></i>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar película..."
                        className="w-full pl-12 pr-10 py-4 rounded-xl border-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-slate-500 transition-all text-base"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setVisibleCount(10);
                        }}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setVisibleCount(10);
                            }}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <i className="fas fa-times-circle text-lg"></i>
                        </button>
                    )}
                </div>
            )}

            {displayedFilms.length > 0 ? (
                <div className="space-y-3">
                    {displayedFilms.map(film => (
                        <FilmCard
                            key={film.nome}
                            film={film}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isExpanded={expandedFilmName === film.nome}
                            onToggleExpand={() => handleToggleExpand(film.nome)}
                            swipedItemName={swipedItemName}
                            onSetSwipedItem={setSwipedItemName}
                            onOpenGallery={onOpenGallery}
                        />
                    ))}

                    {visibleCount < filteredFilms.length && (
                        <div className="pt-4 flex justify-center">
                            <button
                                onClick={handleLoadMore}
                                className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-full shadow-md hover:shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300"
                            >
                                <span>Carregar mais</span>
                                <i className="fas fa-chevron-down text-sm group-hover:translate-y-0.5 transition-transform"></i>
                            </button>
                        </div>
                    )}
                </div>
            ) : searchTerm ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                        <i className="fas fa-search text-slate-400 text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Nenhuma película encontrada</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Tente buscar com outros termos.</p>
                </div>
            ) : (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[350px] opacity-0 animate-fade-in">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <i className="fas fa-layer-group text-4xl text-slate-400 dark:text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Nenhuma Película Cadastrada</h3>
                    <p className="text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mb-8 text-sm">
                        Adicione os tipos de películas com que você trabalha.
                    </p>
                    <button
                        onClick={onAdd}
                        className="px-8 py-3.5 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center gap-3"
                    >
                        <i className="fas fa-plus text-lg"></i>
                        <span>Adicionar Película</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default FilmListView;