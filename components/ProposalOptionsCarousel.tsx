import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProposalOption } from '../types';

interface ProposalOptionsCarouselProps {
    options: ProposalOption[];
    activeOptionId: number;
    onSelectOption: (optionId: number) => void;
    onAddOption: () => void;
    onRenameOption: (optionId: number, newName: string) => void;
    onDeleteOption: (optionId: number) => void;
    onSwipeDirectionChange: (direction: 'left' | 'right' | null, distance: number) => void;
}

const ProposalOptionsCarousel: React.FC<ProposalOptionsCarouselProps> = ({
    options,
    activeOptionId,
    onSelectOption,
    onRenameOption,
    onDeleteOption,
    onAddOption,
    onSwipeDirectionChange
}) => {
    const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const previousActiveIdRef = useRef<number>(activeOptionId);

    // Effect to scroll the active item into view
    useEffect(() => {
        const activeItem = itemRefs.current.get(activeOptionId);
        const carousel = carouselRef.current;

        if (activeItem && carousel) {
            const itemRect = activeItem.getBoundingClientRect();
            const carouselRect = carousel.getBoundingClientRect();

            // Calculate scroll position to center the item
            const scrollPosition = activeItem.offsetLeft - (carouselRect.width / 2) + (itemRect.width / 2);

            carousel.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });

            // Handle swipe direction change for the parent component animation
            if (previousActiveIdRef.current !== activeOptionId) {
                const previousIndex = options.findIndex(opt => opt.id === previousActiveIdRef.current);
                const currentIndex = options.findIndex(opt => opt.id === activeOptionId);

                if (previousIndex !== -1 && currentIndex !== -1) {
                    const distance = Math.abs(currentIndex - previousIndex);
                    const direction = currentIndex > previousIndex ? 'left' : 'right';

                    onSwipeDirectionChange(direction, distance);

                    // Clear animation state after a fixed duration
                    setTimeout(() => {
                        onSwipeDirectionChange(null, 0);
                    }, 500); // Use a fixed duration for the visual effect
                }
                previousActiveIdRef.current = activeOptionId;
            }
        }
    }, [activeOptionId, options, onSwipeDirectionChange]);

    // Effect to focus input when editing starts
    useEffect(() => {
        if (editingOptionId !== null && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingOptionId]);

    const handleStartEdit = (option: ProposalOption, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingOptionId(option.id);
        setEditingName(option.name);
    };

    const handleSaveEdit = () => {
        if (editingOptionId !== null && editingName.trim()) {
            onRenameOption(editingOptionId, editingName.trim());
        }
        setEditingOptionId(null);
        setEditingName('');
    };

    const handleCancelEdit = () => {
        setEditingOptionId(null);
        setEditingName('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const setItemRef = useCallback((id: number, el: HTMLDivElement | null) => {
        if (el) {
            itemRefs.current.set(id, el);
        } else {
            itemRefs.current.delete(id);
        }
    }, []);

    return (
        <div className="flex flex-col">
            <div
                ref={carouselRef}
                className="flex items-center gap-2 overflow-x-scroll pb-2 mb-4 border-b border-slate-200 dark:border-slate-700 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollPadding: '0 40%' }} // Padding to help center items
            >
                {options.map((option) => (
                    <div
                        key={option.id}
                        ref={(el) => setItemRef(option.id, el)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all duration-200 flex-shrink-0 snap-center ${activeOptionId === option.id
                            ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {editingOptionId === option.id ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={handleSaveEdit}
                                onKeyDown={handleKeyDown}
                                className="w-20 px-1 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                onClick={() => onSelectOption(option.id)}
                                className="text-xs font-semibold cursor-pointer"
                            >
                                {option.name}
                            </span>
                        )}

                        {activeOptionId === option.id && editingOptionId !== option.id && (
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={(e) => handleStartEdit(option, e)}
                                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${activeOptionId === option.id ? 'hover:bg-slate-700 dark:hover:bg-slate-600' : 'hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                                    aria-label="Renomear opção"
                                >
                                    <i className="fas fa-pen text-[10px]"></i>
                                </button>
                                {options.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteOption(option.id);
                                        }}
                                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${activeOptionId === option.id ? 'hover:bg-red-600' : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600'}`}
                                        aria-label="Excluir opção"
                                    >
                                        <i className="fas fa-times text-[10px]"></i>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                <button
                    onClick={onAddOption}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors snap-start"
                    aria-label="Adicionar nova opção"
                >
                    <i className="fas fa-plus text-xs"></i>
                </button>
            </div>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default React.memo(ProposalOptionsCarousel);