import React, { useEffect, useRef, useState } from 'react';

export interface BrandSelectOption {
    value: number | string;
    label: string;
}

interface BrandSelectProps {
    id: string;
    label: string;
    options: BrandSelectOption[];
    value: number | string;
    onChange: (value: number | string) => void;
    disabled?: boolean;
}

const BrandSelect: React.FC<BrandSelectProps> = ({ id, label, options, value, onChange, disabled }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find(option => option.value === value);

    const handleSelect = (optionValue: number | string) => {
        onChange(optionValue);
        setOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <label htmlFor={id} className="ui-label block">{label}</label>
            <button
                id={id}
                type="button"
                disabled={disabled}
                onClick={() => setOpen(prev => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="ui-field mt-1 flex w-full items-center justify-between px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
                <span>{selected?.label ?? 'Selecionar'}</span>
                <i
                    className={`fas fa-chevron-down text-xs text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 shadow-lg"
                >
                    {options.map(option => {
                        const isSelected = option.value === value;
                        return (
                            <li
                                key={String(option.value)}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(option.value)}
                                className={`cursor-pointer px-3 py-2.5 text-sm transition-colors ${
                                    isSelected
                                        ? 'bg-[var(--brand-primary-soft)] font-semibold text-[var(--brand-primary)]'
                                        : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
                                }`}
                            >
                                {option.label}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default BrandSelect;
