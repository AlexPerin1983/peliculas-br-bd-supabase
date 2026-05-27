import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bobina } from '../../../types';
import { formatMetersFromCentimeters } from '../../../src/lib/estoqueDimensions';

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

    if (!isOpen) return null;

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

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-shrink-0 p-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-100">
                            {activeTab === 'bobinas' ? 'Nova Bobina' : 'Novo Retalho'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-700"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Pelicula *
                        </label>
                        <button
                            type="button"
                            onClick={onOpenFilmSelection}
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-left hover:bg-slate-600 hover:border-slate-500 transition-all flex items-center justify-between"
                        >
                            <span className={formFilmId ? 'text-slate-100' : 'text-slate-400'}>
                                {formFilmId || 'Selecione uma película'}
                            </span>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-slate-400">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Largura *
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formLargura}
                                onChange={(e) => setFormLargura(e.target.value)}
                                placeholder="Ex: 1,52 ou 152"
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                required
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                Aceita metros ou centimetros. Exemplos: 1,52 = 152 cm
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                {activeTab === 'bobinas' ? 'Comprimento (m) *' : 'Comprimento *'}
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formComprimento}
                                onChange={(e) => setFormComprimento(e.target.value)}
                                placeholder={activeTab === 'bobinas' ? 'Ex: 30 ou 30,5' : 'Ex: 0,55 ou 55'}
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                required
                            />
                            {activeTab !== 'bobinas' && (
                                <p className="mt-1 text-xs text-slate-400">
                                    Aceita metros ou centimetros. Exemplos: 0,55 = 55 cm
                                </p>
                            )}
                        </div>
                    </div>

                    {activeTab === 'retalhos' && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                            <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3">
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-200 mb-1">
                                        Quantidade
                                    </label>
                                    <p className="text-xs leading-5 text-slate-400">
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
                                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'bobinas' ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Fornecedor
                                    </label>
                                    <input
                                        type="text"
                                        value={formFornecedor}
                                        onChange={(e) => setFormFornecedor(e.target.value)}
                                        placeholder="Ex: 3M, Solar Gard"
                                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Lote
                                    </label>
                                    <input
                                        type="text"
                                        value={formLote}
                                        onChange={(e) => setFormLote(e.target.value)}
                                        placeholder="Ex: ABC123"
                                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Custo Total (R$)
                                </label>
                                <input
                                    type="number"
                                    value={formCusto}
                                    onChange={(e) => setFormCusto(e.target.value)}
                                    placeholder="Ex: 1500.00"
                                    step="0.01"
                                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Origem do Retalho
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsOriginSearchOpen(true)}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-700 p-3 text-left transition-all hover:border-slate-500 hover:bg-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    aria-label="Escolher origem do retalho"
                                >
                                    <span className="flex items-center justify-between gap-3">
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-slate-100">
                                                {selectedOriginLabel}
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-slate-400">
                                                {selectedOriginDetail}
                                            </span>
                                        </span>
                                        <i className="fas fa-search flex-shrink-0 text-slate-400" aria-hidden="true"></i>
                                    </span>
                                </button>
                            </div>

                            {formBobinaId && (
                                <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formDeduzirDaBobina}
                                            onChange={(e) => setFormDeduzirDaBobina(e.target.checked)}
                                            className="mt-1 w-4 h-4 rounded border-slate-500 text-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        <div className="flex-1">
                                            <span className="text-slate-200 font-medium">
                                                Deduzir do estoque da bobina
                                            </span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Ao marcar, o comprimento do retalho sera descontado da bobina automaticamente
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Localizacao
                        </label>
                        <input
                            type="text"
                            value={formLocalizacao}
                            onChange={(e) => setFormLocalizacao(e.target.value)}
                            placeholder="Ex: Prateleira A, Gaveta 3"
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Observacao
                        </label>
                        <textarea
                            value={formObservacao}
                            onChange={(e) => setFormObservacao(e.target.value)}
                            placeholder="Observacoes adicionais..."
                            rows={3}
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="flex-shrink-0 p-4 border-t border-slate-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-700 text-slate-200 font-semibold rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSubmit}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {activeTab === 'bobinas' ? 'Adicionar Bobina' : 'Adicionar Retalho'}
                    </button>
                </div>
            </div>

            {isOriginSearchOpen && (
                <div
                    className="fixed inset-0 z-[10001] flex flex-col bg-slate-950/95 backdrop-blur-sm animate-fade-in"
                    onClick={(event) => {
                        event.stopPropagation();
                        closeOriginSearch();
                    }}
                >
                    <div
                        className="flex-shrink-0 border-b border-slate-700 bg-slate-950 p-4"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold text-slate-100">Origem do Retalho</h3>
                                <p className="mt-1 text-xs text-slate-400">
                                    Busque pelas bobinas ativas do estoque.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeOriginSearch}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                                aria-label="Fechar busca de origem"
                            >
                                <i className="fas fa-times text-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div className="relative mx-auto mt-4 max-w-3xl">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"></i>
                            <input
                                ref={originSearchInputRef}
                                type="text"
                                value={originSearchTerm}
                                onChange={(event) => setOriginSearchTerm(event.target.value)}
                                placeholder="Buscar por pelicula, ID, lote ou local..."
                                className="w-full rounded-lg border border-blue-500/60 bg-slate-800 py-3 pl-12 pr-12 text-slate-100 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                                aria-label="Buscar origem do retalho"
                            />
                            {originSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOriginSearchTerm('');
                                        originSearchInputRef.current?.focus();
                                    }}
                                    className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-400 transition-colors hover:text-slate-200"
                                    aria-label="Limpar busca de origem"
                                >
                                    <i className="fas fa-times-circle text-lg" aria-hidden="true"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto p-4"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mx-auto max-w-3xl space-y-2">
                            <button
                                type="button"
                                onClick={handleSelectOriginAvulso}
                                className={`w-full rounded-lg border p-4 text-left transition-all ${
                                    formBobinaId === ''
                                        ? 'border-blue-400 bg-blue-500/15'
                                        : 'border-slate-700 bg-slate-800 hover:border-slate-600 hover:bg-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-100">Retalho avulso (sem bobina)</p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Use quando a sobra ja esta separada fisicamente.
                                        </p>
                                    </div>
                                    {formBobinaId === '' ? (
                                        <i className="fas fa-check-circle flex-shrink-0 text-blue-300" aria-hidden="true"></i>
                                    ) : null}
                                </div>
                            </button>

                            {filteredBobinas.map((bobina) => (
                                <button
                                    type="button"
                                    key={bobina.id}
                                    onClick={() => handleSelectOriginBobina(bobina)}
                                    className={`w-full rounded-lg border p-4 text-left transition-all ${
                                        formBobinaId === bobina.id
                                            ? 'border-blue-400 bg-blue-500/15'
                                            : 'border-slate-700 bg-slate-800 hover:border-slate-600 hover:bg-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-semibold text-slate-100">{bobina.filmId}</p>
                                                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                                    ativa
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-400">
                                                #{bobina.id} - {formatMetersFromCentimeters(bobina.larguraCm)}m largura - {bobina.comprimentoRestanteM.toFixed(1)}m restantes
                                            </p>
                                            {(bobina.localizacao || bobina.fornecedor || bobina.lote) && (
                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {[bobina.localizacao, bobina.fornecedor, bobina.lote ? `Lote ${bobina.lote}` : ''].filter(Boolean).join(' - ')}
                                                </p>
                                            )}
                                        </div>
                                        {formBobinaId === bobina.id ? (
                                            <i className="fas fa-check-circle flex-shrink-0 text-blue-300" aria-hidden="true"></i>
                                        ) : (
                                            <i className="fas fa-chevron-right flex-shrink-0 text-slate-500" aria-hidden="true"></i>
                                        )}
                                    </div>
                                </button>
                            ))}

                            {filteredBobinas.length === 0 && (
                                <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
                                    <p className="font-semibold text-slate-200">Nenhuma bobina ativa encontrada</p>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Tente buscar por outro nome, ID, lote ou localizacao.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
