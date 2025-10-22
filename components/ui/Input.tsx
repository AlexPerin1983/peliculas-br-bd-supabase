import React, { ReactNode, forwardRef } from 'react';

type BaseProps = {
    id: string;
    label: string;
    className?: string;
};

type InputProps = BaseProps & {
    as?: 'input';
    children?: never;
} & React.InputHTMLAttributes<HTMLInputElement>;

type TextareaProps = BaseProps & {
    as: 'textarea';
    children?: never;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type SelectProps = BaseProps & {
    as: 'select';
    children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>;

type CombinedProps = InputProps | TextareaProps | SelectProps;

type RefType = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const Input = forwardRef<RefType, CombinedProps>(({ id, label, as = 'input', children, className, ...props }, ref) => {
    const commonClasses = "mt-1 block w-full p-3 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-base disabled:bg-slate-100 disabled:cursor-not-allowed";
    const labelClasses = "block text-sm font-medium text-slate-700";

    const renderInput = () => {
        const combinedClassName = `${commonClasses} ${className || ''}`;
        
        if (as === 'textarea') {
            return <textarea id={id} {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} className={combinedClassName} ref={ref as React.Ref<HTMLTextAreaElement>} />;
        }
        if (as === 'select') {
             return (
                <select id={id} {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} className={combinedClassName} ref={ref as React.Ref<HTMLSelectElement>}>
                    {children}
                </select>
            );
        }
        return <input id={id} {...(props as React.InputHTMLAttributes<HTMLInputElement>)} className={combinedClassName} ref={ref as React.Ref<HTMLInputElement>} />;
    };

    return (
        <div>
            <label htmlFor={id} className={labelClasses}>{label}</label>
            {renderInput()}
        </div>
    );
});

export default Input;