import React, { useState, useRef, useEffect } from 'react';
import { ProposalOption } from '../types';

interface ProposalOptionsTabsProps {
    options: ProposalOption[];
    activeOptionId: number;
    onSelectOption: (optionId: number) => void;
    onAddOption: () => void;
    onRenameOption: (optionId: number, newName: string) => void;
    onDeleteOption: (optionId: number) => void;
}

const ProposalOptionsTabs: React.FC<ProposalOptionsTabsProps> = ({
    options,
    activeOptionId,
    onSelectOption,
    onRenameOption,
    onDeleteOption,
    onAddOption
}) => {
    const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const previousActiveIdRef = useRef<number>(activeOptionId);

    useEffect(() => {
        if (editingOptionId !== null && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingOptionId]);

    useEffect(() => {
        if (previousActiveIdRef.current !== activeOptionId) {
            const previousIndex = options.findIndex(opt => opt.id === previousActiveIdRef.current);
            const currentIndex = options.findIndex(opt => opt.id === activeOptionId);
            
            if (previousIndex !== -1 && currentIndex !== -1) {
                const direction = currentIndex > previousIndex ? 'left' : 'right';
                setSwipeDirection(direction);
                setIsAnimating(true);
                
                setTimeout(() => {
                    setSwipeDirection(null);
                    setIsAnimating(false);
                }, 400);
            }
            
            previousActiveIdRef.current = activeOptionId;
        }
    }, [activeOptionId, options]);

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

    return (
        <>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 border-b border-slate-200 scrollbar-hide">
                {options.map((option) => (
                    <div
                        key={option.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0 ${
                            activeOptionId === option.id
                                ? 'bg-slate-800 text-white shadow-sm scale-105'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                                className="w-24 px-2 py-1 text-sm bg-white text-slate-800 border border-slate-300 rounded"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                onClick={() => onSelectOption(option.id)}
                                className="text-sm font-semibold"
                            >
                                {option.name}
                            </span>
                        )}
                        
                        {activeOptionId === option.id && editingOptionId !== option.id && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => handleStartEdit(option, e)}
                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors"
                                    aria-label="Renomear opção"
                                >
                                    <i className="fas fa-pen text-xs"></i>
                                </button>
                                {options.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Excluir a opção "${option.name}"?`)) {
                                                onDeleteOption(option.id);
                                            }
                                        }}
                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-600 transition-colors"
                                        aria-label="Excluir opção"
                                    >
                                        <i className="fas fa-times text-xs"></i>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                
                <button
                    onClick={onAddOption}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                    aria-label="Adicionar nova opção"
                >
                    <i className="fas fa-plus text-sm"></i>
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

                @keyframes slide-out-left {
                    0% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                    50% {
                        opacity: 0.3;
                        transform: translateX(-40px) scale(0.95);
                    }
                    51% {
                        opacity: 0;
                        transform: translateX(40px) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
                
                @keyframes slide-out-right {
                    0% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                    50% {
                        opacity: 0.3;
                        transform: translateX(40px) scale(0.95);
                    }
                    51% {
                        opacity: 0;
                        transform: translateX(-40px) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
                
                ${isAnimating ? `
                    :global(#contentContainer) {
                        animation: ${swipeDirection === 'left' ? 'slide-out-left' : 'slide-out-right'} 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                ` : ''}
            `}</style>
        </>
    );
};

export default React.memo(ProposalOptionsTabs);