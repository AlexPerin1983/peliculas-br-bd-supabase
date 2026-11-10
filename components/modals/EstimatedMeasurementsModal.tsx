import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import type { EstimatedMeasurement } from '../../src/lib/aiMeasurementExtraction';

interface EstimatedMeasurementsModalProps {
    isOpen: boolean;
    items: EstimatedMeasurement[];
    note?: string;
    onClose: () => void;
    onConfirm: (items: EstimatedMeasurement[]) => void;
}

const parseMeters = (value: string) => {
    const meters = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(meters) && meters > 0 ? meters : null;
};

const isValidItem = (item: EstimatedMeasurement) => (
    parseMeters(item.largura) !== null && parseMeters(item.altura) !== null && item.quantidade > 0
);

const FIELD_CLASS = 'h-10 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 text-[var(--text-strong)] outline-none transition-colors focus:border-[var(--brand-primary)]';

const DIMENSION_FIELDS: Array<{ field: 'largura' | 'altura'; label: string }> = [
    { field: 'largura', label: 'Largura (m)' },
    { field: 'altura', label: 'Altura (m)' },
];

/**
 * O cliente mandou só a foto, sem medidas: a IA sugere medidas aproximadas e
 * o aplicador confere e corrige aqui antes de entrarem no orçamento.
 */
const EstimatedMeasurementsModal: React.FC<EstimatedMeasurementsModalProps> = ({ isOpen, items, note, onClose, onConfirm }) => {
    const [rows, setRows] = useState<EstimatedMeasurement[]>(items);

    useEffect(() => {
        if (isOpen) setRows(items);
    }, [isOpen, items]);

    const updateRow = (index: number, patch: Partial<EstimatedMeasurement>) => {
        setRows(current => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    };

    const validRows = rows.filter(isValidItem);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Medidas aproximadas"
            footer={
                <>
                    <ActionButton variant="ghost" onClick={onClose}>Cancelar</ActionButton>
                    <ActionButton
                        variant="primary"
                        disabled={validRows.length === 0}
                        onClick={() => onConfirm(validRows)}
                    >
                        {validRows.length === 1 ? 'Adicionar 1 medida' : `Adicionar ${validRows.length} medidas`}
                    </ActionButton>
                </>
            }
        >
            <div className="space-y-4">
                <p className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    A foto não tinha medidas escritas. Estas são estimativas pela imagem: confira e corrija antes de adicionar, e meça no local antes de fechar o valor.
                </p>
                {note ? <p className="text-xs leading-relaxed text-[var(--text-muted)]">{note}</p> : null}

                <ul className="space-y-3">
                    {rows.map((row, index) => (
                        <li key={index} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                            <div className="flex items-center gap-2">
                                <label className="min-w-0 flex-1">
                                    <span className="sr-only">Local da medida {index + 1}</span>
                                    <input
                                        type="text"
                                        value={row.local}
                                        onChange={event => updateRow(index, { local: event.target.value })}
                                        placeholder="Local"
                                        className={FIELD_CLASS}
                                        style={{ fontSize: 16 }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}
                                    aria-label={`Remover medida ${index + 1}`}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-rose-600"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                            <div className="mt-2 grid grid-cols-[1fr_1fr_72px] gap-2">
                                {DIMENSION_FIELDS.map(({ field, label }) => (
                                    <label key={field} className="min-w-0">
                                        <span className="mb-1 block text-xs text-[var(--text-muted)]">{label}</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={row[field]}
                                            onChange={event => updateRow(index, field === 'largura' ? { largura: event.target.value } : { altura: event.target.value })}
                                            className={`${FIELD_CLASS} tabular-nums`}
                                            style={{ fontSize: 16 }}
                                        />
                                    </label>
                                ))}
                                <label className="min-w-0">
                                    <span className="mb-1 block text-xs text-[var(--text-muted)]">Qtd.</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        value={row.quantidade}
                                        onChange={event => updateRow(index, { quantidade: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
                                        className={`${FIELD_CLASS} tabular-nums`}
                                        style={{ fontSize: 16 }}
                                    />
                                </label>
                            </div>
                        </li>
                    ))}
                </ul>

                <button
                    type="button"
                    onClick={() => setRows(current => [...current, { local: '', largura: '', altura: '', quantidade: 1 }])}
                    className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] px-3 text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="text-sm font-medium">Adicionar outra</span>
                </button>
            </div>
        </Modal>
    );
};

export default EstimatedMeasurementsModal;
