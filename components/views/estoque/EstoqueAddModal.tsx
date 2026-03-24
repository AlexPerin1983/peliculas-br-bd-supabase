import React from 'react';
import { Bobina } from '../../../types';

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
}: EstoqueAddModalProps) {
    if (!isOpen) return null;

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
                                {formFilmId || 'Selecione uma pelicula'}
                            </span>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-slate-400">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Largura (cm) *
                            </label>
                            <input
                                type="number"
                                value={formLargura}
                                onChange={(e) => setFormLargura(e.target.value)}
                                placeholder="Ex: 152"
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                {activeTab === 'bobinas' ? 'Comprimento (m) *' : 'Comprimento (cm) *'}
                            </label>
                            <input
                                type="number"
                                value={formComprimento}
                                onChange={(e) => setFormComprimento(e.target.value)}
                                placeholder={activeTab === 'bobinas' ? 'Ex: 30' : 'Ex: 150'}
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

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
                                <select
                                    value={formBobinaId}
                                    onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : '';
                                        setFormBobinaId(val);
                                        if (val) {
                                            const bobina = bobinas.find((b) => b.id === val);
                                            if (bobina) {
                                                setFormFilmId(bobina.filmId);
                                                setFormLargura(bobina.larguraCm.toString());
                                            }
                                        }
                                    }}
                                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                >
                                    <option value="">Retalho avulso (sem bobina)</option>
                                    {bobinas.filter((b) => b.status === 'ativa').map((bobina) => (
                                        <option key={bobina.id} value={bobina.id}>
                                            {bobina.filmId} - {bobina.larguraCm}cm ({bobina.comprimentoRestanteM.toFixed(1)}m restantes)
                                        </option>
                                    ))}
                                </select>
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
        </div>
    );
}
