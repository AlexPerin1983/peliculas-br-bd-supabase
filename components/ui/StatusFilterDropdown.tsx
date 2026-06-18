import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; width: number } | null>(null);

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ left: rect.left, top: rect.bottom + 8, width: rect.width });
  };

  // Mede a posição do gatilho ao abrir (e ao rolar/redimensionar) para o menu
  // flutuar no lugar certo via portal — fora de qualquer card com overflow.
  useLayoutEffect(() => {
    if (isOpen) updateCoords();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onReposition = () => updateCoords();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [isOpen]);

  // Fecha ao clicar fora (gatilho e menu vivem em árvores diferentes por causa do portal)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1">
      <button
        ref={triggerRef}
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] font-semibold text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text-strong)] active:scale-[0.99]"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption.emoji && <span className="text-[var(--text-soft)]">{selectedOption.emoji}</span>}
          {selectedOption.label}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{ position: 'fixed', left: coords.left, top: coords.top, width: coords.width }}
          className="z-[2000] max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-[14px] transition-colors sm:py-2.5 sm:text-[13px] ${
                option.value === value
                  ? 'bg-blue-50 font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70'
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.emoji && <span className="text-slate-400">{option.emoji}</span>}
              <span className="flex-1">{option.label}</span>
              {option.value === value && (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
