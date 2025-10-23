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
    onAddOption,
    onRenameOption,
    onDeleteOption
}) => {
    const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

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

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 border-b border-slate-200">
            {options.map((option) => (
                <div
                    key={option.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${
                        activeOptionId === option.id
                            ? 'bg-slate-800 text-white shadow-sm'
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
    );
};

export default React.memo(ProposalOptionsTabs);