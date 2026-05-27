import React from 'react';
import { Loader2 } from 'lucide-react';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ActionButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ActionButtonVariant;
    size?: ActionButtonSize;
    iconClassName?: string;
    icon?: React.ReactNode;
    loading?: boolean;
    loadingText?: string;
    iconOnly?: boolean;
}

const variantClasses: Record<ActionButtonVariant, string> = {
    primary: 'bg-[var(--brand-primary)] text-white shadow-[0_10px_20px_rgba(21,94,239,0.18)] hover:bg-[var(--brand-primary-strong)]',
    secondary: 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] shadow-[var(--shadow-hairline)] hover:bg-[var(--surface-muted)]',
    ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]',
    danger: 'bg-[var(--danger)] text-white shadow-[0_10px_20px_rgba(220,38,38,0.16)] hover:bg-red-700',
};

const sizeClasses: Record<ActionButtonSize, string> = {
    sm: 'h-9 px-3 text-sm rounded-[var(--radius-control)]',
    md: 'h-11 px-4 text-sm rounded-[var(--radius-control)]',
    lg: 'h-12 px-5 text-sm rounded-[var(--radius-control)]',
};

const iconOnlySizeClasses: Record<ActionButtonSize, string> = {
    sm: 'h-9 w-9 rounded-[var(--radius-control)]',
    md: 'h-11 w-11 rounded-[var(--radius-control)]',
    lg: 'h-12 w-12 rounded-[var(--radius-control)]',
};

const ActionButton: React.FC<ActionButtonProps> = ({
    variant = 'primary',
    size = 'md',
    iconClassName,
    icon,
    loading = false,
    loadingText,
    iconOnly = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...props
}) => {
    const isDisabled = disabled || loading;

    return (
        <button
            type={type}
            disabled={isDisabled}
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${variantClasses[variant]} ${iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]} ${className}`}
            {...props}
        >
            {loading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {!iconOnly && <span>{loadingText || children}</span>}
                </>
            ) : (
                <>
                    {icon ? <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">{icon}</span> : null}
                    {!icon && iconClassName && <i className={iconClassName} aria-hidden="true"></i>}
                    {!iconOnly && <span>{children}</span>}
                </>
            )}
        </button>
    );
};

export default ActionButton;
