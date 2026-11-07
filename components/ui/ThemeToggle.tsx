import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../src/contexts/ThemeContext';

interface ThemeToggleProps {
    variant?: 'header' | 'sidebar';
    compact?: boolean;
    /** Altura da linha na variante sidebar: 'md' (computador) ou 'lg' (menu do celular). */
    size?: 'md' | 'lg';
    className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'header', compact = false, size = 'md', className = '' }) => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const Icon = isDark ? Moon : Sun;
    const nextLabel = isDark ? 'Trocar para modo claro' : 'Trocar para modo escuro';

    if (variant === 'sidebar') {
        if (compact) {
            return (
                <button
                    type="button"
                    onClick={toggleTheme}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-150 hover:bg-slate-100 hover:text-[var(--text-strong)] dark:hover:bg-white/[0.06] ${className}`.trim()}
                    aria-label={nextLabel}
                    title={nextLabel}
                >
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
            );
        }

        // Linha igual às do menu: ícone, "Modo escuro" e a chave ligada quando o tema escuro está ativo.
        const isLarge = size === 'lg';
        return (
            <button
                type="button"
                onClick={toggleTheme}
                className={[
                    'group flex w-full items-center gap-3 px-3 text-left transition-colors duration-150 hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06]',
                    isLarge ? 'h-12 rounded-[10px]' : 'h-9 rounded-lg',
                    className
                ].join(' ').trim()}
                aria-label={nextLabel}
                title={nextLabel}
            >
                <Moon
                    className={`${isLarge ? 'h-[18px] w-[18px]' : 'h-4 w-4'} shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-body)]`}
                    strokeWidth={1.75}
                    aria-hidden="true"
                />
                <span className={`min-w-0 flex-1 truncate font-medium text-[var(--text-body)] ${isLarge ? 'text-[15px]' : 'text-sm'}`}>
                    Modo escuro
                </span>
                <span
                    aria-hidden="true"
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${
                        isDark ? 'bg-[var(--brand-primary)]' : 'bg-slate-200 dark:bg-white/15'
                    }`}
                >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.2)] transition-transform duration-150 ${
                        isDark ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                </span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-all duration-200 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${className}`.trim()}
            aria-label={nextLabel}
            title={nextLabel}
        >
            <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
    );
};

export default ThemeToggle;
