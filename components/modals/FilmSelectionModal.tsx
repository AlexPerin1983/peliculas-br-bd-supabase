import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Film } from '../../types';
import { matchesSearch } from '../../src/lib/textSearch';
import { sortFilmsForDisplay } from '../../src/lib/filmCatalog';
import { useIsMobile } from '../../src/hooks/useIsMobile';

interface FilmSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    films: Film[];
    onSelect: (filmName: string) => void;
    onAddNewFilm: (filmName: string) => void;
    onEditFilm: (film: Film) => void;
    onDeleteFilm: (filmName: string) => void;
    onTogglePin: (filmName: string) => void; // Nova prop para fixar/desfixar
    /**
     * No mobile, renderiza o seletor NO LUGAR (dentro do sheet vaul) em vez de
     * portar para o body. Necessário quando o seletor é aberto por cima de um
     * bottom sheet: o vaul torna inerte tudo que fica fora do sheet (bloqueia
     * scroll/foco/toque), então portar para o body deixava a lista travada.
     */
    renderInSheet?: boolean;
    /**
     * Marcar várias películas: tocar marca/desmarca e o botão do rodapé
     * confirma todas de uma vez (onSelectMultiple), na ordem em que foram marcadas.
     */
    onSelectMultiple?: (filmNames: string[]) => void;
}

