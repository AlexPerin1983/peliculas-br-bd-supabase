import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Film } from '../../types';

interface FilmSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    films: Film[];
    onSelect: (filmName: string) => void;
    onAddNewFilm: (filmName: string) => void;
    onEditFilm: (film: Film) => void;
    onDeleteFilm: (filmName: string) => void;
    onTogglePin: (filmName: string) => void; // Nova prop para fixar/desfixar
}

const FilmListItem: React.FC<{
    film: Film;
    onSelect: (filmName: string) => void;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
    swipedItemName: string | null;
    onSetSwipedItem: (name: string | null) => void;
    onTogglePin: (filmName: string) => void; // Nova prop
}> = ({ film, onSelect, onEdit, onDelete, swipedItemName, onSetSwipedItem, onTogglePin }) => {
    const [translateX, setTranslateX] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDraggingCard = useRef(false);
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const swipeableRef = useRef<HTMLDivElement>(null);
    const currentTranslateX = useRef(0);
    const ACTIONS_WIDTH = 160;

    // Estados para long press
    const [isPressing, setIsPressing] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const touchStartTime = useRef<number>(0);
    const hasMoved = useRef(false);

    const pricePerM2 = film.preco || film.maoDeObra || 0;
    const priceLabel = film.preco > 0 ? 'Preço' : (film.maoDeObra > 0 ? 'Mão de Obra' : 'Preço');

    useEffect(() => {
        if (swipedItemName !== film.nome && swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
        }
    }, [swipedItemName, film.nome]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (swipedItemName && swipedItemName !== film.nome) {
            onSetSwipedItem(null);
        }
        isDraggingCard.current = true;
        gestureDirection.current = null;
        hasMoved.current = false;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        setIsPressing(true);

        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'none';
        }

        // Inicia timer para long press
        longPressTimer.current = setTimeout(() => {
            if (!hasMoved.current) {
                // Vibração de feedback (se disponível)
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                onTogglePin(film.nome);
                setIsPressing(false);
                isDraggingCard.current = false;
            }
        }, 800); // 800ms para ativar o long press (aumentado para evitar acidentes)
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingCard.current || !swipeableRef.current) return;

        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        // Se moveu mais de 5px, cancela o long press (mais sensível para detectar scroll)
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            setIsPressing(false);
        }

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
        // Limpa o timer de long press
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        setIsPressing(false);

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
        e.preventDefault();
        e.stopPropagation();
        onDelete(film.nome);
        onSetSwipedItem(null);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit(film);
        onSetSwipedItem(null);
    };

    return (
        <div className={`relative rounded-lg overflow-hidden bg-white dark:bg-slate-800 border shadow-sm transition-all ${isPressing
            ? 'scale-95 border-slate-300 dark:border-slate-600'
            : 'border-slate-200 dark:border-slate-700'
            } ${film.pinned ? 'border-l-4 border-l-blue-500' : ''}`}>
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
                className="relative z-10 w-full bg-white dark:bg-slate-800"
            >
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                        if (translateX !== 0 && swipeableRef.current) {
                            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                            swipeableRef.current.style.transform = `translateX(0px)`;
                            currentTranslateX.current = 0;
                            setTranslateX(0);
                            if (swipedItemName === film.nome) {
                                onSetSwipedItem(null);
                            }
                        } else {
                            onSelect(film.nome);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(film.nome);
                        }
                    }}
                    className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 flex items-center justify-between gap-4 cursor-pointer"
                >
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                            {film.pinned && (
                                <i className="fas fa-thumbtack text-blue-500 text-sm"></i>
                            )}
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{film.nome}</p>
                        </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pricePerM2)}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">/ m² ({priceLabel})</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const FilmSelectionModal: React.FC<FilmSelectionModalProps> = ({ isOpen, onClose, films, onSelect, onAddNewFilm, onEditFilm, onDeleteFilm, onTogglePin }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [swipedItemName, setSwipedItemName] = useState<string | null>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 200);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredFilms = useMemo(() => {
        let result = films;
        if (debouncedSearchTerm) {
            result = films.filter(film =>
                film.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            );
        }
        // Ordenar: fixados primeiro (pelo mais recente), depois por nome
        return result.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            if (a.pinned && b.pinned) {
                // Ambos fixados: ordenar por pinnedAt decrescente (mais recente no topo)
                if (a.pinnedAt && b.pinnedAt) {
                    return b.pinnedAt - a.pinnedAt;
                }
                // Se não tiver pinnedAt (legado), mantém alfabético
                if (a.pinnedAt && !b.pinnedAt) return -1;
                if (!a.pinnedAt && b.pinnedAt) return 1;
            }
            return a.nome.localeCompare(b.nome);
        });
    }, [films, debouncedSearchTerm]);

    if (!isOpen) return null;

    const handleSelectFilm = (filmName: string) => {
        onSelect(filmName);
        onClose();
    };

    const handleAddNew = () => {
        onAddNewFilm(searchTerm);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        inputRef.current?.focus();
    };

    const handleEditFilm = (film: Film) => {
        onEditFilm(film);
    };

    const handleDeleteFilm = (filmName: string) => {
        onDeleteFilm(filmName);
    };

    return (
        <div className="fixed inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-[10000] flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0">
                <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Selecionar Película</h2>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div className="mt-4 max-w-3xl mx-auto relative">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar pelo nome da película..."
                        className="w-full pl-12 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 h-8 w-8 flex items-center justify-center"
                            aria-label="Limpar busca"
                        >
                            <i className="fas fa-times-circle text-lg"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto space-y-2">
                    {filteredFilms.map(film => (
                        <FilmListItem
                            key={film.nome}
                            film={film}
                            onSelect={handleSelectFilm}
                            onEdit={handleEditFilm}
                            onDelete={handleDeleteFilm}
                            swipedItemName={swipedItemName}
                            onSetSwipedItem={setSwipedItemName}
                            onTogglePin={onTogglePin}
                        />
                    ))}
                    {filteredFilms.length === 0 && debouncedSearchTerm && (
                        <div className="text-center py-10 px-4">
                            <p className="text-slate-500 dark:text-slate-400 mb-4">Nenhuma película encontrada com o nome <strong className="text-slate-700 dark:text-slate-300">"{debouncedSearchTerm}"</strong>.</p>
                            <button
                                onClick={handleAddNew}
                                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition duration-300 shadow-sm flex items-center justify-center gap-2 mx-auto"
                            >
                                <i className="fas fa-plus"></i>
                                Adicionar "{debouncedSearchTerm}"
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky bottom-0">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => onAddNewFilm('')}
                        className="w-full p-3 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition duration-300 shadow-md flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Nova Película
                    </button>
                </div>
            </div>
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

export default FilmSelectionModal;