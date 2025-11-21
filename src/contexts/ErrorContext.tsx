import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import ErrorModal from '../../components/modals/ErrorModal';

interface ErrorContextType {
    showError: (message: string) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');

    const showError = useCallback((msg: string) => {
        // Prevent showing the same error multiple times or generic "Script error."
        if (msg === 'Script error.') return;

        console.error("Global Error Caught:", msg); // Still log to console for debugging
        setMessage(msg);
        setIsOpen(true);
    }, []);

    const closeError = () => {
        setIsOpen(false);
        setTimeout(() => setMessage(''), 300); // Clear message after animation
    };

    return (
        <ErrorContext.Provider value={{ showError }}>
            {children}
            <ErrorModal
                isOpen={isOpen}
                onClose={closeError}
                message={message}
            />
        </ErrorContext.Provider>
    );
};

export const useError = () => {
    const context = useContext(ErrorContext);
    if (context === undefined) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
};
