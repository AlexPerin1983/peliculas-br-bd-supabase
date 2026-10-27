import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { AutomotiveCategoryPrice, AutomotiveSettings, VehicleCategory } from '../../types';
import VehicleCategoryIcon from '../automotive/VehicleCategoryIcon';
import {
    AUTOMOTIVE_FILM_TYPES,
    VEHICLE_CATEGORIES,
    cloneDefaultAutomotivePrices,
    formatMoneyInput,
    getAutomotivePriceTable,
    getDefaultRemovalPrice,
    parseMoneyInput,
} from '../../src/lib/automotive';

interface AutomotiveSettingsPanelProps {
    value?: AutomotiveSettings;
    onChange: (next: AutomotiveSettings) => void;
}

type PriceField = keyof AutomotiveCategoryPrice;

const PRICE_FIELDS: { field: PriceField; label: string }[] = [
    { field: 'semParabrisa', label: 'Sem para-brisa' },
    { field: 'comParabrisa', label: 'Com para-brisa' },
];

const cellKey = (film: string, category: VehicleCategory, field: PriceField) => `${film}|${category}|${field}`;

// Chave da aba Automotivo e tabela de preço sugerido por linha de película e categoria.
const AutomotiveSettingsPanel: React.FC<AutomotiveSettingsPanelProps> = ({ value, onChange }) => {
    const isActive = Boolean(value?.ativo);
    const [selectedFilm, setSelectedFilm] = useState(AUTOMOTIVE_FILM_TYPES[0]);
    // Texto digitado de cada célula, para aceitar "450," enquanto o usuário digita.
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [removalText, setRemovalText] = useState<string | undefined>(undefined);

    const settings: AutomotiveSettings = value ?? { ativo: false };
    const prices = getAutomotivePriceTable(settings);

    // Ao ligar pela primeira vez, a tabela sugerida já fica salva como ponto de partida.
    const handleToggle = () => {
        onChange({
            ...settings,
            ativo: !isActive,
            precos: settings.precos ?? cloneDefaultAutomotivePrices(),
        });
    };

    const handlePriceChange = (category: VehicleCategory, field: PriceField, text: string) => {
        setDrafts(previous => ({ ...previous, [cellKey(selectedFilm, category, field)]: text }));
        const filmPrices = prices[selectedFilm] || {};
        const categoryPrice = { ...filmPrices[category], [field]: parseMoneyInput(text) };
        onChange({
            ...settings,
            precos: { ...prices, [selectedFilm]: { ...filmPrices, [category]: categoryPrice } },
        });
    };

    const handleRestoreSuggested = () => {
        const suggested = cloneDefaultAutomotivePrices();
        setDrafts(previous => Object.fromEntries(
            Object.entries(previous).filter(([key]) => !key.startsWith(`${selectedFilm}|`))
        ));
        onChange({ ...settings, precos: { ...prices, [selectedFilm]: suggested[selectedFilm] } });
    };

    const getCellText = (category: VehicleCategory, field: PriceField) => {
        const key = cellKey(selectedFilm, category, field);
        return key in drafts ? drafts[key] : formatMoneyInput(prices[selectedFilm]?.[category]?.[field]);
    };

    return (
        <div className="space-y-4">
            <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={handleToggle}
                className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border p-3 text-left transition-colors ${isActive
                    ? 'border-[var(--brand-primary)] bg-[rgba(21,94,239,0.06)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]'
                    }`}
            >
                <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text-strong)]">Fazer orçamentos de carros</span>
                    <span className="block text-xs text-[var(--text-muted)]">Mostra a aba Automotivo no orçamento, ao lado de Residencial / Comercial.</span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isActive ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
            </button>

            {isActive && (
                <div className="space-y-3">
                    <div>
                        <p className="text-sm font-semibold text-[var(--text-strong)]">Tabela de preços por veículo</p>
                        <p className="text-xs text-[var(--text-muted)]">Valores iniciais editáveis por categoria. Ajuste à sua realidade; no orçamento também dá para mudar.</p>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Película">
                        {AUTOMOTIVE_FILM_TYPES.map(film => (
                            <button
                                key={film}
                                type="button"
                                aria-pressed={film === selectedFilm}
                                onClick={() => setSelectedFilm(film)}
                                className={`min-h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors ${film === selectedFilm
                                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'}`}
                            >
                                {film}
                            </button>
                        ))}
                    </div>
                    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)]">
                        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 bg-[var(--surface-muted)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                            <span>Categoria</span>
                            {PRICE_FIELDS.map(item => <span key={item.field}>{item.label}</span>)}
                        </div>
                        {VEHICLE_CATEGORIES.map(category => (
                            <div key={category.id} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <VehicleCategoryIcon category={category.id} className="hidden h-5 w-10 shrink-0 sm:block" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-[var(--text-strong)]">{category.label}</span>
                                        <span className="block truncate text-[11px] text-[var(--text-muted)]">{category.examples}</span>
                                    </span>
                                </div>
                                {PRICE_FIELDS.map(item => (
                                    <label key={item.field} className="flex h-10 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2 text-xs text-[var(--text-muted)]">
                                        <span>R$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={getCellText(category.id, item.field)}
                                            onChange={event => handlePriceChange(category.id, item.field, event.target.value)}
                                            placeholder="0,00"
                                            aria-label={`${category.label}, ${item.label.toLowerCase()}`}
                                            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--text-strong)] outline-none"
                                        />
                                    </label>
                                ))}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleRestoreSuggested}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Voltar aos preços sugeridos de {selectedFilm}
                    </button>
                    <label className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[var(--text-strong)]">Remover película antiga</span>
                            <span className="block text-xs text-[var(--text-muted)]">Valor sugerido quando marcar no carro (dá para mudar em cada um).</span>
                        </span>
                        <span className="flex h-10 w-28 shrink-0 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-2 text-xs text-[var(--text-muted)]">
                            <span>R$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={removalText ?? formatMoneyInput(getDefaultRemovalPrice(settings))}
                                onChange={event => {
                                    setRemovalText(event.target.value);
                                    onChange({ ...settings, valorRemocao: parseMoneyInput(event.target.value) ?? 0 });
                                }}
                                aria-label="Valor sugerido para remover película antiga"
                                className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold text-[var(--text-strong)] outline-none"
                            />
                        </span>
                    </label>
                </div>
            )}
        </div>
    );
};

export default AutomotiveSettingsPanel;
