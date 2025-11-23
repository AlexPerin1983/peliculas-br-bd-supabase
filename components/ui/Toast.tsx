import React, { useEffect, useState } from 'react';

interface ToastProps {
    message: string;
    onUndo: () => void;
    onDismiss: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, onUndo, onDismiss, duration = 5000 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        // Trigger entrance animation
        const showTimer = setTimeout(() => setIsVisible(true), 10);

        // Progress bar animation
        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
        }, 50);

        // Auto-dismiss
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
        setTimeout(onDismiss, 300); // Wait for exit animation
    };

    const handleUndo = () => {
        onUndo();
        handleDismiss();
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-safe transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                }`}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl backdrop-blur-xl bg-slate-900/95 dark:bg-slate-800/95 shadow-2xl border border-slate-700/50">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700/30">
                    <div
                        className="h-full bg-blue-500 transition-all duration-50 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Content */}
                <div className="flex items-center justify-between px-5 py-4 pt-5">
                    {/* Icon + Message */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                            <i className="fas fa-trash-alt text-red-400"></i>
                        </div>
                        <span className="text-white font-medium text-sm truncate">{message}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <button
                            onClick={handleUndo}
                            className="px-4 py-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wide"
                        >
                            Desfazer
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="w-8 h-8 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-slate-300 transition-colors"
                            aria-label="Fechar"
                        >
                            <i className="fas fa-times text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Toast;