const FilmListItem: React.FC<{
    film: Film;
    onSelect: (filmName: string) => void;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
    swipedItemName: string | null;
    onSetSwipedItem: (name: string | null) => void;
    onTogglePin: (filmName: string) => void; // Nova prop
    /** Definido só quando o seletor marca várias: mostra a caixa de marcar. */
    checked?: boolean;
}> = ({ film, onSelect, onEdit, onDelete, swipedItemName, onSetSwipedItem, onTogglePin, checked }) => {
    const isCheckable = checked !== undefined;
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
    // Sem preço de venda, mostra a mão de obra (e diz que é ela).
    const isLaborPrice = !(film.preco > 0) && film.maoDeObra > 0;

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
        <div className={`relative overflow-hidden rounded-xl border bg-white transition-[transform,border-color,box-shadow] duration-150 ease-out dark:bg-slate-800 ${isPressing
            ? 'scale-[0.98] border-slate-300 dark:border-slate-600'
            : checked
                ? 'border-blue-500 ring-1 ring-blue-500'
                : 'border-slate-200 dark:border-slate-700/80'
            }`}>
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
                    role={isCheckable ? 'checkbox' : 'button'}
                    aria-checked={isCheckable ? checked : undefined}
                    aria-label={isCheckable ? film.nome : undefined}
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
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-700/60"
                >
                    {isCheckable && (
                        <span
                            aria-hidden="true"
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${checked
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-slate-300 dark:border-slate-500'}`}
                        >
                            {checked && <i className="fas fa-check text-xs"></i>}
                        </span>
                    )}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        {film.pinned && (
                            <i className="fas fa-thumbtack w-3 shrink-0 text-xs text-slate-400 dark:text-slate-500" aria-label="Fixada"></i>
                        )}
                        <p className="truncate text-[15px] font-medium text-slate-800 dark:text-slate-100">{film.nome}</p>
                    </div>
                    <p className="shrink-0 text-right tabular-nums">
                        <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pricePerM2)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">/m²{isLaborPrice ? ' mão de obra' : ''}</span>
                    </p>
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

const FilmSelectionModal: React.FC<FilmSelectionModalProps> = ({ isOpen, onClose, films, onSelect, onAddNewFilm, onEditFilm, onDeleteFilm, onTogglePin, renderInSheet = false, onSelectMultiple }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [swipedItemName, setSwipedItemName] = useState<string | null>(null);
    const [checkedFilms, setCheckedFilms] = useState<string[]>([]);
    const debouncedSearchTerm = useDebounce(searchTerm, 200);
    const inputRef = useRef<HTMLInputElement>(null);
    const isMobile = useIsMobile();
    const isMultiple = !!onSelectMultiple;
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setCheckedFilms([]);
            setIsSearchFocused(false);
            // Só com teclado físico: no celular o foco abre o teclado e cobre a lista.
            const hasTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
            if (!isMobile && !hasTouch) setTimeout(() => inputRef.current?.focus(), 100);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Película renomeada ou excluída enquanto marcada sai da seleção.
    useEffect(() => {
        setCheckedFilms(current => {
            const next = current.filter(name => films.some(film => film.nome === name));
            return next.length === current.length ? current : next;
        });
    }, [films]);

    const filteredFilms = useMemo(() => {
        const result = debouncedSearchTerm
            ? films.filter(film => matchesSearch(film.nome, debouncedSearchTerm))
            : films;

        // Mesma ordem da tela Películas: fixadas no topo, depois de A a Z.
        return sortFilmsForDisplay(result);
    }, [films, debouncedSearchTerm]);

    if (!isOpen || typeof document === 'undefined') return null;

    const handleSelectFilm = (filmName: string) => {
        if (isMultiple) {
            setCheckedFilms(current => current.includes(filmName)
                ? current.filter(name => name !== filmName)
                : [...current, filmName]);
            return;
        }
        onSelect(filmName);
        onClose();
    };

    const handleConfirmMultiple = () => {
        if (!onSelectMultiple || checkedFilms.length === 0) return;
        onSelectMultiple(checkedFilms);
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

    const node = (
        <div className="pointer-events-auto fixed inset-0 z-[10060] flex flex-col bg-slate-50 pt-[env(safe-area-inset-top,0px)] animate-fade-in dark:bg-slate-900" data-modal-companion>
            {/* Header */}
            <div className="sticky top-0 flex-shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
                    <div className="min-w-0 pt-1.5">
                        <h2 className="text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100">
                            {isMultiple ? 'Selecionar películas' : 'Selecionar película'}
                        </h2>
                        {isMultiple && (
                            <p className="mt-0.5 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                                Cada película marcada vira uma opção com PDF
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
                        <i className="fas fa-times text-lg"></i>
                    </button>
                </div>
                <div className="relative mx-auto mt-3 max-w-3xl">
                    <i className="fas fa-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
                    <input
                        ref={inputRef}
                        type="search"
                        enterKeyHint="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        placeholder="Buscar película"
                        aria-label="Buscar película"
                        className="h-11 w-full rounded-xl border border-transparent bg-slate-100 pl-10 pr-11 text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-800 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            aria-label="Limpar busca"
                        >
                            <i className="fas fa-times-circle"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto overscroll-contain px-4 py-3">
                <div className="mx-auto max-w-3xl space-y-2">
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
                            checked={isMultiple ? checkedFilms.includes(film.nome) : undefined}
                        />
                    ))}
                    {filteredFilms.length === 0 && debouncedSearchTerm && (
                        <div className="px-4 py-10 text-center">
                            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Nenhuma película com o nome <span className="font-medium text-slate-700 dark:text-slate-200">“{debouncedSearchTerm}”</span></p>
                            <button
                                type="button"
                                onClick={handleAddNew}
                                className="mx-auto flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                <i className="fas fa-plus text-sm"></i>
                                <span className="text-sm font-medium">Adicionar “{debouncedSearchTerm}”</span>
                            </button>
                        </div>
                    )}
                    {/* Marcando várias, o rodapé fica só com "Gerar": adicionar vai no fim da lista. */}
                    {isMultiple && !(filteredFilms.length === 0 && debouncedSearchTerm) && (
                        <button
                            type="button"
                            onClick={() => onAddNewFilm(searchTerm)}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <i className="fas fa-plus text-sm"></i>
                            <span className="text-sm font-medium">Adicionar nova película</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Footer */}
            {/* No celular, enquanto digita na busca, o rodapé some para a lista caber acima do teclado. */}
            {!(isMobile && isSearchFocused) && (
                <div className="sticky bottom-0 flex-shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mx-auto max-w-3xl">
                        {isMultiple ? (
                            <button
                                type="button"
                                onClick={handleConfirmMultiple}
                                disabled={checkedFilms.length === 0}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-500 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                            >
                                <i className="fas fa-file-pdf text-sm"></i>
                                <span className="text-[15px] font-semibold">
                                    {checkedFilms.length === 0
                                        ? 'Marque as películas'
                                        : checkedFilms.length === 1
                                            ? 'Gerar 1 opção'
                                            : `Gerar ${checkedFilms.length} opções`}
                                </span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onAddNewFilm('')}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                            >
                                <i className="fas fa-plus text-sm"></i>
                                <span className="text-[15px] font-semibold">Adicionar nova película</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
      <style>{`
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

    // No mobile, quando aberto por cima de um bottom sheet, precisa renderizar
    // DENTRO do sheet (não portar para o body), senão o vaul torna a lista
    // inerte e o usuário não consegue rolar, buscar nem selecionar.
    if (isMobile && renderInSheet) return node;

    return createPortal(node, document.body);
};

export default FilmSelectionModal;
