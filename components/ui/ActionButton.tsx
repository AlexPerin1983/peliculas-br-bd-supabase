import React from 'react';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ActionButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ActionButtonVariant;
    size?: ActionButtonSize;
    iconClassName?: string;
    loading?: boolean;
    loadingText?: string;
    iconOnly?: boolean;
}

const variantClasses: Record<ActionButtonVariant, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700 shadow-lg shadow-slate-900/10 dark:bg-blue-600 dark:hover:bg-blue-700',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/10',
};

const sizeClasses: Record<ActionButtonSize, string> = {
    sm: 'h-9 px-3 text-sm rounded-lg',
    md: 'h-11 px-4 text-sm rounded-xl',
    lg: 'h-14 px-5 text-sm rounded-xl',
};

const iconOnlySizeClasses: Record<ActionButtonSize, string> = {
    sm: 'h-9 w-9 rounded-lg',
    md: 'h-11 w-11 rounded-xl',
    lg: 'h-14 w-14 rounded-xl',
};

const ActionButton: React.FC<ActionButtonProps> = ({
    variant = 'primary',
    size = 'md',
    iconClassName,
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
            className={`inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]} ${className}`}
            {...props}
        >
            {loading ? (
                <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    {!iconOnly && <span>{loadingText || children}</span>}
                </>
            ) : (
                <>
                    {iconClassName && <i className={iconClassName} aria-hidden="true"></i>}
                    {!iconOnly && <span>{children}</span>}
                </>
            )}
        </button>
    );
};

export default ActionButton;
