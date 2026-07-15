import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Check, Keyboard, Ruler, X } from 'lucide-react';
import { useMeasurementInputMode } from '../../src/hooks/useMeasurementInputMode';
import type { MeasurementInputMode } from '../../src/lib/measurementInputMode';

interface MeasurementInputSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const OPTIONS: Array<{
    value: MeasurementInputMode;
    title: string;
    description: string;
    typed: string;
    result: string;
    recommended?: boolean;
}> = [
    {
        value: 'centimeters',
        title: 'Centímetros sem vírgula',
        description: 'Mais rápido para quem mede com trena em centímetros.',
        typed: '152',
        result: '1,52 m',
        recommended: true,
    },
    {
        value: 'meters',
        title: 'Metros com vírgula',
        description: 'Mantém a forma tradicional usada atualmente.',
        typed: '1,52',
        result: '1,52 m',
    },
];

const MeasurementInputSettingsModal: React.FC<MeasurementInputSettingsModalProps> = ({ isOpen, onClose }) => {
    const { mode, setMode } = useMeasurementInputMode();
    const [selected, setSelected] = useState<MeasurementInputMode>(mode);

    useEffect(() => {
        if (isOpen) setSelected(mode);
    }, [isOpen, mode]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const save = () => {
        setMode(selected);
        onClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10030] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="measurement-input-settings-title">
            <button type="button" aria-label="Fechar configuracao de medidas" onClick={onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
            <section className="relative w-full max-w-lg overflow-hidden rounded-t-[26px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:mx-4 sm:rounded-[26px]">
                <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Ruler className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Como você prefere medir?</p>
                        <h2 id="measurement-input-settings-title" className="mt-1 text-lg font-black text-slate-950 dark:text-white">Configuração das medidas</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Escolha como os números de largura e altura serão interpretados.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
                </header>

                <div className="space-y-3 p-4 sm:p-5">
                    {OPTIONS.map(option => {
                        const active = selected === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelected(option.value)}
                                className={`relative w-full rounded-2xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/15 dark:bg-blue-950/25' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'}`}
                            >
                                <span className="flex items-start gap-3">
                                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                                        {active ? <Check className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <strong className="text-sm font-black text-slate-900 dark:text-white">{option.title}</strong>
                                            {option.recommended ? <i className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase not-italic text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Recomendado</i> : null}
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                                        <span className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm dark:bg-slate-800">
                                            <span className="font-bold text-slate-500">Você digita</span>
                                            <b className="rounded-lg bg-slate-100 px-2 py-1 text-slate-900 dark:bg-slate-700 dark:text-white">{option.typed}</b>
                                            <span className="text-slate-400">=</span>
                                            <b className="text-blue-600 dark:text-blue-300">{option.result}</b>
                                        </span>
                                    </span>
                                </span>
                            </button>
                        );
                    })}

                    <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-amber-800 dark:bg-amber-950/25 dark:text-amber-200">
                        Essa opção muda somente a forma de digitar. As medidas que você já salvou não serão alteradas.
                    </p>
                </div>

                <footer className="border-t border-slate-100 p-4 dark:border-slate-800">
                    <button type="button" onClick={save} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99]">
                        <Check className="h-4 w-4" /> Salvar configuração
                    </button>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default MeasurementInputSettingsModal;
