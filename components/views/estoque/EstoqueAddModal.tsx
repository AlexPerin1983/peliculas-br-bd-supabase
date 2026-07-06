import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bobina } from '../../../types';
import { formatMetersFromCentimeters } from '../../../src/lib/estoqueDimensions';
import Modal from '../../ui/Modal';

type EstoqueAddModalProps = {
    isOpen: boolean;
    activeTab: 'bobinas' | 'retalhos';
    onClose: () => void;
    onOpenFilmSelection: () => void;
    onSubmit: () => void;
    bobinas: Bobina[];
    formFilmId: string;
    setFormFilmId: (value: string) => void;
    formLargura: string;
    setFormLargura: (value: string) => void;
    formComprimento: string;
    setFormComprimento: (value: string) => void;
    formFornecedor: string;
    setFormFornecedor: (value: string) => void;
    formLote: string;
    setFormLote: (value: string) => void;
    formCusto: string;
    setFormCusto: (value: string) => void;
    formLocalizacao: string;
    setFormLocalizacao: (value: string) => void;
    formObservacao: string;
    setFormObservacao: (value: string) => void;
    formBobinaId: number | '';
    setFormBobinaId: (value: number | '') => void;
    formDeduzirDaBobina: boolean;
    setFormDeduzirDaBobina: (value: boolean) => void;
    formQuantidade: string;
    setFormQuantidade: (value: string) => void;
};

const fieldClass = 'ui-field w-full p-3 text-sm placeholder:text-[var(--text-muted)]';
const labelClass = 'ui-label mb-1.5 block';
const helperClass = 'mt-1 text-xs text-[var(--text-muted)]';

