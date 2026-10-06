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
    // Segunda opção, ao lado da principal (ex.: "Agendar por voz").
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    secondaryActionIconClassName?: string;
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
    secondaryActionLabel,
    onSecondaryAction,
    secondaryActionIconClassName,
    compact = false,
}) => {
    const hasAction = Boolean(actionLabel && onAction);
    const hasSecondaryAction = Boolean(secondaryActionLabel && onSecondaryAction);
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
            {hasAction || hasSecondaryAction ? (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    {hasAction ? (
                        <ActionButton
                            variant="primary"
                            size="lg"
                            iconClassName={actionIconClassName}
                            onClick={onAction}
                        >
                            {actionLabel}
                        </ActionButton>
                    ) : null}
                    {hasSecondaryAction ? (
                        <ActionButton
                            variant="secondary"
                            size="lg"
                            iconClassName={secondaryActionIconClassName}
                            onClick={onSecondaryAction}
                        >
                            {secondaryActionLabel}
                        </ActionButton>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default ContentState;
