import React from 'react';
import { Drawer } from 'vaul';
import { Camera, Layers3, Scissors, Sparkles } from 'lucide-react';

type EstoqueMobileAddSheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAddBobina: () => void;
    onAddRetalho: () => void;
    onAddWithAI: () => void;
    onScan: () => void;
};

const actions = [
    { key: 'bobina', title: 'Nova bobina', detail: 'Cadastrar dados e metragem', icon: Layers3, tone: 'bg-blue-500/10 text-blue-500' },
    { key: 'retalho', title: 'Novo retalho', detail: 'Registrar uma sobra disponível', icon: Scissors, tone: 'bg-amber-500/10 text-amber-500' },
    { key: 'ai', title: 'Cadastrar com IA', detail: 'Descrever ou falar os dados', icon: Sparkles, tone: 'bg-violet-500/10 text-violet-500' },
    { key: 'scan', title: 'Escanear QR', detail: 'Localizar ou atualizar um material', icon: Camera, tone: 'bg-emerald-500/10 text-emerald-500' },
] as const;

const EstoqueMobileAddSheet: React.FC<EstoqueMobileAddSheetProps> = ({
    open,
    onOpenChange,
    onAddBobina,
    onAddRetalho,
    onAddWithAI,
    onScan,
}) => {
    const handlers = { bobina: onAddBobina, retalho: onAddRetalho, ai: onAddWithAI, scan: onScan };
    const run = (key: keyof typeof handlers) => {
        onOpenChange(false);
        handlers[key]();
    };

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-[2px]" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[24px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none sm:hidden">
                    <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
                    <div className="px-4 pb-4 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                        <Drawer.Title className="text-[1.05rem] font-semibold text-[var(--text-strong)]">Cadastrar material</Drawer.Title>
                        <Drawer.Description className="mt-1 text-[12px] text-[var(--text-muted)]">Escolha como deseja começar.</Drawer.Description>
                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                            {actions.map(({ key, title, detail, icon: Icon, tone }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => run(key)}
                                    className="min-h-[116px] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3.5 text-left transition-colors active:bg-[var(--surface)]"
                                >
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                                    <span className="mt-3 block text-[13px] font-semibold text-[var(--text-strong)]">{title}</span>
                                    <span className="mt-1 block text-[10px] leading-4 text-[var(--text-muted)]">{detail}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default EstoqueMobileAddSheet;