export default function EstoqueAddModal({
    isOpen,
    activeTab,
    onClose,
    onOpenFilmSelection,
    onSubmit,
    bobinas,
    formFilmId,
    setFormFilmId,
    formLargura,
    setFormLargura,
    formComprimento,
    setFormComprimento,
    formFornecedor,
    setFormFornecedor,
    formLote,
    setFormLote,
    formCusto,
    setFormCusto,
    formLocalizacao,
    setFormLocalizacao,
    formObservacao,
    setFormObservacao,
    formBobinaId,
    setFormBobinaId,
    formDeduzirDaBobina,
    setFormDeduzirDaBobina,
    formQuantidade,
    setFormQuantidade,
}: EstoqueAddModalProps) {
    const [isOriginSearchOpen, setIsOriginSearchOpen] = useState(false);
    const [originSearchTerm, setOriginSearchTerm] = useState('');
    const originSearchInputRef = useRef<HTMLInputElement>(null);

    const activeBobinas = useMemo(
        () => bobinas.filter((bobina) => bobina.status === 'ativa' && typeof bobina.id === 'number'),
        [bobinas]
    );
    const selectedBobina = useMemo(
        () => (typeof formBobinaId === 'number' ? bobinas.find((bobina) => bobina.id === formBobinaId) : undefined),
        [bobinas, formBobinaId]
    );
    const normalizedOriginSearch = originSearchTerm.trim().toLowerCase();
    const filteredBobinas = useMemo(() => {
        if (!normalizedOriginSearch) return activeBobinas;

        return activeBobinas.filter((bobina) => {
            const searchableText = [
                bobina.id ? `#${bobina.id}` : '',
                bobina.filmId,
                `${bobina.larguraCm}cm`,
                `${formatMetersFromCentimeters(bobina.larguraCm)}m`,
                `${bobina.comprimentoRestanteM.toFixed(1)}m`,
                bobina.localizacao,
                bobina.fornecedor,
                bobina.lote,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(normalizedOriginSearch);
        });
    }, [activeBobinas, normalizedOriginSearch]);

    useEffect(() => {
        if (!isOriginSearchOpen) return;

        const focusTimer = window.setTimeout(() => originSearchInputRef.current?.focus(), 80);
        return () => window.clearTimeout(focusTimer);
    }, [isOriginSearchOpen]);

    useEffect(() => {
        if (isOpen) return;

        setIsOriginSearchOpen(false);
        setOriginSearchTerm('');
    }, [isOpen]);

    useEffect(() => {
        if (!isOriginSearchOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOriginSearchOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOriginSearchOpen]);

    const selectedOriginLabel = selectedBobina
        ? `${selectedBobina.filmId} - ${formatMetersFromCentimeters(selectedBobina.larguraCm)}m`
        : 'Retalho avulso (sem bobina)';
    const selectedOriginDetail = selectedBobina
        ? `${selectedBobina.comprimentoRestanteM.toFixed(1)}m restantes${selectedBobina.localizacao ? ` - ${selectedBobina.localizacao}` : ''}`
        : 'Cadastrar sem vincular a uma bobina do estoque.';

    const closeOriginSearch = () => {
        setIsOriginSearchOpen(false);
        setOriginSearchTerm('');
    };

    const handleSelectOriginAvulso = () => {
        setFormBobinaId('');
        setFormDeduzirDaBobina(false);
        closeOriginSearch();
    };

    const handleSelectOriginBobina = (bobina: Bobina) => {
        if (typeof bobina.id !== 'number') return;

        setFormBobinaId(bobina.id);
        setFormFilmId(bobina.filmId);
        setFormLargura(formatMetersFromCentimeters(bobina.larguraCm));
        closeOriginSearch();
    };

    const footer = (
        <>
            <button
                onClick={onClose}
                className="flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 font-semibold text-[var(--text-strong)] transition-colors hover:bg-[var(--surface)]"
            >
                Cancelar
            </button>
            <button
                onClick={onSubmit}
                className="flex-1 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 py-3 font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)]"
            >
                {activeTab === 'bobinas' ? 'Adicionar Bobina' : 'Adicionar Retalho'}
            </button>
        </>
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={activeTab === 'bobinas' ? 'Nova Bobina' : 'Novo Retalho'}
                footer={footer}
            >
                <div>
                    <label className={labelClass}>Pelicula *</label>
                    <button
                        type="button"
                        onClick={onOpenFilmSelection}
                        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-left transition-colors hover:bg-[var(--surface)]"
                    >
                        <span className={formFilmId ? 'min-w-0 truncate text-[var(--text-strong)]' : 'min-w-0 truncate text-[var(--text-muted)]'}>
                            {formFilmId || 'Selecione uma película'}
                        </span>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 text-[var(--text-muted)]">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Largura *</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={formLargura}
                            onChange={(e) => setFormLargura(e.target.value)}
                            placeholder="Ex: 1,52 ou 152"
                            className={fieldClass}
                            required
                        />
                        <p className={helperClass}>Aceita metros ou centimetros. Exemplos: 1,52 = 152 cm</p>
                    </div>
                    <div>
                        <label className={labelClass}>
                            {activeTab === 'bobinas' ? 'Comprimento (m) *' : 'Comprimento *'}
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={formComprimento}
                            onChange={(e) => setFormComprimento(e.target.value)}
                            placeholder={activeTab === 'bobinas' ? 'Ex: 30 ou 30,5' : 'Ex: 0,55 ou 55'}
                            className={fieldClass}
                            required
                        />
                        {activeTab !== 'bobinas' && (
                            <p className={helperClass}>Aceita metros ou centimetros. Exemplos: 0,55 = 55 cm</p>
                        )}
                    </div>
                </div>

                {activeTab === 'retalhos' && (
                    <div className="rounded-[var(--radius-control)] border border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)] p-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3">
                            <div className="min-w-0">
                                <label className="mb-1 block text-sm font-medium text-[var(--text-strong)]">Quantidade</label>
                                <p className="text-xs leading-5 text-[var(--text-muted)]">
                                    Retalhos iguais. Cada unidade tera QR e status proprios.
                                </p>
                            </div>
                            <input
                                type="text"
                                inputMode="numeric"
                                aria-label="Quantidade de retalhos iguais"
                                value={formQuantidade}
                                onChange={(e) => setFormQuantidade(e.target.value.replace(/\D/g, ''))}
                                placeholder="1"
                                className={fieldClass}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'bobinas' ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Fornecedor</label>
                                <input
                                    type="text"
                                    value={formFornecedor}
                                    onChange={(e) => setFormFornecedor(e.target.value)}
                                    placeholder="Ex: 3M, Solar Gard"
                                    className={fieldClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Lote</label>
                                <input
                                    type="text"
                                    value={formLote}
                                    onChange={(e) => setFormLote(e.target.value)}
                                    placeholder="Ex: ABC123"
                                    className={fieldClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Custo Total (R$)</label>
                            <input
                                type="number"
                                value={formCusto}
                                onChange={(e) => setFormCusto(e.target.value)}
                                placeholder="Ex: 1500.00"
                                step="0.01"
                                className={fieldClass}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <label className={labelClass}>Origem do Retalho</label>
                            <button
                                type="button"
                                onClick={() => setIsOriginSearchOpen(true)}
                                className="w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-left transition-colors hover:bg-[var(--surface)]"
                                aria-label="Escolher origem do retalho"
                            >
                                <span className="flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">
                                            {selectedOriginLabel}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                                            {selectedOriginDetail}
                                        </span>
                                    </span>
                                    <i className="fas fa-search flex-shrink-0 text-[var(--text-muted)]" aria-hidden="true"></i>
                                </span>
                            </button>
                        </div>

                        {formBobinaId && (
                            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={formDeduzirDaBobina}
                                        onChange={(e) => setFormDeduzirDaBobina(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--brand-primary)]"
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-[var(--text-strong)]">Deduzir do estoque da bobina</span>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                            Ao marcar, o comprimento do retalho sera descontado da bobina automaticamente
                                        </p>
                                    </div>
                                </label>
                            </div>
                        )}
                    </>
                )}

                <div>
                    <label className={labelClass}>Localizacao</label>
                    <input
                        type="text"
                        value={formLocalizacao}
                        onChange={(e) => setFormLocalizacao(e.target.value)}
                        placeholder="Ex: Prateleira A, Gaveta 3"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass}>Observacao</label>
                    <textarea
                        value={formObservacao}
                        onChange={(e) => setFormObservacao(e.target.value)}
                        placeholder="Observacoes adicionais..."
                        rows={3}
                        className={`${fieldClass} resize-none`}
                    />
                </div>
            </Modal>

            {isOpen && isOriginSearchOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="pointer-events-auto fixed inset-0 z-[10060] flex flex-col bg-[var(--surface)] animate-fade-in"
                    onClick={closeOriginSearch}
                    data-modal-companion
                >
                    <div
                        className="flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold text-[var(--text-strong)]">Origem do Retalho</h3>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Busque pelas bobinas ativas do estoque.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeOriginSearch}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                aria-label="Fechar busca de origem"
                            >
                                <i className="fas fa-times text-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div className="relative mx-auto mt-4 max-w-3xl">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true"></i>
                            <input
                                ref={originSearchInputRef}
                                type="text"
                                value={originSearchTerm}
                                onChange={(event) => setOriginSearchTerm(event.target.value)}
                                placeholder="Buscar por pelicula, ID, lote ou local..."
                                className="ui-field w-full py-3 pl-12 pr-12 placeholder:text-[var(--text-muted)]"
                                aria-label="Buscar origem do retalho"
                            />
                            {originSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOriginSearchTerm('');
                                        originSearchInputRef.current?.focus();
                                    }}
                                    className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                                    aria-label="Limpar busca de origem"
                                >
                                    <i className="fas fa-times-circle text-lg" aria-hidden="true"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4" onClick={(event) => event.stopPropagation()}>
                        <div className="mx-auto max-w-3xl space-y-2">
                            <button
                                type="button"
                                onClick={handleSelectOriginAvulso}
                                className={`w-full rounded-[var(--radius-control)] border p-4 text-left transition-all ${
                                    formBobinaId === ''
                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                                        : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-[var(--text-strong)]">Retalho avulso (sem bobina)</p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                            Use quando a sobra ja esta separada fisicamente.
                                        </p>
                                    </div>
                                    {formBobinaId === '' ? (
                                        <i className="fas fa-check-circle flex-shrink-0 text-[var(--brand-primary)]" aria-hidden="true"></i>
                                    ) : null}
                                </div>
                            </button>

                            {filteredBobinas.map((bobina) => (
                                <button
                                    type="button"
                                    key={bobina.id}
                                    onClick={() => handleSelectOriginBobina(bobina)}
                                    className={`w-full rounded-[var(--radius-control)] border p-4 text-left transition-all ${
                                        formBobinaId === bobina.id
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                                            : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-semibold text-[var(--text-strong)]">{bobina.filmId}</p>
                                                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                                                    ativa
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                #{bobina.id} - {formatMetersFromCentimeters(bobina.larguraCm)}m largura - {bobina.comprimentoRestanteM.toFixed(1)}m restantes
                                            </p>
                                            {(bobina.localizacao || bobina.fornecedor || bobina.lote) && (
                                                <p className="mt-1 truncate text-xs text-[var(--text-soft)]">
                                                    {[bobina.localizacao, bobina.fornecedor, bobina.lote ? `Lote ${bobina.lote}` : ''].filter(Boolean).join(' - ')}
                                                </p>
                                            )}
                                        </div>
                                        {formBobinaId === bobina.id ? (
                                            <i className="fas fa-check-circle flex-shrink-0 text-[var(--brand-primary)]" aria-hidden="true"></i>
                                        ) : (
                                            <i className="fas fa-chevron-right flex-shrink-0 text-[var(--text-soft)]" aria-hidden="true"></i>
                                        )}
                                    </div>
                                </button>
                            ))}

                            {filteredBobinas.length === 0 && (
                                <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center">
                                    <p className="font-semibold text-[var(--text-strong)]">Nenhuma bobina ativa encontrada</p>
                                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                                        Tente buscar por outro nome, ID, lote ou localizacao.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
