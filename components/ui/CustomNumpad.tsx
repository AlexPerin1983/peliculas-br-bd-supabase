import React, { forwardRef } from 'react';

interface CustomNumpadProps {
    onInput: (value: string) => void;
    onDelete: () => void;
    onDone: () => void;
    onClose: () => void;
    onDuplicate: () => void;
    onClear: () => void;
    onAddGroup: () => void;
    activeField: 'largura' | 'altura' | 'quantidade' | null;
}

const CustomNumpad = forwardRef<HTMLDivElement, CustomNumpadProps>(({ onInput, onDelete, onDone, onClose, onDuplicate, onClear, onAddGroup, activeField }, ref) => {
    
    const handleVibrate = () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(10); // Uma vibração leve para feedback tátil
        }
    };

    const NumpadButton: React.FC<{
        action: () => void;
        children: React.ReactNode;
        className?: string;
        ariaLabel: string;
    }> = ({ action, children, className = '', ariaLabel }) => (
        <button
            type="button"
            onClick={() => {
                handleVibrate();
                action();
            }}
            aria-label={ariaLabel}
            className={`flex items-center justify-center h-10 rounded-lg text-xl font-semibold transition-colors duration-150 ${className}`}
        >
            {children}
        </button>
    );

    const IconButton: React.FC<{
        action: () => void;
        icon: string;
        ariaLabel: string;
        isPrimary?: boolean;
    }> = ({ action, icon, ariaLabel, isPrimary = false }) => (
         <button
            type="button"
            onClick={() => {
                handleVibrate();
                action();
            }}
            aria-label={ariaLabel}
            className={`flex items-center justify-center h-10 w-10 rounded-full text-lg transition-colors duration-150 ${
                isPrimary 
                    ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
            <i className={icon}></i>
        </button>
    );

    const numberClasses = "bg-white text-slate-800 hover:bg-gray-50 border border-slate-200 shadow-sm";
    const actionClasses = "bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm";
    const isLastField = activeField === 'quantidade';

    return (
        <div ref={ref} className="fixed bottom-0 left-0 right-0 bg-white p-2 pb-3 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200 z-50 animate-slide-up">
             <div className="max-w-sm mx-auto">
                <div className="grid grid-cols-3 gap-2">
                    <NumpadButton action={() => onInput('1')} className={numberClasses} ariaLabel="Número 1">1</NumpadButton>
                    <NumpadButton action={() => onInput('2')} className={numberClasses} ariaLabel="Número 2">2</NumpadButton>
                    <NumpadButton action={() => onInput('3')} className={numberClasses} ariaLabel="Número 3">3</NumpadButton>
                    
                    <NumpadButton action={() => onInput('4')} className={numberClasses} ariaLabel="Número 4">4</NumpadButton>
                    <NumpadButton action={() => onInput('5')} className={numberClasses} ariaLabel="Número 5">5</NumpadButton>
                    <NumpadButton action={() => onInput('6')} className={numberClasses} ariaLabel="Número 6">6</NumpadButton>
                    
                    <NumpadButton action={() => onInput('7')} className={numberClasses} ariaLabel="Número 7">7</NumpadButton>
                    <NumpadButton action={() => onInput('8')} className={numberClasses} ariaLabel="Número 8">8</NumpadButton>
                    <NumpadButton action={() => onInput('9')} className={numberClasses} ariaLabel="Número 9">9</NumpadButton>
                    
                    <NumpadButton action={() => onInput(',')} className={actionClasses} ariaLabel="Vírgula">,</NumpadButton>
                    <NumpadButton action={() => onInput('0')} className={numberClasses} ariaLabel="Número 0">0</NumpadButton>
                    <NumpadButton action={onDelete} className={actionClasses} ariaLabel="Apagar">
                        <i className="fas fa-backspace text-lg"></i>
                    </NumpadButton>
                </div>
                
                {/* Barra de Ações - Ajustada para melhor distribuição */}
                <div className="mt-3 flex items-center justify-center gap-4">
                    {/* Grupo Esquerda: Duplicar, Limpar */}
                    <div className="flex items-center gap-2">
                        <IconButton action={onDuplicate} ariaLabel="Duplicar medida" icon="fas fa-copy" />
                        <IconButton action={onClear} ariaLabel="Limpar campos" icon="fas fa-eraser" />
                    </div>
                    
                    {/* Centro: Recolher Teclado */}
                    <IconButton action={onClose} ariaLabel="Recolher teclado" icon="fas fa-chevron-down" />

                    {/* Grupo Direita: Adicionar Grupo, Próximo/Pronto */}
                    <div className="flex items-center gap-2">
                        <IconButton action={onAddGroup} ariaLabel="Novo grupo" icon="fas fa-plus" />
                        <IconButton
                            action={onDone}
                            ariaLabel={isLastField ? "Confirmar entrada" : "Próximo campo"}
                            icon={isLastField ? "fas fa-check" : "fas fa-arrow-right"}
                            isPrimary
                        />
                    </div>
                </div>
            </div>
             <style jsx>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
});

export default CustomNumpad;