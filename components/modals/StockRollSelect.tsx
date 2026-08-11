import React, { useEffect, useId, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Check, ChevronDown, PackageOpen, Ruler, X } from 'lucide-react';
import { Bobina } from '../../types';
import { useIsMobile } from '../../src/hooks/useIsMobile';

interface StockRollSelectProps {
    label: string;
    ariaLabel: string;
    options: Bobina[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}

const formatMeters = (value: number): string => (
    Number.isFinite(value)
        ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00'
);

const getOptionLabel = (bobina: Bobina): string => (
    `#${bobina.id} · ${bobina.larguraCm} cm · saldo ${formatMeters(bobina.comprimentoRestanteM)} m`
);

const StockRollSelect: React.FC<StockRollSelectProps> = ({
    label,
    ariaLabel,
    options,
    value,
    onChange,
    placeholder,
    disabled = false,
}) => {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();
    const selectedBobina = options.find((bobina) => String(bobina.id) === value);
    const isDisabled = disabled || options.length === 0;

    useEffect(() => {
        if (isMobile || !isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isMobile, isOpen]);

    useEffect(() => {
        if (isDisabled) setIsOpen(false);
    }, [isDisabled]);

    const selectBobina = (bobina: Bobina) => {
        if (!bobina.id) return;
        onChange(String(bobina.id));
        setIsOpen(false);
    };

    const renderOptions = (mobile: boolean) => options.map((bobina) => {
        const selected = String(bobina.id) === value;
        const accessibleLabel = `Bobina ${bobina.id}, ${bobina.larguraCm} centímetros, saldo ${formatMeters(bobina.comprimentoRestanteM)} metros`;

        return (
            <button
                key={bobina.id}
                type="button"
                role="option"
                aria-label={accessibleLabel}
                aria-selected={selected}
                onClick={() => selectBobina(bobina)}
                className={`flex w-full items-center gap-3 text-left transition-colors ${mobile
                    ? `min-h-[72px] rounded-[var(--radius-card)] border px-4 py-3 ${selected
                        ? 'border-blue-500/60 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] active:bg-[var(--surface-muted)]'}`
                    : `px-3 py-2.5 hover:bg-[var(--surface-muted)] ${selected ? 'bg-blue-500/10' : ''}`
                }`}
            >
                <span className={`flex shrink-0 items-center justify-center font-black ${mobile
                    ? 'h-11 min-w-11 rounded-xl bg-blue-500/12 px-2 text-sm text-blue-400'
                    : 'h-9 min-w-9 rounded-lg bg-blue-500/10 px-2 text-xs text-blue-500'
                }`}>
                    #{bobina.id}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`block font-bold text-[var(--text-strong)] ${mobile ? 'text-[15px]' : 'text-sm'}`}>
                        {bobina.larguraCm} cm de largura
                    </span>
                    <span className={`mt-0.5 block text-[var(--text-muted)] ${mobile ? 'text-xs' : 'text-[11px]'}`}>
                        Saldo disponível: {formatMeters(bobina.comprimentoRestanteM)} m
                    </span>
                </span>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${selected
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-[var(--border-strong)] text-transparent'
                }`}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                </span>
            </button>
        );
    });

    return (
        <div ref={containerRef} className="relative">
            <span className="mb-1 block text-xs font-bold text-[var(--text-strong)]">{label}</span>
            <button
                type="button"
                role="combobox"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                disabled={isDisabled}
                onClick={() => setIsOpen((current) => !current)}
                className="flex h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-left text-sm text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition-colors hover:border-[var(--border-strong)] focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <span className={`min-w-0 flex-1 truncate ${selectedBobina ? 'font-semibold' : 'text-[var(--text-muted)]'}`}>
                    {selectedBobina ? getOptionLabel(selectedBobina) : placeholder}
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {!isMobile && isOpen ? (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label={ariaLabel}
                    className="absolute z-[10020] mt-1.5 max-h-64 w-full overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-elevated)]"
                >
                    {renderOptions(false)}
                </div>
            ) : null}

            {isMobile ? (
                <Drawer.NestedRoot open={isOpen} onOpenChange={setIsOpen}>
                    <Drawer.Portal>
                        <Drawer.Overlay
                            data-modal-companion
                            className="fixed inset-0 z-[10040] bg-slate-950/72 backdrop-blur-sm"
                        />
                        <Drawer.Content
                            data-modal-companion
                            className="fixed inset-x-0 bottom-0 z-[10041] flex max-h-[78dvh] flex-col rounded-t-[26px] border-t border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] shadow-[var(--shadow-elevated)] outline-none"
                        >
                            <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[var(--border-strong)]" />
                            <header className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-5 pb-4 pt-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-400">
                                    <PackageOpen className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <Drawer.Title className="text-lg font-black leading-tight text-[var(--text-strong)]">
                                        Selecionar bobina
                                    </Drawer.Title>
                                    <Drawer.Description className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                        <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                                        {options.length} {options.length === 1 ? 'opção compatível' : 'opções compatíveis'}
                                    </Drawer.Description>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    aria-label="Fechar seleção de bobina"
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]"
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </header>
                            <div
                                id={listboxId}
                                role="listbox"
                                aria-label={ariaLabel}
                                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 pt-4"
                                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                            >
                                {renderOptions(true)}
                            </div>
                        </Drawer.Content>
                    </Drawer.Portal>
                </Drawer.NestedRoot>
            ) : null}
        </div>
    );
};

export default StockRollSelect;
