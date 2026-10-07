import React, { useMemo, useState } from 'react';
import { Film } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { sortFilmsForDisplay } from '../../src/lib/filmCatalog';
import { getFilmMatchingBrand } from '../../utils/filmMatchingMetadata';
import {
    applyFilmPriceAdjustment,
    FILM_PRICE_FIELD_LABELS,
    FilmPriceField,
    getFilmPriceChanges,
    isValidAdjustmentPercent,
    MAX_ADJUSTMENT_PERCENT,
    MIN_ADJUSTMENT_PERCENT,
} from '../../src/lib/filmPriceAdjustment';

interface FilmPriceAdjustmentModalProps {
    films: Film[];
    onClose: () => void;
    /** Salva as películas alteradas (também usado para desfazer). */
    onSaveFilms: (films: Film[]) => Promise<void>;
}

const QUICK_PERCENTS = [5, 10, 15, 20];
const FIELD_ORDER: FilmPriceField[] = ['venda', 'maoDeObra', 'custo'];

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FilmPriceAdjustmentModal: React.FC<FilmPriceAdjustmentModalProps> = ({ films, onClose, onSaveFilms }) => {
    const { showToast } = useFeedback();
    const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
    const [percentText, setPercentText] = useState('10');
    const [fields, setFields] = useState<FilmPriceField[]>(['venda']);
    const [roundToWholeReais, setRoundToWholeReais] = useState(false);
    const [brand, setBrand] = useState<string | null>(null);
    const [excludedNames, setExcludedNames] = useState<Set<string>>(() => new Set());
    const [isSaving, setIsSaving] = useState(false);

    const percentValue = Number(percentText.replace(',', '.'));
    const adjustment = {
        percent: direction === 'increase' ? percentValue : -percentValue,
        fields,
        roundToWholeReais,
    };
    const isPercentValid = percentText.trim() !== '' && percentValue > 0 && isValidAdjustmentPercent(adjustment.percent);

    const brands = useMemo(
        () => films
            .map(getFilmMatchingBrand)
            .filter((item, index, all) => item && all.indexOf(item) === index)
            .sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [films]
    );

    const rows = sortFilmsForDisplay(films)
        .filter(film => !brand || getFilmMatchingBrand(film) === brand)
        .map(film => ({
            film,
            changes: isPercentValid ? getFilmPriceChanges(film, adjustment) : [],
            selected: !excludedNames.has(film.nome),
        }));
    const toApply = rows.filter(row => row.selected && row.changes.length > 0);

    const toggleField = (field: FilmPriceField) => {
        setFields(current => current.includes(field)
            ? current.filter(item => item !== field)
            : FIELD_ORDER.filter(item => item === field || current.includes(item)));
    };

    const toggleFilm = (filmName: string) => {
        setExcludedNames(current => {
            const next = new Set(current);
            if (next.has(filmName)) next.delete(filmName);
            else next.add(filmName);
            return next;
        });
    };

    const handleApply = async () => {
        if (isSaving || toApply.length === 0) return;

        const previous = toApply.map(row => row.film);
        const updated = previous.map(film => applyFilmPriceAdjustment(film, adjustment));
        setIsSaving(true);
        try {
            await onSaveFilms(updated);
            onClose();
            showToast(
                updated.length === 1 ? 'Preço de 1 película reajustado.' : `Preços de ${updated.length} películas reajustados.`,
                {
                    tone: 'success',
                    duration: 8000,
                    actionLabel: 'Desfazer',
                    onAction: () => {
                        onSaveFilms(previous)
                            .then(() => showToast('Reajuste desfeito.', { tone: 'info' }))
                            .catch(() => showToast('Não foi possível desfazer. Confira os preços.', { tone: 'error' }));
                    },
                }
            );
        } catch {
            setIsSaving(false);
            showToast('Não foi possível salvar os preços. Tente novamente.', { tone: 'error' });
        }
    };

    const chip = (active: boolean) =>
        `inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${active
            ? 'border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:text-[var(--text-strong)]'}`;

    const footer = (
        <>
            <ActionButton onClick={onClose} variant="ghost" size="sm" disabled={isSaving}>Cancelar</ActionButton>
            <ActionButton
                onClick={handleApply}
                variant="primary"
                size="sm"
                disabled={toApply.length === 0}
                loading={isSaving}
                loadingText="Salvando..."
            >
                {toApply.length === 1 ? 'Reajustar 1 película' : `Reajustar ${toApply.length} películas`}
            </ActionButton>
        </>
    );

    return (
        <Modal isOpen onClose={isSaving ? () => {} : onClose} title="Reajustar preços" footer={footer} disableClose={isSaving}>
            <div className="space-y-5">
                <section className="space-y-2">
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Aumentar ou reduzir">
                        <button type="button" aria-pressed={direction === 'increase'} onClick={() => setDirection('increase')} className={`${chip(direction === 'increase')} justify-center rounded-[var(--radius-control)]`}>
                            Aumentar
                        </button>
                        <button type="button" aria-pressed={direction === 'decrease'} onClick={() => setDirection('decrease')} className={`${chip(direction === 'decrease')} justify-center rounded-[var(--radius-control)]`}>
                            Reduzir
                        </button>
                    </div>
                    <label htmlFor="reajuste-percentual" className="ui-label block pt-1">Percentual</label>
                    <div className="flex items-center gap-2">
                        <div className="relative w-28 shrink-0">
                            <input
                                id="reajuste-percentual"
                                type="text"
                                inputMode="decimal"
                                value={percentText}
                                onChange={event => setPercentText(event.target.value.replace(/[^\d,.]/g, ''))}
                                aria-invalid={!isPercentValid}
                                className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-3 pr-8 text-lg font-bold text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-muted)]">%</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_PERCENTS.map(value => (
                                <button key={value} type="button" onClick={() => setPercentText(String(value))} className={chip(percentText === String(value))}>
                                    {value}%
                                </button>
                            ))}
                        </div>
                    </div>
                    {!isPercentValid && (
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            {direction === 'decrease'
                                ? `Informe uma redução entre 0,1% e ${-MIN_ADJUSTMENT_PERCENT}%.`
                                : `Informe um aumento entre 0,1% e ${MAX_ADJUSTMENT_PERCENT}%.`}
                        </p>
                    )}
                </section>

                <section className="space-y-2">
                    <h3 className="ui-label">O que reajustar</h3>
                    <div className="space-y-1.5">
                        {FIELD_ORDER.map(field => (
                            <label key={field} className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--text-strong)]">
                                <input type="checkbox" checked={fields.includes(field)} onChange={() => toggleField(field)} className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                {FILM_PRICE_FIELD_LABELS[field]}
                            </label>
                        ))}
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm text-[var(--text-body)]">
                            <input type="checkbox" checked={roundToWholeReais} onChange={event => setRoundToWholeReais(event.target.checked)} className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            Arredondar para reais inteiros
                        </label>
                    </div>
                </section>

                <section className="space-y-2">
                    <h3 className="ui-label">Películas</h3>
                    {brands.length > 0 && (
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por marca">
                            <button type="button" aria-pressed={brand === null} onClick={() => setBrand(null)} className={chip(brand === null)}>Todas</button>
                            {brands.map(item => (
                                <button key={item} type="button" aria-pressed={brand === item} onClick={() => setBrand(item)} className={chip(brand === item)}>
                                    {item}
                                </button>
                            ))}
                        </div>
                    )}
                    <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                        {rows.map(({ film, changes, selected }) => (
                            <li key={film.nome}>
                                <label className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${changes.length === 0 ? 'opacity-60' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={selected && changes.length > 0}
                                        disabled={changes.length === 0}
                                        onChange={() => toggleFilm(film.nome)}
                                        aria-label={`Reajustar ${film.nome}`}
                                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{film.nome}</span>
                                        {changes.length > 0 ? (
                                            changes.map(change => (
                                                <span key={change.field} className="mt-0.5 block text-xs tabular-nums text-[var(--text-muted)]">
                                                    {FILM_PRICE_FIELD_LABELS[change.field]}: {formatCurrency(change.before)} → <strong className="text-[var(--text-strong)]">{formatCurrency(change.after)}</strong>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">Sem valor para reajustar</span>
                                        )}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </section>

                <p className="rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs leading-5 text-[var(--text-muted)]">
                    Propostas já geradas (PDF e link do cliente) mantêm o valor. Orçamentos ainda em edição passam a usar o preço novo.
                </p>
            </div>
        </Modal>
    );
};

export default FilmPriceAdjustmentModal;
