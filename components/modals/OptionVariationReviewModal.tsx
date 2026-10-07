import React, { useState } from 'react';
import { Film } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import { sortFilmsForDisplay } from '../../src/lib/filmCatalog';
import {
    OptionVariationPlan,
    OptionVariationRow,
    suggestVariationName,
} from '../../src/lib/aiOptionVariation';

interface OptionVariationReviewModalProps {
    plan: OptionVariationPlan;
    films: Film[];
    onCancel: () => void;
    onConfirm: (rows: OptionVariationRow[], optionName: string) => void;
}

/** Conferência do "Duplicar com IA": o que mantém, o que troca e o nome da nova opção. */
const OptionVariationReviewModal: React.FC<OptionVariationReviewModalProps> = ({ plan, films, onCancel, onConfirm }) => {
    const [rows, setRows] = useState<OptionVariationRow[]>(plan.rows);
    const [optionName, setOptionName] = useState(() => suggestVariationName(plan));
    const [isNameEdited, setIsNameEdited] = useState(false);
    const catalog = sortFilmsForDisplay(films);
    const changes = rows.filter(row => row.target).length;

    const chooseTarget = (current: string, target: string) => {
        const nextRows = rows.map(row => row.current === current
            ? { ...row, target: target || null, notFound: target ? undefined : row.notFound }
            : row);
        setRows(nextRows);
        if (!isNameEdited) setOptionName(suggestVariationName(plan, nextRows));
    };

    const footer = (
        <>
            <ActionButton onClick={onCancel} variant="ghost" size="sm">Cancelar</ActionButton>
            <ActionButton onClick={() => onConfirm(rows, optionName.trim())} variant="primary" size="sm" disabled={changes === 0}>
                Gerar nova opção
            </ActionButton>
        </>
    );

    return (
        <Modal isOpen onClose={onCancel} title="Confira a nova opção" footer={footer}>
            <div className="space-y-4">
                <p className="text-sm text-[var(--text-body)]">
                    A IA montou as trocas abaixo. Ajuste se precisar; o PDF da nova opção sai em seguida.
                </p>
                {plan.note ? (
                    <p className="rounded-md bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">{plan.note}</p>
                ) : null}

                <ul className="space-y-2">
                    {rows.map(row => (
                        <li key={row.current} className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                            <div className="flex items-center gap-2">
                                <i
                                    className={`fas ${row.target ? 'fa-right-left text-blue-600 dark:text-blue-400' : 'fa-check text-emerald-600 dark:text-emerald-400'} text-xs`}
                                    aria-hidden="true"
                                ></i>
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">{row.current}</span>
                                <span className="text-xs font-medium text-[var(--text-muted)]">{row.target ? 'troca' : 'mantém'}</span>
                            </div>
                            <label className="mt-2 block text-xs font-medium text-[var(--text-body)]">
                                Na nova opção
                                <select
                                    value={row.target || ''}
                                    onChange={event => chooseTarget(row.current, event.target.value)}
                                    aria-label={`Película no lugar de ${row.current}`}
                                    className="ui-field mt-1 block w-full px-3 py-2.5 text-sm"
                                >
                                    <option value="">Manter {row.current}</option>
                                    {catalog.filter(film => film.nome !== row.current).map(film => (
                                        <option key={film.nome} value={film.nome}>{film.nome}</option>
                                    ))}
                                </select>
                            </label>
                            {row.notFound && !row.target ? (
                                <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Não achei "{row.notFound}" no catálogo. Escolha na lista.
                                </p>
                            ) : null}
                        </li>
                    ))}
                </ul>

                <label className="block">
                    <span className="ui-label">Nome da nova opção</span>
                    <input
                        type="text"
                        value={optionName}
                        onChange={event => { setOptionName(event.target.value); setIsNameEdited(true); }}
                        placeholder="Ex.: Window Premium"
                        className="ui-field mt-1 block w-full px-3 py-2.5 text-sm"
                    />
                </label>
            </div>
        </Modal>
    );
};

export default OptionVariationReviewModal;
