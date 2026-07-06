import React, { useState } from 'react';
import { Bolt, CalendarPlus, Layers, Scissors, Sparkles, UserPlus, X } from 'lucide-react';

interface AIQuickFabProps {
    onCreateProposal: () => void;
    onCreateClient: () => void;
    onCreateBobina: () => void;
    onCreateRetalho: () => void;
    onCreateAgenda: () => void;
}

interface QuickAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    accentClass: string;
}

const AIQuickFab: React.FC<AIQuickFabProps> = ({
    onCreateProposal,
    onCreateClient,
    onCreateBobina,
    onCreateRetalho,
    onCreateAgenda
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const runAction = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    const actions: QuickAction[] = [
        {
            label: 'Proposta com IA',
            icon: <Bolt className="h-5 w-5" aria-hidden="true" />,
            onClick: () => runAction(onCreateProposal),
            accentClass: 'bg-gradient-to-br from-blue-600 to-blue-700'
        },
        {
            label: 'Cliente com IA',
            icon: <UserPlus className="h-5 w-5" aria-hidden="true" />,
            onClick: () => runAction(onCreateClient),
            accentClass: 'bg-gradient-to-br from-emerald-600 to-emerald-700'
        },
        {
            label: 'Bobina com IA',
            icon: <Layers className="h-5 w-5" aria-hidden="true" />,
            onClick: () => runAction(onCreateBobina),
            accentClass: 'bg-gradient-to-br from-slate-700 to-slate-900'
        },
        {
            label: 'Retalho com IA',
            icon: <Scissors className="h-5 w-5" aria-hidden="true" />,
            onClick: () => runAction(onCreateRetalho),
            accentClass: 'bg-gradient-to-br from-amber-500 to-orange-600'
        },
        {
            label: 'Agendamento',
            icon: <CalendarPlus className="h-5 w-5" aria-hidden="true" />,
            onClick: () => runAction(onCreateAgenda),
            accentClass: 'bg-gradient-to-br from-rose-500 to-rose-600'
        }
    ];

    return (
        <div className="sm:hidden">
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div
                className="fixed right-3 z-40 flex flex-col items-end gap-3"
                style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
            >
                {isOpen && actions.map((action, index) => (
                    <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className="ai-fab-item flex items-center gap-2.5"
                        style={{ animationDelay: `${(actions.length - 1 - index) * 45}ms` }}
                    >
                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-[0_4px_14px_rgba(0,0,0,0.18)] backdrop-blur dark:bg-slate-800/95 dark:text-slate-100">
                            {action.label}
                        </span>
                        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_rgba(15,23,42,0.3)] ${action.accentClass}`}>
                            {action.icon}
                        </span>
                    </button>
                ))}

                <button
                    type="button"
                    onClick={() => setIsOpen(open => !open)}
                    aria-label={isOpen ? 'Fechar ações rápidas de IA' : 'Abrir ações rápidas de IA'}
                    aria-expanded={isOpen}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white text-white shadow-[0_8px_20px_rgba(109,40,217,0.4)] transition-all duration-300 active:scale-95 dark:border-slate-900 ${isOpen
                        ? 'rotate-90 bg-gradient-to-br from-slate-600 to-slate-800'
                        : 'bg-gradient-to-br from-violet-600 to-indigo-600'
                        }`}
                >
                    {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Sparkles className="h-6 w-6" aria-hidden="true" />}
                </button>
            </div>

            <style>{`
                @keyframes aiFabItemIn {
                    from { opacity: 0; transform: translateY(10px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .ai-fab-item {
                    animation: aiFabItemIn 0.22s cubic-bezier(0.4, 0, 0.2, 1) backwards;
                }
            `}</style>
        </div>
    );
};

export default AIQuickFab;
