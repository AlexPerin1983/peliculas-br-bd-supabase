import React, { useEffect, useState } from 'react';
import type { AutomotiveCategoryPrice, AutomotiveSettings, Film, VehicleCategory } from '../../types';
import VehicleCategoryIcon from '../automotive/VehicleCategoryIcon';
import { VEHICLE_CATEGORIES, formatMoneyInput, parseMoneyInput, pickDefaultAutomotiveFilm } from '../../src/lib/automotive';

interface AutomotiveSettingsPanelProps {
    value?: AutomotiveSettings;
    films: Film[];
    onChange: (next: AutomotiveSettings) => void;
}

type PriceField = keyof AutomotiveCategoryPrice;

const PRICE_FIELDS: { field: PriceField; label: string }[] = [
    { field: 'semParabrisa', label: 'Sem para-brisa' },
    { field: 'comParabrisa', label: 'Com para-brisa' },
];

const cellKey = (film: string, category: VehicleCategory, field: PriceField) => `${film}|${category}|${field}`;

// Chave da aba Automotivo e tabela de preço sugerido por película e categoria.
const AutomotiveSettingsPanel: React.FC<AutomotiveSettingsPanelProps> = ({ value, films, onChange }) => {
    const isActive = Boolean(value?.ativo);
    const [selectedFilm, setSelectedFilm] = useState(() => pickDefaultAutomotiveFilm(films));
    // Texto digitado de cada célula, para aceitar "450," enquanto o usuário digita.
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!films.some(film => film.nome === selectedFilm)) {
            setSelectedFilm(pickDefaultAutomotiveFilm(films));
        }
    }, [films, selectedFilm]);

    const settings: AutomotiveSettings = value ?? { ativo: false };

    const handlePriceChange = (category: VehicleCategory, field: PriceField, text: string) => {
        setDrafts(previous => ({ ...previous, [cellKey(selectedFilm, category, field)]: text }));
        const filmPrices = settings.precos?.[selectedFilm] || {};
        const categoryPrice = { ...filmPrices[category], [field]: parseMoneyInput(text) };
        onChange({
            ...settings,
            precos: {
                ...settings.precos,
                [selectedFilm]: { ...filmPrices, [category]: categoryPrice },
            },
        });
    };

    const getCellText = (category: VehicleCategory, field: PriceField) => {
        const key = cellKey(selectedFilm, category, field);
        return key in drafts ? drafts[key] : formatMoneyInput(settings.precos?.[selectedFilm]?.[category]?.[field]);
    };

    return (
        <div className="space-y-4">
            <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => onChange({ ...settings, ativo: !isActive })}
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
                films.length === 0 ? (
                    <p className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-muted)]">
                        Cadastre suas películas para montar a tabela de preços.
                    </p>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--text-strong)]">Tabela de preços (carro completo)</p>
                            <p className="text-xs text-[var(--text-muted)]">Valor sugerido. No orçamento dá para mudar na hora. Campo vazio = você digita no orçamento.</p>
                        </div>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Película">
                            {films.map(film => (
                                <button
                                    key={film.nome}
                                    type="button"
                                    aria-pressed={film.nome === selectedFilm}
                                    onClick={() => setSelectedFilm(film.nome)}
                                    className={`min-h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors ${film.nome === selectedFilm
                                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'}`}
                                >
                                    {film.nome}
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
                    </div>
                )
            )}
        </div>
    );
};

export default AutomotiveSettingsPanel;
