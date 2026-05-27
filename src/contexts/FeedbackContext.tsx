import React, { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import InfoModal from '../../components/modals/InfoModal';
import Toast from '../../components/ui/Toast';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

interface ToastConfig {
    id: number;
    message: string;
    tone: FeedbackTone;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
}

interface AlertConfig {
    isOpen: boolean;
    title: ReactNode;
    message: ReactNode;
    tone: FeedbackTone;
    buttonText?: string;
}

interface ConfirmConfig {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    confirmButtonText?: string;
    cancelButtonText?: string;
    confirmButtonVariant?: 'danger' | 'primary';
    presentation?: 'modal' | 'drawer' | 'auto';
    resolve?: (value: boolean) => void;
}

interface ConfirmOptions {
    title: string;
    message: ReactNode;
    confirmButtonText?: string;
    cancelButtonText?: string;
    confirmButtonVariant?: 'danger' | 'primary';
    presentation?: 'modal' | 'drawer' | 'auto';
}

interface AlertOptions {
    title?: ReactNode;
    message: ReactNode;
    tone?: FeedbackTone;
    buttonText?: string;
}

interface ToastOptions {
    tone?: FeedbackTone;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
}

interface FeedbackContextType {
    showAlert: (options: AlertOptions) => void;
    showToast: (message: string, options?: ToastOptions) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const idRef = useRef(0);
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const [alertConfig, setAlertConfig] = useState<AlertConfig>({
        isOpen: false,
        title: 'Atencao',
        message: '',
        tone: 'info'
    });
    const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
        isOpen: false,
        title: '',
        message: ''
    });

    const showToast = useCallback((message: string, options?: ToastOptions) => {
        idRef.current += 1;
        setToast({
            id: idRef.current,
            message,
            tone: options?.tone || 'info',
            duration: options?.duration,
            actionLabel: options?.actionLabel,
            onAction: options?.onAction
        });
    }, []);

    const showAlert = useCallback((options: AlertOptions) => {
        setAlertConfig({
            isOpen: true,
            title: options.title || 'Atencao',
            message: options.message,
            tone: options.tone || 'info',
            buttonText: options.buttonText
        });
    }, []);

    const closeAlert = useCallback(() => {
        setAlertConfig(previous => ({ ...previous, isOpen: false }));
    }, []);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setConfirmConfig({
                isOpen: true,
                title: options.title,
                message: options.message,
                confirmButtonText: options.confirmButtonText,
                cancelButtonText: options.cancelButtonText,
                confirmButtonVariant: options.confirmButtonVariant,
                presentation: options.presentation,
                resolve
            });
        });
    }, []);

    const handleConfirmClose = useCallback(() => {
        setConfirmConfig(current => {
            current.resolve?.(false);
            return {
                isOpen: false,
                title: '',
                message: '',
                confirmButtonText: undefined,
                cancelButtonText: undefined,
                confirmButtonVariant: undefined,
                presentation: undefined
            };
        });
    }, []);

    const handleConfirmAccept = useCallback(() => {
        setConfirmConfig(current => {
            current.resolve?.(true);
            return {
                isOpen: false,
                title: '',
                message: '',
                confirmButtonText: undefined,
                cancelButtonText: undefined,
                confirmButtonVariant: undefined,
                presentation: undefined
            };
        });
    }, []);

    const value = useMemo<FeedbackContextType>(() => ({
        showAlert,
        showToast,
        confirm
    }), [confirm, showAlert, showToast]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}

            <InfoModal
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                title={alertConfig.title}
                message={alertConfig.message}
                tone={alertConfig.tone}
                buttonText={alertConfig.buttonText}
            />

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={handleConfirmClose}
                onConfirm={handleConfirmAccept}
                title={confirmConfig.title}
                message={confirmConfig.message}
                confirmButtonText={confirmConfig.confirmButtonText}
                cancelButtonText={confirmConfig.cancelButtonText}
                confirmButtonVariant={confirmConfig.confirmButtonVariant}
                presentation={confirmConfig.presentation}
            />

            {toast && (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    tone={toast.tone}
                    duration={toast.duration}
                    actionLabel={toast.actionLabel}
                    onAction={toast.onAction}
                    onDismiss={() => {
                        setToast(current => current?.id === toast.id ? null : current);
                    }}
                />
            )}
        </FeedbackContext.Provider>
    );
};

export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (context === undefined) {
        throw new Error('useFeedback must be used within a FeedbackProvider');
    }
    return context;
};
