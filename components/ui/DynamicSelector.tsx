import React, { useState, useEffect, useRef } from 'react';

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
        option.toLowerCase().includes(inputValue.toLowerCase())
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
            <label className="block text-sm font-medium text-slate-600">{label}</label>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setShowDropdown(true)}
                className="w-full mt-1 p-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm disabled:bg-slate-100"
                disabled={disabled}
            />
            {showDropdown && filteredOptions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                    {filteredOptions.map(option => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className="p-2 hover:bg-slate-100 cursor-pointer text-slate-700"
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