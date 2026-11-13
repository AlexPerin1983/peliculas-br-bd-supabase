import React from 'react';
import ActionButton from '../ui/ActionButton';
import { AI_DAILY_LIMIT, AI_DAILY_LIMIT_MAX, parseAiDailyLimitInput } from './aiUsage';

interface AdminAiLimitControlProps {
    /** null = sem limite próprio (vale o padrão). */
    customLimit: number | null;
    saving: boolean;
    message: { type: 'error' | 'success'; text: string } | null;
    onSave: (dailyLimit: number | null) => void;
}

// Limite diário de IA de uma empresa: mostra o que vale hoje e deixa trocar ou voltar ao padrão.
export const AdminAiLimitControl: React.FC<AdminAiLimitControlProps> = ({ customLimit, saving, message, onSave }) => {
    const [text, setText] = React.useState(customLimit === null ? '' : String(customLimit));

    // Depois de salvar (ou ao trocar de empresa), o campo acompanha o valor guardado.
    React.useEffect(() => {
        setText(customLimit === null ? '' : String(customLimit));
    }, [customLimit]);

    const parsed = parseAiDailyLimitInput(text);
    const changed = parsed !== null && parsed !== customLimit;
    const invalid = text.trim() !== '' && parsed === null;

    return (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Limite por dia</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customLimit === null
                    ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    : customLimit === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'}`}>
                    {customLimit === null ? `Padrão · ${AI_DAILY_LIMIT}` : customLimit === 0 ? 'IA cortada' : `Próprio · ${customLimit}`}
                </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Quantos usos de IA esta empresa pode fazer em 24 horas. Use 0 para cortar a IA.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                <label>
                    <span className="mb-1 block text-[11px] text-slate-500">Usos por dia</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        enterKeyHint="done"
                        value={text}
                        onChange={(event) => setText(event.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                        placeholder={String(AI_DAILY_LIMIT)}
                        aria-label="Limite de usos de IA por dia"
                        aria-invalid={invalid}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                </label>
                <ActionButton variant="primary" size="sm" disabled={!changed} loading={saving} loadingText="Salvando..." onClick={() => parsed !== null && onSave(parsed)}>
                    Salvar limite
                </ActionButton>
                {customLimit !== null && (
                    <ActionButton variant="secondary" size="sm" disabled={saving} onClick={() => onSave(null)}>
                        Voltar ao padrão
                    </ActionButton>
                )}
            </div>
            {invalid && <p className="mt-2 text-[11px] text-red-500">Use um número de 0 a {AI_DAILY_LIMIT_MAX}.</p>}
            {message && (
                <p role="status" className={`mt-2 text-[11px] font-medium ${message.type === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {message.text}
                </p>
            )}
        </div>
    );
};

export default AdminAiLimitControl;
