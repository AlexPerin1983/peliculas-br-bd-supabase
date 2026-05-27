import React from 'react';
import ActionButton from './ActionButton';

interface ContentStateProps {
    iconClassName?: string;
    icon?: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    actionIconClassName?: string;
    compact?: boolean;
}

const ContentState: React.FC<ContentStateProps> = ({
    iconClassName,
    icon,
    title,
    description,
    actionLabel,
    onAction,
    actionIconClassName = 'fas fa-plus',
    compact = false,
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${compact ? 'min-h-[220px] py-12' : 'min-h-[350px] animate-fade-in opacity-0'}`}>
            <div className="ui-icon-frame mb-6 h-16 w-16">
                {icon ? (
                    <span className="inline-flex h-8 w-8 items-center justify-center text-[var(--text-muted)]" aria-hidden="true">{icon}</span>
                ) : (
                    <i className={`${iconClassName || 'fas fa-circle-info'} text-2xl text-[var(--text-muted)]`} aria-hidden="true"></i>
                )}
            </div>
            <h3 className={`${compact ? 'text-lg font-semibold' : 'text-xl font-semibold'} mb-2 tracking-[-0.03em] text-[var(--text-strong)]`}>{title}</h3>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-[var(--text-muted)]">
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
