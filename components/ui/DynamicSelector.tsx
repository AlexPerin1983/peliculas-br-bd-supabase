import React, { useState, useEffect, useRef } from 'react';
import { matchesSearch } from '../../src/lib/textSearch';
import { selectAllOnFocus } from '../../src/lib/selectOnFocus';

interface DynamicSelectorProps {
    label: string;
    options: string[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const DynamicSelector: React.FC<DynamicSelectorProps> = ({ label, options, value, onChange, disabled }) => {
    const [inputValue, setInputValue] = useState(value);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredOptions = options.filter(option =>
        matchesSearch(option, inputValue)
    );

    const handleSelect = (option: string) => {
        setInputValue(option);
        onChange(option);
        setShowDropdown(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setShowDropdown(true);
        onChange(e.target.value);
    }

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400">{label}</label>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={(e) => {
                    setShowDropdown(true);
                    selectAllOnFocus(e);
                }}
                className="w-full mt-1 p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm disabled:bg-slate-100 dark:disabled:bg-slate-800"
                disabled={disabled}
            />
            {showDropdown && filteredOptions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                    {filteredOptions.map(option => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default DynamicSelector;