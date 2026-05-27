import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

interface ToastProps {
    message: string;
    onUndo?: () => void;
    onAction?: () => void;
    actionLabel?: string;
    onDismiss: () => void;
    duration?: number;
    tone?: 'info' | 'success' | 'warning' | 'error';
    iconClassName?: string;
}

const toneStyles = {
    info: {
        iconWrap: 'bg-blue-500/15 text-blue-400',
        progress: 'bg-blue-500',
        Icon: Info
    },
    success: {
        iconWrap: 'bg-emerald-500/15 text-emerald-400',
        progress: 'bg-emerald-500',
        Icon: CheckCircle2
    },
    warning: {
        iconWrap: 'bg-amber-500/15 text-amber-400',
        progress: 'bg-amber-500',
        Icon: AlertTriangle
    },
    error: {
        iconWrap: 'bg-red-500/15 text-red-400',
        progress: 'bg-red-500',
        Icon: XCircle
    }
} as const;

const Toast: React.FC<ToastProps> = ({
    message,
    onUndo,
    onAction,
    actionLabel,
    onDismiss,
    duration = 5000,
    tone = 'error',
    iconClassName
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(100);
    const activeAction = onAction || onUndo;
    const activeActionLabel = actionLabel || (onUndo ? 'Desfazer' : null);
    const styles = toneStyles[tone];
    const ToneIcon = styles.Icon;

    useEffect(() => {
        const showTimer = setTimeout(() => setIsVisible(true), 10);

        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
        }, 50);

        const dismissTimer = setTimeout(() => {
            handleDismiss();
        }, duration);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(dismissTimer);
            clearInterval(progressInterval);
        };
    }, [duration]);

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
    };

    const handleAction = () => {
        if (!activeAction) return;
        activeAction();
        handleDismiss();
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-safe transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
            <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-panel)] border border-white/10 bg-slate-950/96 shadow-[var(--shadow-elevated)] backdrop-blur-xl dark:bg-slate-900/96">
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700/30">
                    <div
                        className={`h-full transition-all duration-50 ease-linear ${styles.progress}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex items-center justify-between px-5 py-4 pt-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] ${styles.iconWrap}`}>
                            {iconClassName ? (
                                <i className={iconClassName}></i>
                            ) : (
                                <ToneIcon className="h-4 w-4" aria-hidden="true" />
                            )}
                        </div>
                        <span className="truncate text-sm font-medium text-white">{message}</span>
                    </div>

                    <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                        {activeAction && activeActionLabel && (
                            <button
                                onClick={handleAction}
                                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-300 transition-colors hover:text-blue-200"
                            >
                                {activeActionLabel}
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                            aria-label="Fechar"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Toast;
