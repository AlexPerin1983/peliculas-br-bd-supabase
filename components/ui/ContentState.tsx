import React from 'react';
import ActionButton from './ActionButton';

interface ContentStateProps {
    iconClassName: string;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    actionIconClassName?: string;
    compact?: boolean;
}

const ContentState: React.FC<ContentStateProps> = ({
    iconClassName,
    title,
    description,
    actionLabel,
    onAction,
    actionIconClassName = 'fas fa-plus',
    compact = false,
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${compact ? 'min-h-[220px] py-12' : 'min-h-[350px] opacity-0 animate-fade-in'}`}>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 shadow-sm dark:bg-slate-800">
                <i className={`${iconClassName} text-4xl text-slate-400 dark:text-slate-500`}></i>
            </div>
            <h3 className={`${compact ? 'text-lg font-medium' : 'text-xl font-bold'} mb-2 text-slate-800 dark:text-slate-100`}>{title}</h3>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {description}
            </p>
            {actionLabel && onAction && (
                <ActionButton
                    variant="primary"
                    size="lg"
                    iconClassName={actionIconClassName}
                    className="mt-8"
                    onClick={onAction}
                >
                    {actionLabel}
                </ActionButton>
            )}
        </div>
    );
};

export default ContentState;
