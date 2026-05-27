import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface StatusFilterOption {
  value: string;
  label: string;
  emoji?: string;
}

interface StatusFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: StatusFilterOption[];
}

export const StatusFilterDropdown: React.FC<StatusFilterDropdownProps> = ({
  value,
  onChange,
  options
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] font-semibold text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text-strong)] active:scale-[0.99]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption.emoji && <span className="text-[var(--text-soft)]">{selectedOption.emoji}</span>}
          {selectedOption.label}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[1000] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-elevated)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors ${
                option.value === value
                  ? 'bg-[var(--brand-primary-soft)] font-semibold text-[var(--brand-primary)]'
                  : 'text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.emoji && <span className="text-[var(--text-soft)]">{option.emoji}</span>}
              <span className="flex-1">{option.label}</span>
              {option.value === value && (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
