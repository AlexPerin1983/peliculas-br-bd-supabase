import React, { useEffect, useState } from 'react';
import { Check, Loader2, PackagePlus } from 'lucide-react';
import { saveRetalho } from '../../services/estoqueDb';
import type { Remnant } from '../../utils/straightCuts';

export interface NumberedRemnant extends Remnant {
    number: number;
    band?: number;
}

interface CuttingRemnantsProps {
    remnants: NumberedRemnant[];
    filmName: string;
    minSideCm: number;
    canUseStock: boolean;
    // Chave (cliente/opção/película) para lembrar que estas sobras já foram guardadas.
    storageKey: string | null;
    compact?: boolean;
}

const meters = (value: number) => (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signatureOf = (remnants: Remnant[]) => remnants.map(r => `${r.x}:${r.y}:${r.w}x${r.h}`).join('|');

const readSaved = (key: string | null) => {
    if (!key) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

/** Sobras aproveitáveis do plano, com opção de guardar como retalhos no estoque. */
export default function CuttingRemnants({ remnants, filmName, minSideCm, canUseStock, storageKey, compact = false }: CuttingRemnantsProps) {
    const signature = signatureOf(remnants);
    const [savedSignature, setSavedSignature] = useState<string | null>(() => readSaved(storageKey));
    const [step, setStep] = useState<'idle' | 'confirm' | 'saving'>('idle');
    const [error, setError] = useState<string | null>(null);
    // Quantos já foram gravados nesta tentativa: ao tentar de novo, continua daqui sem duplicar.
    const [savedCount, setSavedCount] = useState(0);

    useEffect(() => {
        setSavedSignature(readSaved(storageKey));
        setStep('idle');
        setError(null);
        setSavedCount(0);
    }, [storageKey, signature]);

    if (remnants.length === 0) return null;

    const alreadySaved = savedSignature === signature;
    const totalArea = remnants.reduce((sum, r) => sum + r.w * r.h, 0) / 10000;

    const save = async () => {
        setStep('saving');
        setError(null);
        let done = savedCount;
        try {
            // Um por vez: se algum falhar, os anteriores já ficaram salvos e o erro aparece.
            for (const remnant of remnants.slice(savedCount)) {
                await saveRetalho({
                    filmId: filmName,
                    codigoQr: '',
                    larguraCm: remnant.w,
                    comprimentoCm: remnant.h,
                    status: 'disponivel',
                    observacao: `Sobra do plano de corte (R${remnant.number}${remnant.band ? `, faixa ${remnant.band}` : ''})`,
                });
                done += 1;
                setSavedCount(done);
            }
            if (storageKey) {
                try {
                    localStorage.setItem(storageKey, signature);
                } catch {
                    // Sem armazenamento, só perde o aviso de "já guardado".
                }
            }
            setSavedSignature(signature);
            setStep('idle');
        } catch (saveError) {
            console.error('Erro ao guardar retalhos do plano de corte:', saveError);
            setError(done > 0
                ? `${done} de ${remnants.length} guardados. Verifique a conexão e toque de novo para guardar o resto.`
                : 'Não foi possível guardar no estoque. Verifique a conexão e tente de novo.');
            setStep('idle');
        }
    };

    return (
        <section className={`cutting-remnants ${compact ? '' : 'mt-6 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900'}`} aria-label="Sobras aproveitáveis">
            <header className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sobras aproveitáveis</h4>
                <span className="ml-auto text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {remnants.length} · {totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²
                </span>
            </header>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Retângulos a partir de {minSideCm} × {minSideCm} cm que saem inteiros seguindo as linhas de corte.</p>

            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {remnants.map(remnant => (
                    <li key={remnant.number} className="flex items-center gap-3 py-2">
                        <span className="grid h-8 min-w-[40px] place-items-center rounded-lg bg-emerald-50 text-xs font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">R{remnant.number}</span>
                        <span className="min-w-0 flex-1">
                            <strong className="block text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{meters(remnant.w)} × {meters(remnant.h)} m</strong>
                            {remnant.band && <small className="block text-[11px] text-slate-500 dark:text-slate-400">na faixa {remnant.band}</small>}
                        </span>
                    </li>
                ))}
            </ul>

            {!canUseStock ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Ative o módulo Estoque para guardar estas sobras como retalhos.</p>
            ) : alreadySaved ? (
                <p className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-4 w-4" aria-hidden="true" /> Guardadas no estoque como retalhos.
                </p>
            ) : step === 'confirm' ? (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30" role="group" aria-label="Confirmar retalhos">
                    <p className="text-xs text-emerald-900 dark:text-emerald-100">
                        Cadastrar <strong>{remnants.length} {remnants.length === 1 ? 'retalho' : 'retalhos'}</strong> de <strong>{filmName}</strong> no estoque, cada um com QR Code? Faça isso depois de cortar e separar as sobras.
                    </p>
                    <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => setStep('idle')} className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Cancelar</button>
                        <button type="button" onClick={save} className="min-h-[40px] flex-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500">Confirmar</button>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={() => setStep('confirm')} disabled={step === 'saving'}
                    className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                    {step === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PackagePlus className="h-4 w-4" aria-hidden="true" />}
                    {step === 'saving' ? 'Guardando…' : `Guardar no estoque (${remnants.length - savedCount})`}
                </button>
            )}
            {error && <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">{error}</p>}
        </section>
    );
}
