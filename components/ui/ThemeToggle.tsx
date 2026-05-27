import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../src/contexts/ThemeContext';

interface ThemeToggleProps {
    variant?: 'header' | 'sidebar';
    compact?: boolean;
    className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'header', compact = false, className = '' }) => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const Icon = isDark ? Moon : Sun;
    const label = isDark ? 'Modo escuro' : 'Modo claro';
    const nextLabel = isDark ? 'Trocar para modo claro' : 'Trocar para modo escuro';

    if (variant === 'sidebar') {
        if (compact) {
            return (
                <button
                    type="button"
                    onClick={toggleTheme}
                    className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-all duration-200 hover:bg-[var(--surface)] hover:text-[var(--brand-primary)] dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-blue-200 ${className}`.trim()}
                    aria-label={nextLabel}
                    title={nextLabel}
                >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
            );
        }

        return (
            <button
                type="button"
                onClick={toggleTheme}
                className={`group flex w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-left text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-all duration-200 hover:bg-[var(--surface)] hover:text-[var(--text-strong)] dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:hover:bg-white/[0.07] dark:hover:text-white ${className}`.trim()}
                aria-label={nextLabel}
                title={nextLabel}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface)] text-[var(--brand-primary)] transition-colors group-hover:bg-[var(--brand-primary-soft)] dark:bg-white/8 dark:text-blue-300 dark:group-hover:bg-white/10 dark:group-hover:text-blue-200">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight">{label}</span>
                    <span className="mt-0.5 block text-[10px] font-medium text-[var(--text-muted)] dark:text-slate-500 dark:group-hover:text-slate-400">
                        Alternar tema
                    </span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ${
                    isDark
                        ? 'border-blue-300/30 bg-blue-400/25'
                        : 'border-[var(--border-subtle)] bg-slate-200'
                }`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isDark ? 'translate-x-6' : 'translate-x-1'
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
