import React, { useState } from 'react';
import { Film } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { isFilmNameTaken } from '../../src/lib/filmCatalog';
import { normalizeFilmForPersistence } from '../../src/lib/filmPersistence';
import { getFilmMatchingBrand } from '../../utils/filmMatchingMetadata';

interface FilmImportReviewModalProps {
    /** Películas lidas da tabela pela IA. */
    candidates: Partial<Film>[];
    /** Catálogo atual: película com o mesmo nome não é importada. */
    films: Film[];
    onClose: () => void;
    onSaveFilms: (films: Film[]) => Promise<void>;
    /** "Desfazer" do aviso: remove as películas recém-importadas. */
    onDeleteFilms: (filmNames: string[]) => Promise<void>;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// "1.234,56" e "95,5" (vírgula decimal) ou "95.5" (ponto do teclado numérico).
const parsePrice = (text: string): number => {
    const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
};

const describeSpecs = (film: Partial<Film>) => [
    getFilmMatchingBrand(film as Film),
    film.vtl ? `VTL ${film.vtl}%` : null,
    film.uv ? `UV ${film.uv}%` : null,
    film.ir ? `IR ${film.ir}%` : null,
    film.tser ? `TSER ${film.tser}%` : null,
].filter(Boolean).join(' · ');

const FilmImportReviewModal: React.FC<FilmImportReviewModalProps> = ({ candidates, films, onClose, onSaveFilms, onDeleteFilms }) => {
    const { showToast } = useFeedback();
    const rows = candidates.map(candidate => ({
        candidate,
        name: candidate.nome || '',
        exists: isFilmNameTaken(candidate.nome || '', films),
    }));
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(rows.filter(row => !row.exists).map(row => row.name))
    );
    const [salePrices, setSalePrices] = useState<Record<string, string>>(() => Object.fromEntries(
        rows.map(row => [row.name, row.candidate.preco ? String(row.candidate.preco).replace('.', ',') : ''])
    ));
    const [isSaving, setIsSaving] = useState(false);

    const toImport = rows.filter(row => !row.exists && selected.has(row.name));
    const withoutSalePrice = toImport.filter(row => !parsePrice(salePrices[row.name] || '')).length;
    const newCount = rows.filter(row => !row.exists).length;

    const toggle = (name: string) => {
        setSelected(current => {
            const next = new Set(current);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const handleImport = async () => {
        if (isSaving || toImport.length === 0) return;

        const newFilms = toImport.map(row => normalizeFilmForPersistence({
            ...row.candidate,
            nome: row.name,
            preco: parsePrice(salePrices[row.name] || ''),
        } as Film));
        setIsSaving(true);
        try {
            await onSaveFilms(newFilms);
            onClose();
            const names = newFilms.map(film => film.nome);
            showToast(
                names.length === 1 ? '1 película importada.' : `${names.length} películas importadas.`,
                {
                    tone: 'success',
                    duration: 8000,
                    actionLabel: 'Desfazer',
                    onAction: () => {
                        onDeleteFilms(names)
                            .then(() => showToast('Importação desfeita.', { tone: 'info' }))
                            .catch(() => showToast('Não foi possível desfazer. Confira o catálogo.', { tone: 'error' }));
                    },
                }
            );
        } catch {
            setIsSaving(false);
            showToast('Não foi possível importar as películas. Tente novamente.', { tone: 'error' });
        }
    };

    const footer = (
        <>
            <ActionButton onClick={onClose} variant="ghost" size="sm" disabled={isSaving}>Cancelar</ActionButton>
            <ActionButton
                onClick={handleImport}
                variant="primary"
                size="sm"
                disabled={toImport.length === 0}
                loading={isSaving}
                loadingText="Importando..."
            >
                {toImport.length === 1 ? 'Importar 1 película' : `Importar ${toImport.length} películas`}
            </ActionButton>
        </>
    );

    return (
        <Modal isOpen onClose={isSaving ? () => {} : onClose} title="Revisar importação" footer={footer} disableClose={isSaving}>
            <div className="space-y-4">
                <p className="text-sm text-[var(--text-body)]">
                    {rows.length === 1 ? 'A IA encontrou 1 película.' : `A IA encontrou ${rows.length} películas.`}
                    {newCount < rows.length ? ' As que você já tem ficam como estão.' : ''}
                    {' '}Confira os nomes e informe o preço de venda se já souber.
                </p>

                <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                    {rows.map(({ candidate, name, exists }) => {
                        const specs = describeSpecs(candidate);
                        const isSelected = !exists && selected.has(name);
                        return (
                            <li key={name} className={`flex items-start gap-3 px-3 py-3 ${exists ? 'opacity-60' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={exists}
                                    onChange={() => toggle(name)}
                                    aria-label={`Importar ${name}`}
                                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{name}</p>
                                    {specs && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{specs}</p>}
                                    {candidate.precoMetroLinear ? (
                                        <p className="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">
                                            Custo: {formatCurrency(candidate.precoMetroLinear)} por metro linear
                                        </p>
                                    ) : null}
                                    {exists ? (
                                        <p className="mt-1 text-xs font-medium text-[var(--text-body)]">Já cadastrada — não será alterada.</p>
                                    ) : (
                                        <label className="mt-2 flex items-center gap-2 text-xs font-medium text-[var(--text-body)]">
                                            Venda por m²
                                            <span className="relative">
                                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">R$</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={salePrices[name] || ''}
                                                    onChange={event => setSalePrices(current => ({
                                                        ...current,
                                                        [name]: event.target.value.replace(/[^\d,.]/g, ''),
                                                    }))}
                                                    disabled={!isSelected}
                                                    placeholder="0,00"
                                                    aria-label={`Preço de venda por m² de ${name}`}
                                                    className="h-9 w-28 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-8 pr-2 text-sm font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
                                                />
                                            </span>
                                        </label>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {withoutSalePrice > 0 && (
                    <p className="rounded-md bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                        {withoutSalePrice === 1
                            ? '1 película vai entrar sem preço de venda (R$ 0). Preencha depois em Editar antes de usar em orçamento.'
                            : `${withoutSalePrice} películas vão entrar sem preço de venda (R$ 0). Preencha depois em Editar antes de usar em orçamento.`}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default FilmImportReviewModal;
