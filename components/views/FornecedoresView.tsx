import React, { useState, useCallback, useMemo } from 'react';
import { Fornecedor } from '../../types';
import { saveFornecedor, deleteFornecedor, createFornecedor } from '../../services/fornecedorService';

interface FornecedoresViewProps {
    fornecedores: Fornecedor[];
    onUpdate: (list: Fornecedor[]) => void;
}

const EMPTY_FORM = {
    empresa: '',
    contato: '',
    telefone: '',
    representacoes: '',
    email: '',
    observacao: '',
};

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2)  return digits;
    if (digits.length <= 7)  return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function whatsappUrl(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const num = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${num}`;
}

const FornecedorCard: React.FC<{
    f: Fornecedor;
    onEdit: (f: Fornecedor) => void;
    onDelete: (id: string) => void;
}> = ({ f, onEdit, onDelete }) => {
    const initials = f.empresa.slice(0, 2).toUpperCase();

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
            {/* Top accent */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />

            <div className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md shadow-emerald-900/20">
                        {initials}
                    </div>
                    <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">
                            {f.empresa}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {f.contato}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => onEdit(f)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all"
                            title="Editar"
                        >
                            <i className="fas fa-pen text-xs"></i>
                        </button>
                        <button
                            onClick={() => onDelete(f.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-600 hover:text-white transition-all"
                            title="Excluir"
                        >
                            <i className="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                </div>

                {/* Representações */}
                {f.representacoes && (
                    <div className="mb-3 flex flex-wrap gap-1">
                        {f.representacoes.split(',').map(r => r.trim()).filter(Boolean).map(r => (
                            <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
                                {r}
                            </span>
                        ))}
                    </div>
                )}

                {/* Separador */}
                <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 flex items-center justify-between gap-3">
                    {/* Contatos */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {f.email && (
                            <a
                                href={`mailto:${f.email}`}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title={f.email}
                            >
                                <i className="fas fa-envelope text-[10px]"></i>
                                <span className="truncate max-w-[120px]">{f.email}</span>
                            </a>
                        )}
                        {f.observacao && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-[140px]" title={f.observacao}>
                                {f.observacao}
                            </span>
                        )}
                    </div>

                    {/* WhatsApp */}
                    <a
                        href={whatsappUrl(f.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-emerald-900/20"
                    >
                        <i className="fab fa-whatsapp text-sm"></i>
                        {formatPhone(f.telefone)}
                    </a>
                </div>
            </div>
        </div>
    );
};

const FornecedorModal: React.FC<{
    editing: Fornecedor | null;
    onSave: (data: typeof EMPTY_FORM) => void;
    onClose: () => void;
}> = ({ editing, onSave, onClose }) => {
    const [form, setForm] = useState(
        editing
            ? {
                empresa: editing.empresa,
                contato: editing.contato,
                telefone: editing.telefone,
                representacoes: editing.representacoes || '',
                email: editing.email || '',
                observacao: editing.observacao || '',
            }
            : { ...EMPTY_FORM }
    );

    const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.empresa.trim() || !form.contato.trim() || !form.telefone.trim()) return;
        onSave(form);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            {/* Bottom-sheet on mobile, centered dialog on sm+ */}
            <div
                className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 sm:border overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle — mobile only */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>

                {/* Header modal */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                        {editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto max-h-[75vh] sm:max-h-none">
                    {[
                        { key: 'empresa',        label: 'Empresa *',                    placeholder: 'Nome da empresa',          type: 'text' },
                        { key: 'contato',        label: 'Nome do Contato *',            placeholder: 'Ex: João Silva',           type: 'text' },
                        { key: 'telefone',       label: 'Telefone / WhatsApp *',        placeholder: '(11) 99999-9999',          type: 'tel'  },
                        { key: 'representacoes', label: 'Marcas / Representações',      placeholder: 'Ex: 3M, SunTek, Llumar',   type: 'text' },
                        { key: 'email',          label: 'E-mail',                       placeholder: 'contato@empresa.com',      type: 'email'},
                    ].map(({ key, label, placeholder, type }) => (
                        <div key={key}>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</label>
                            <input
                                type={type}
                                value={form[key as keyof typeof EMPTY_FORM]}
                                onChange={set(key as keyof typeof EMPTY_FORM)}
                                placeholder={placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Observação</label>
                        <textarea
                            value={form.observacao}
                            onChange={set('observacao')}
                            placeholder="Informações adicionais..."
                            rows={2}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="flex gap-2 pt-1 pb-safe">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors shadow-sm">
                            {editing ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FornecedoresView: React.FC<FornecedoresViewProps> = ({ fornecedores, onUpdate }) => {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Fornecedor | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return fornecedores;
        const t = search.toLowerCase();
        return fornecedores.filter(f =>
            f.empresa.toLowerCase().includes(t) ||
            f.contato.toLowerCase().includes(t) ||
            (f.representacoes || '').toLowerCase().includes(t)
        );
    }, [fornecedores, search]);

    const handleSave = useCallback((data: typeof EMPTY_FORM) => {
        let updated: Fornecedor;
        if (editing) {
            updated = saveFornecedor({ ...editing, ...data });
        } else {
            updated = saveFornecedor(createFornecedor(data));
        }
        const next = editing
            ? fornecedores.map(f => f.id === updated.id ? updated : f)
            : [updated, ...fornecedores];
        onUpdate(next);
        setModalOpen(false);
        setEditing(null);
    }, [editing, fornecedores, onUpdate]);

    const handleDelete = useCallback((id: string) => {
        deleteFornecedor(id);
        onUpdate(fornecedores.filter(f => f.id !== id));
        setDeleteId(null);
    }, [fornecedores, onUpdate]);

    const openAdd = () => { setEditing(null); setModalOpen(true); };
    const openEdit = (f: Fornecedor) => { setEditing(f); setModalOpen(true); };

    return (
        <div className="space-y-6">
            {/* Busca + Adicionar */}
            <div className="flex gap-3 items-center">
                <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <i className="fas fa-search text-slate-400 text-lg"></i>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por empresa, contato ou marca..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-10 py-4 rounded-xl border-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 focus:ring-2 focus:ring-slate-500 transition-all text-base"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                            <i className="fas fa-times-circle text-lg"></i>
                        </button>
                    )}
                </div>
                <button
                    onClick={openAdd}
                    className="flex-shrink-0 h-14 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                    title="Novo Fornecedor"
                >
                    <i className="fas fa-plus text-base"></i>
                    <span className="hidden sm:inline text-sm">Novo Fornecedor</span>
                </button>
            </div>

            {/* Lista */}
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(f => (
                        <FornecedorCard
                            key={f.id}
                            f={f}
                            onEdit={openEdit}
                            onDelete={id => setDeleteId(id)}
                        />
                    ))}
                </div>
            ) : search ? (
                <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                        <i className="fas fa-search text-slate-400 text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Nenhum resultado</h3>
                    <p className="text-slate-500 text-sm mt-1">Tente outros termos de busca.</p>
                </div>
            ) : (
                <div className="text-center py-16 flex flex-col items-center">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-5">
                        <i className="fas fa-truck text-3xl text-emerald-500"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Nenhum Fornecedor Cadastrado</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs text-center leading-relaxed mb-6">
                        Adicione seus fornecedores para acessar contatos e WhatsApp rapidamente.
                    </p>
                    <button
                        onClick={openAdd}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Fornecedor
                    </button>
                </div>
            )}

            {/* Modal Add/Edit */}
            {modalOpen && (
                <FornecedorModal
                    editing={editing}
                    onSave={handleSave}
                    onClose={() => { setModalOpen(false); setEditing(null); }}
                />
            )}

            {/* Confirm Delete */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700">
                        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                            <i className="fas fa-trash-alt text-red-500 text-lg"></i>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1">Excluir Fornecedor?</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FornecedoresView;
