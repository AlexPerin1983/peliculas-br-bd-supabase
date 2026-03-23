import React, { useState, useMemo, useCallback } from 'react';
import { Fornecedor } from '../../types';
import {
    getFornecedores,
    saveFornecedor,
    deleteFornecedor,
    createFornecedor,
    migrateFromLocalStorage
} from '../../services/fornecedorService';

const EMPTY_FORM = {
    empresa: '',
    contato: '',
    telefone: '',
    representacoes: '',
    email: '',
    endereco: '',
    observacao: '',
};

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
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
    const [copied, setCopied] = useState(false);
    const initials = f.empresa.slice(0, 2).toUpperCase();

    const handleCopyAddress = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (f.endereco) {
            navigator.clipboard.writeText(f.endereco);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const openMaps = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (f.endereco) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.endereco)}`, '_blank');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="p-4">
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

                {f.endereco && (
                    <div className="mb-3 flex items-center gap-2 group">
                        <div className="flex-grow min-w-0 bg-slate-50 dark:bg-slate-700/40 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-2 mb-0.5">
                                <i className="fas fa-map-marker-alt text-[10px] text-emerald-500"></i>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Endereço</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate" title={f.endereco}>
                                {f.endereco}
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={openMaps}
                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                                title="Abrir no Maps"
                            >
                                <i className="fas fa-external-link-alt text-[10px]"></i>
                            </button>
                            <button
                                onClick={handleCopyAddress}
                                className={`h-7 w-7 flex items-center justify-center rounded-lg transition-all ${copied
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-500 hover:text-white'
                                    }`}
                                title={copied ? "Copiado!" : "Copiar endereço"}
                            >
                                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
                            </button>
                        </div>
                    </div>
                )}

                {f.representacoes && (
                    <div className="mb-3 flex flex-wrap gap-1">
                        {f.representacoes.split(',').map(r => r.trim()).filter(Boolean).map(r => (
                            <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
                                {r}
                            </span>
                        ))}
                    </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {f.email && (
                            <a
                                href={`mailto:${f.email}`}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title={f.email}
                            >
                                <i className="fas fa-envelope text-[10px]"></i>
                                <span className="truncate max-w-[100px]">{f.email}</span>
                            </a>
                        )}
                        {f.observacao && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-[100px]" title={f.observacao}>
                                {f.observacao}
                            </span>
                        )}
                    </div>
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
    onSave: (data: Fornecedor) => void;
    onClose: () => void;
}> = ({ editing, onSave, onClose }) => {
    const [form, setForm] = useState<Fornecedor>(
        editing || createFornecedor()
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
            <div
                className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 sm:border overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                        {editing && !editing.id?.startsWith('temp-') ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto max-h-[75vh] sm:max-h-none">
                    {[
                        { key: 'empresa', label: 'Empresa *', placeholder: 'Nome da empresa', type: 'text' },
                        { key: 'contato', label: 'Nome do Contato *', placeholder: 'Ex: João Silva', type: 'text' },
                        { key: 'telefone', label: 'Telefone / WhatsApp *', placeholder: '(11) 99999-9999', type: 'tel' },
                        { key: 'representacoes', label: 'Marcas / Representações', placeholder: 'Ex: 3M, SunTek, Llumar', type: 'text' },
                        { key: 'email', label: 'E-mail', placeholder: 'contato@empresa.com', type: 'email' },
                        { key: 'endereco', label: 'Endereço', placeholder: 'Rua, Número, Bairro, Cidade', type: 'text' },
                    ].map(({ key, label, placeholder, type }) => (
                        <div key={key}>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</label>
                            <input
                                type={type}
                                value={(form as any)[key]}
                                onChange={set(key as any)}
                                placeholder={placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Observação</label>
                        <textarea
                            value={form.observacao || ''}
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
                            {(editing && !editing.id?.startsWith('temp-')) ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FornecedoresView: React.FC = () => {
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<'grid' | 'table'>('grid');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedF, setSelectedF] = useState<Fornecedor | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await migrateFromLocalStorage();
            const data = await getFornecedores();
            setFornecedores(data);
        } catch (error) {
            console.error('Erro ao carregar fornecedores:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const filtered = useMemo(() => {
        return fornecedores.filter(f =>
            f.empresa.toLowerCase().includes(search.toLowerCase()) ||
            f.contato.toLowerCase().includes(search.toLowerCase()) ||
            f.representacoes?.toLowerCase().includes(search.toLowerCase())
        );
    }, [fornecedores, search]);

    const handleSave = async (f: Fornecedor) => {
        try {
            const saved = await saveFornecedor(f);
            if (f.id && !f.id.startsWith('temp-')) {
                setFornecedores(prev => prev.map(item => item.id === saved.id ? saved : item));
            } else {
                setFornecedores(prev => [saved, ...prev]);
            }
            setShowModal(false);
            setSelectedF(null);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar fornecedor no servidor.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este fornecedor?')) return;
        try {
            await deleteFornecedor(id);
            setFornecedores(prev => prev.filter(f => f.id !== id));
        } catch (error) {
            console.error('Erro ao excluir:', error);
        }
    };

    return (
        <div className="view-container">
            <header className="view-header">
                <div className="header-left">
                    <div className="header-icon-box">
                        <i className="fas fa-truck"></i>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Fornecedores</h1>
                        <p className="text-slate-500 dark:text-slate-400">Gerencie seus contatos e fabricantes de películas</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-primary flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                        onClick={() => {
                            setSelectedF(null);
                            setShowModal(true);
                        }}
                    >
                        <i className="fas fa-plus"></i> Novo Fornecedor
                    </button>
                </div>
            </header>

            <div className="filter-bar flex gap-4 my-6">
                <div className="search-box relative flex-grow">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                        type="text"
                        placeholder="Buscar por empresa, contato ou marca..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                </div>
                <div className="view-toggle flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        className={`p-2 rounded-md ${viewType === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400'}`}
                        onClick={() => setViewType('grid')}
                    >
                        <i className="fas fa-th-large"></i>
                    </button>
                    <button
                        className={`p-2 rounded-md ${viewType === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400'}`}
                        onClick={() => setViewType('table')}
                    >
                        <i className="fas fa-list"></i>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
                    <p className="text-slate-500">Carregando fornecedores...</p>
                </div>
            ) : filtered.length > 0 ? (
                <div className={`grid gap-6 ${viewType === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {filtered.map(f => (
                        <FornecedorCard
                            key={f.id}
                            f={f}
                            onEdit={(item) => {
                                setSelectedF(item);
                                setShowModal(true);
                            }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-truck-loading text-3xl text-slate-300"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Nenhum fornecedor encontrado</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">Comece cadastrando seu primeiro contato.</p>
                </div>
            )}

            {showModal && (
                <FornecedorModal
                    editing={selectedF}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setSelectedF(null); }}
                />
            )}
        </div>
    );
};

export default FornecedoresView;
