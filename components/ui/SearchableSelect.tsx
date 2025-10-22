
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface SearchableSelectProps<T> {
    options: T[];
    value: T[keyof T] | null;
    onChange: (value: T[keyof T] | null) => void;
    displayField: keyof T;
    valueField: keyof T;
    placeholder: string;
    loadingPlaceholder?: string;
    disabled?: boolean;
    loading?: boolean;
    onFocus?: () => void;
    autoFocus?: boolean;
    renderNoResults?: (searchTerm: string) => React.ReactNode;
    onMagicClick?: (searchTerm: string) => void;
}

const SearchableSelect = <T extends { [key: string]: any }>({
    options,
    value,
    onChange,
    displayField,
    valueField,
    placeholder,
    loadingPlaceholder,
    disabled = false,
    loading = false,
    onFocus,
    autoFocus = false,
    renderNoResults,
    onMagicClick,
}: SearchableSelectProps<T>) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => 
        options.find(opt => opt[valueField] === value), 
    [options, value, valueField]);

    // Effect to set display text when dropdown is closed or value changes
    useEffect(() => {
        if (!isOpen) {
            const displayValue = selectedOption ? String(selectedOption[displayField]) : '';
            setSearchTerm(displayValue);
            setDebouncedSearchTerm(displayValue);
        }
    }, [isOpen, selectedOption, displayField]);
    
    // Effect for debouncing user input
    useEffect(() => {
        const timerId = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);

        return () => {
            clearTimeout(timerId);
        };
    }, [searchTerm]);

    // Effect to handle clicks outside the component
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to autofocus the input
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const filteredOptions = useMemo(() => {
        if (!debouncedSearchTerm) {
            return options;
        }
        return options.filter(option =>
            String(option[displayField]).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
    }, [options, debouncedSearchTerm, displayField]);

    const handleSelect = (option: T) => {
        const displayValue = String(option[displayField]);
        onChange(option[valueField]);
        setSearchTerm(displayValue);
        setDebouncedSearchTerm(displayValue); // Update immediately on select
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (!isOpen) setIsOpen(true);
    };
    
    const handleInputFocus = () => {
        if (onFocus) onFocus();
        setIsOpen(true);
    };
    
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSearchTerm('');
        setDebouncedSearchTerm(''); // Clear debounced term immediately
        onChange(null);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const currentPlaceholder = loading && loadingPlaceholder ? loadingPlaceholder : placeholder;

    return (
        <div className="relative flex-grow" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder={currentPlaceholder}
                    className="w-full p-3 pr-12 text-base bg-white text-slate-900 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    disabled={disabled || loading}
                    autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
                    {searchTerm && !disabled && !loading && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            aria-label="Limpar seleção"
                        >
                            <i className="fas fa-times text-sm"></i>
                        </button>
                    )}
                    {searchTerm && onMagicClick && !disabled && !loading && (
                        <button
                            type="button"
                            onClick={() => onMagicClick(searchTerm)}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            aria-label="Sugestão com IA"
                        >
                            <i className="fas fa-wand-magic-sparkles text-sm"></i>
                        </button>
                    )}
                    {loading ? (
                        <i className="fas fa-spinner fa-spin text-slate-400"></i>
                    ) : !searchTerm ? (
                        <i className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} pointer-events-none`}></i>
                    ) : null}
                </div>
            </div>
            {isOpen && (
                <ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                    {loading ? (
                         <li className="p-2 text-slate-500 text-center flex items-center justify-center">
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Carregando...
                        </li>
                    ) : filteredOptions.length > 0 ? (
                        filteredOptions.map(option => (
                            <li
                                key={option[valueField]}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(option);
                                }}
                                className={`p-3 hover:bg-slate-100 cursor-pointer text-slate-700 ${value === option[valueField] ? 'bg-slate-200' : ''}`}
                            >
                                {String(option[displayField])}
                            </li>
                        ))
                    ) : (
                        debouncedSearchTerm && renderNoResults ? (
                            renderNoResults(debouncedSearchTerm)
                        ) : (
                            <li className="p-3 text-slate-500">Nenhum resultado encontrado</li>
                        )
                    )}
                </ul>
            )}
        </div>
    );
};

export default SearchableSelect;
