import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Fornecedor } from '../../types';
import ConfirmationModal from '../modals/ConfirmationModal';
import ContentState from '../ui/ContentState';
import Modal from '../ui/Modal';
import PageCollectionToolbar from '../ui/PageCollectionToolbar';
import {
    createFornecedor,
    deleteFornecedor,
    getFornecedores,
    migrateFromLocalStorage,
    saveFornecedor
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

function whatsappPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
}

function whatsappBusinessUrl(phone: string): string {
    const num = whatsappPhone(phone);
    if (/Android/i.test(window.navigator.userAgent)) {
        return `intent://send?phone=${num}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
    }

    return `https://wa.me/${num}`;
}

const FornecedorCard: React.FC<{
    fornecedor: Fornecedor;
    onEdit: (fornecedor: Fornecedor) => void;
    onDelete: (id: string) => void;
    onWhatsAppClick: (fornecedor: Fornecedor) => void;
    index: number;
}> = ({ fornecedor, onEdit, onDelete, onWhatsAppClick, index }) => {
    const [copied, setCopied] = useState(false);
    const initials = fornecedor.empresa.slice(0, 2).toUpperCase();

    const handleCopyAddress = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!fornecedor.endereco) return;

        navigator.clipboard.writeText(fornecedor.endereco);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenMaps = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!fornecedor.endereco) return;

        window.open(
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fornecedor.endereco)}`,
            '_blank'
        );
    };

    return (
        <div
            className="group relative bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
            style={{ animationDelay: `${index * 0.08}s` }}
        >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />

            <div className="p-4">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md shadow-emerald-900/20">
                        {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase truncate leading-tight">
                            {fornecedor.empresa}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {fornecedor.contato}
                        </p>

                        {fornecedor.representacoes && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {fornecedor.representacoes
                                    .split(',')
                                    .map(item => item.trim())
                                    .filter(Boolean)
                                    .slice(0, 3)
                                    .map(item => (
                                        <span
                                            key={item}
                                            className="inline-flex items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase"
                                        >
                                            {item}
                                        </span>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 p-3 mb-4 min-h-[92px] flex flex-col justify-center">
                    {fornecedor.endereco ? (
                        <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <i className="fas fa-map-marker-alt text-[10px] text-emerald-500"></i>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Endereço
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug line-clamp-2" title={fornecedor.endereco}>
                                    {fornecedor.endereco}
                                </p>
                            </div>

                            <div className="flex flex-col gap-1.5 shrink-0">
                                <button
                                    onClick={handleOpenMaps}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                                    title="Abrir no Maps"
                                >
                                    <i className="fas fa-external-link-alt text-[10px]"></i>
                                </button>
                                <button
                                    onClick={handleCopyAddress}
                                    className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${
                                        copied
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-500 hover:text-white'
                                    }`}
                                    title={copied ? 'Copiado!' : 'Copiar endereço'}
                                >
                                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <i className="fas fa-map-marker-alt text-slate-300 dark:text-slate-600 text-xl mb-2"></i>
                            <p className="text-sm text-slate-400 dark:text-slate-500">Endereço não informado</p>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        {fornecedor.email && (
                            <a
                                href={`mailto:${fornecedor.email}`}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title={fornecedor.email}
                            >
                                <i className="fas fa-envelope text-[10px]"></i>
                                <span className="truncate max-w-[120px]">{fornecedor.email}</span>
                            </a>
                        )}

                        {fornecedor.observacao && (
                            <span
                                className="text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-[120px]"
                                title={fornecedor.observacao}
                            >
                                {fornecedor.observacao}
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onWhatsAppClick(fornecedor)}
                        className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-emerald-900/20"
                    >
                        <i className="fab fa-whatsapp text-sm"></i>
                        {formatPhone(fornecedor.telefone)}
                    </button>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => onEdit(fornecedor)}
                            className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all text-xs font-semibold"
                            title="Editar"
                        >
                            <i className="fas fa-pen text-[10px]"></i>
                            Editar
                        </button>
                        <button
                            onClick={() => onDelete(fornecedor.id)}
                            className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-all"
                            title="Excluir"
                        >
                            <i className="fas fa-trash-alt text-[11px]"></i>
                        </button>
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Fornecedor
                    </span>
                </div>
            </div>
        </div>
    );
};

const FornecedorListItem: React.FC<{
    fornecedor: Fornecedor;
    onEdit: (fornecedor: Fornecedor) => void;
    onDelete: (id: string) => void;
    onWhatsAppClick: (fornecedor: Fornecedor) => void;
}> = ({ fornecedor, onEdit, onDelete, onWhatsAppClick }) => {
    const initials = fornecedor.empresa.slice(0, 2).toUpperCase();
    const tags = fornecedor.representacoes
        ?.split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 3) || [];
    const hasAddress = Boolean(fornecedor.endereco);
    const hasEmail = Boolean(fornecedor.email);
    const [showActions, setShowActions] = useState(false);

    return (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/90 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="grid min-w-0 flex-1 grid-cols-[48px_minmax(0,1fr)_40px] items-start gap-x-3 gap-y-2 sm:flex sm:items-start sm:gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-blue-900/20">
                        {initials}
                    </div>

                    <div className="col-start-2 min-w-0 sm:flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 sm:text-lg">
                                {fornecedor.empresa}
                            </h3>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {tags.map(item => (
                                        <span
                                            key={item}
                                            className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                            <span className="truncate">{fornecedor.contato}</span>
                            {fornecedor.email && (
                                <a
                                    href={`mailto:${fornecedor.email}`}
                                    className="hidden truncate hover:text-blue-600 dark:hover:text-blue-400 sm:inline"
                                >
                                    {fornecedor.email}
                                </a>
                            )}
                        </div>

                        {fornecedor.endereco && (
                            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                                {fornecedor.endereco}
                            </p>
                        )}
                    </div>

                    <div className="relative col-start-3 row-span-2 flex shrink-0 flex-col items-center gap-2 sm:hidden">
                        <button
                            type="button"
                            onClick={() => setShowActions(previous => !previous)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                            title="Mais ações"
                        >
                            <i className="fas fa-ellipsis-v text-[11px]"></i>
                        </button>

                        <button
                            type="button"
                            onClick={() => onWhatsAppClick(fornecedor)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-900/20 transition-colors hover:bg-emerald-600"
                            title={`Falar com ${fornecedor.empresa} no WhatsApp`}
                        >
                            <i className="fab fa-whatsapp text-base"></i>
                        </button>

                        {showActions && (
                            <div className="absolute right-0 top-10 z-10 mt-2 flex min-w-[160px] flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                {fornecedor.endereco && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fornecedor.endereco)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                                        onClick={() => setShowActions(false)}
                                    >
                                        <i className="fas fa-map-marker-alt text-[11px]"></i>
                                        Abrir no Maps
                                    </a>
                                )}
                                {fornecedor.email && (
                                    <a
                                        href={`mailto:${fornecedor.email}`}
                                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                                        onClick={() => setShowActions(false)}
                                    >
                                        <i className="fas fa-envelope text-[11px]"></i>
                                        Enviar e-mail
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowActions(false);
                                        onEdit(fornecedor);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                                >
                                    <i className="fas fa-pen text-[11px]"></i>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowActions(false);
                                        onDelete(fornecedor.id);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                    <i className="fas fa-trash-alt text-[11px]"></i>
                                    Excluir
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700/60 sm:flex xl:min-w-[280px] xl:justify-end xl:border-t-0 xl:pt-0">
                    <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-400 dark:text-slate-500 sm:flex">
                        {hasAddress && (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                                <i className="fas fa-map-marker-alt text-[11px]"></i>
                            </span>
                        )}
                        {hasEmail && (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                                <i className="fas fa-envelope text-[11px]"></i>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onWhatsAppClick(fornecedor)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-900/20 transition-colors hover:bg-emerald-600 sm:h-9 sm:w-auto sm:px-3 sm:gap-2"
                            title={`Falar com ${fornecedor.empresa} no WhatsApp`}
                        >
                            <i className="fab fa-whatsapp text-base sm:text-sm"></i>
                            <span className="hidden text-sm font-bold sm:inline">{formatPhone(fornecedor.telefone)}</span>
                        </button>

                        {fornecedor.endereco && (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fornecedor.endereco)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-blue-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-blue-600 sm:inline-flex sm:h-9 sm:w-9 sm:rounded-lg"
                                title="Abrir no Maps"
                            >
                                <i className="fas fa-map-marker-alt text-[11px]"></i>
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={() => onEdit(fornecedor)}
                            className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-blue-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-blue-600 sm:inline-flex sm:h-9 sm:w-9 sm:rounded-lg"
                            title="Editar"
                        >
                            <i className="fas fa-pen text-[10px]"></i>
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(fornecedor.id)}
                            className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-red-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-600 sm:inline-flex sm:h-9 sm:w-9 sm:rounded-lg"
                            title="Excluir"
                        >
                            <i className="fas fa-trash-alt text-[11px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WhatsAppChooserModal: React.FC<{
    fornecedor: Fornecedor | null;
    onClose: () => void;
}> = ({ fornecedor, onClose }) => {
    if (!fornecedor) return null;

    const regularUrl = `whatsapp://send?phone=${whatsappPhone(fornecedor.telefone)}`;
    const businessUrl = whatsappBusinessUrl(fornecedor.telefone);

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            wrapperClassName="backdrop-blur-sm"
            title={
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <i className="fab fa-whatsapp"></i>
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-semibold text-slate-800 dark:text-white">
                            Abrir conversa
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha qual app deseja usar para falar com <strong className="text-slate-700 dark:text-slate-200">{fornecedor.empresa}</strong>.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                    <a
                        href={regularUrl}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                        <i className="fab fa-whatsapp text-base"></i>
                        WhatsApp
                    </a>

                    <a
                        href={businessUrl}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                        <i className="fas fa-briefcase text-sm"></i>
                        WhatsApp Business
                    </a>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Cancelar
                </button>
            </div>
        </Modal>
    );
};

const FornecedorModal: React.FC<{
    editing: Fornecedor | null;
    onSave: (data: Fornecedor) => Promise<void>;
    onClose: () => void;
}> = ({ editing, onSave, onClose }) => {
    const [form, setForm] = useState<Fornecedor>(editing || createFornecedor());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm(editing || createFornecedor());
        setIsSaving(false);
        setError(null);
    }, [editing]);

    const setField = (key: keyof typeof EMPTY_FORM) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (error) setError(null);
        setForm(previous => ({ ...previous, [key]: event.target.value }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSaving) return;
        if (!form.empresa.trim() || !form.contato.trim() || !form.telefone.trim()) {
            setError('Preencha empresa, contato e telefone para continuar.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await onSave(form);
        } catch (err: any) {
            setError(err?.message || 'Não foi possível salvar o fornecedor. Tente novamente.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 sm:border overflow-hidden"
                onClick={event => event.stopPropagation()}
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
                                value={(form as Record<string, string>)[key] || ''}
                                onChange={setField(key as keyof typeof EMPTY_FORM)}
                                placeholder={placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    ))}

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Observação</label>
                        <textarea
                            value={form.observacao || ''}
                            onChange={setField('observacao')}
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
                            {editing && !editing.id?.startsWith('temp-') ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FornecedorStyledModal: React.FC<{
    editing: Fornecedor | null;
    onSave: (data: Fornecedor) => Promise<void>;
    onClose: () => void;
}> = ({ editing, onSave, onClose }) => {
    const [form, setForm] = useState<Fornecedor>(editing || createFornecedor());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm(editing || createFornecedor());
        setIsSaving(false);
        setError(null);
    }, [editing]);

    const setField = (key: keyof typeof EMPTY_FORM) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (error) setError(null);
        setForm(previous => ({ ...previous, [key]: event.target.value }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSaving) return;

        if (!form.empresa.trim() || !form.contato.trim() || !form.telefone.trim()) {
            setError('Preencha empresa, contato e telefone para continuar.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await onSave(form);
        } catch (err: any) {
            setError(err?.message || 'Não foi possível salvar o fornecedor. Tente novamente.');
            setIsSaving(false);
        }
    };

    const footer = (
        <>
            <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="fornecedorStyledForm"
                disabled={isSaving}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-70 disabled:cursor-wait flex items-center gap-2"
            >
                {isSaving ? (
                    <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Salvando...</span>
                    </>
                ) : (
                    <span>{editing && !editing.id?.startsWith('temp-') ? 'Salvar Alterações' : 'Adicionar Fornecedor'}</span>
                )}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            disableClose={isSaving}
            wrapperClassName="backdrop-blur-sm"
            title={
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <i className="fas fa-truck-loading"></i>
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-semibold text-slate-800 dark:text-white">
                            {editing && !editing.id?.startsWith('temp-') ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                        </div>
                    </div>
                </div>
            }
            footer={footer}
        >
            <form id="fornecedorStyledForm" onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Empresa *
                        </label>
                        <input type="text" value={form.empresa || ''} onChange={setField('empresa')} placeholder="Nome da empresa" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Contato *
                        </label>
                        <input type="text" value={form.contato || ''} onChange={setField('contato')} placeholder="Ex: João Silva" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Telefone / WhatsApp *
                        </label>
                        <input type="tel" value={form.telefone || ''} onChange={setField('telefone')} placeholder="(11) 99999-9999" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100" />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Marcas / Representações
                        </label>
                        <input type="text" value={form.representacoes || ''} onChange={setField('representacoes')} placeholder="Ex: 3M, SunTek, Llumar" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            E-mail
                        </label>
                        <input type="email" value={form.email || ''} onChange={setField('email')} placeholder="contato@empresa.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Endereço
                        </label>
                        <input type="text" value={form.endereco || ''} onChange={setField('endereco')} placeholder="Rua, número, bairro, cidade" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100" />
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Observação
                    </label>
                    <textarea
                        value={form.observacao || ''}
                        onChange={setField('observacao')}
                        placeholder="Informações adicionais sobre atendimento, prazo, marcas ou condições."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                    />
                </div>
            </form>
        </Modal>
    );
};

const FornecedoresToolbar: React.FC<{
    search: string;
    viewType: 'grid' | 'list';
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onCreate: () => void;
    onChangeView: (view: 'grid' | 'list') => void;
}> = ({ search, viewType, onSearchChange, onClearSearch, onCreate, onChangeView }) => {
    return (
        <PageCollectionToolbar
            search={search}
            onSearchChange={onSearchChange}
            onClearSearch={onClearSearch}
            searchPlaceholder="Buscar por empresa, contato ou marca..."
            primaryActionLabel="Novo Fornecedor"
            onPrimaryAction={onCreate}
            viewMode={viewType}
            onViewModeChange={onChangeView}
        />
    );
};

const FornecedoresView: React.FC = () => {
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedF, setSelectedF] = useState<Fornecedor | null>(null);
    const [fornecedorToDelete, setFornecedorToDelete] = useState<Fornecedor | null>(null);
    const [fornecedorForWhatsApp, setFornecedorForWhatsApp] = useState<Fornecedor | null>(null);
    const [isDeletingFornecedor, setIsDeletingFornecedor] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            await migrateFromLocalStorage();
            const data = await getFornecedores();
            setFornecedores(data);
        } catch (error) {
            console.error('Erro ao carregar fornecedores:', error);
            setLoadError('Não foi possível carregar os fornecedores agora.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filtered = useMemo(() => {
        return fornecedores.filter(fornecedor =>
            fornecedor.empresa.toLowerCase().includes(search.toLowerCase()) ||
            fornecedor.contato.toLowerCase().includes(search.toLowerCase()) ||
            fornecedor.representacoes?.toLowerCase().includes(search.toLowerCase())
        );
    }, [fornecedores, search]);

    const handleSave = async (fornecedor: Fornecedor) => {
        try {
            const saved = await saveFornecedor(fornecedor);
            if (fornecedor.id && !fornecedor.id.startsWith('temp-')) {
                setFornecedores(previous => previous.map(item => item.id === saved.id ? saved : item));
            } else {
                setFornecedores(previous => [saved, ...previous]);
            }
            setShowModal(false);
            setSelectedF(null);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            throw error;
        }
    };

    const handleRequestDelete = useCallback((id: string) => {
        const fornecedor = fornecedores.find(item => item.id === id) || null;
        setFornecedorToDelete(fornecedor);
    }, [fornecedores]);

    const handleConfirmDelete = useCallback(async () => {
        if (!fornecedorToDelete) return;

        try {
            setIsDeletingFornecedor(true);
            await new Promise<void>(resolve => {
                window.requestAnimationFrame(() => resolve());
            });

            await deleteFornecedor(fornecedorToDelete.id);
            setFornecedores(previous => previous.filter(item => item.id !== fornecedorToDelete.id));
            setFornecedorToDelete(null);
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Não foi possível excluir o fornecedor. Tente novamente.');
        } finally {
            setIsDeletingFornecedor(false);
        }
    }, [fornecedorToDelete]);

    return (
        <div className="space-y-6">
            <FornecedoresToolbar
                search={search}
                viewType={viewType}
                onSearchChange={setSearch}
                onClearSearch={() => setSearch('')}
                onCreate={() => {
                    setSelectedF(null);
                    setShowModal(true);
                }}
                onChangeView={setViewType}
            />

            {loading ? (
                <ContentState
                    iconClassName="fas fa-spinner fa-spin"
                    title="Carregando fornecedores"
                    description="Buscando seus contatos e fabricantes cadastrados."
                />
            ) : loadError ? (
                <ContentState
                    iconClassName="fas fa-exclamation-triangle"
                    title="Erro ao carregar fornecedores"
                    description={loadError}
                    actionLabel="Tentar novamente"
                    actionIconClassName="fas fa-rotate-right"
                    onAction={loadData}
                />
            ) : filtered.length > 0 ? (
                viewType === 'grid' ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((fornecedor, index) => (
                            <FornecedorCard
                                key={fornecedor.id}
                                fornecedor={fornecedor}
                                index={index}
                                onEdit={(item) => {
                                    setSelectedF(item);
                                    setShowModal(true);
                                }}
                                onDelete={handleRequestDelete}
                                onWhatsAppClick={setFornecedorForWhatsApp}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(fornecedor => (
                            <FornecedorListItem
                                key={fornecedor.id}
                                fornecedor={fornecedor}
                                onEdit={(item) => {
                                    setSelectedF(item);
                                    setShowModal(true);
                                }}
                                onDelete={handleRequestDelete}
                                onWhatsAppClick={setFornecedorForWhatsApp}
                            />
                        ))}
                    </div>
                )
            ) : search.trim() ? (
                <ContentState
                    compact
                    iconClassName="fas fa-search"
                    title="Nenhum fornecedor encontrado"
                    description="Tente buscar por outro nome, contato ou marca."
                />
            ) : (
                <>
                <ContentState
                    iconClassName="fas fa-truck-loading"
                    title="Nenhum fornecedor cadastrado"
                    description="Adicione fabricantes, distribuidores e representantes para manter sua operação organizada."
                    actionLabel="Adicionar Fornecedor"
                    actionIconClassName="fas fa-plus"
                    onAction={() => {
                        setSelectedF(null);
                        setShowModal(true);
                    }}
                />
                </>
            )}

            {showModal && (
                <FornecedorStyledModal
                    editing={selectedF}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedF(null);
                    }}
                />
            )}

            <WhatsAppChooserModal
                fornecedor={fornecedorForWhatsApp}
                onClose={() => setFornecedorForWhatsApp(null)}
            />

            <ConfirmationModal
                isOpen={!!fornecedorToDelete}
                onClose={() => {
                    if (isDeletingFornecedor) return;
                    setFornecedorToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão de Fornecedor"
                message={
                    <>
                        Tem certeza que deseja excluir o fornecedor <strong>"{fornecedorToDelete?.empresa || ''}"</strong>?
                        <br />
                        Esta ação não pode ser desfeita.
                    </>
                }
                confirmButtonText="Sim, Excluir"
                confirmButtonVariant="danger"
                isProcessing={isDeletingFornecedor}
                processingText="Excluindo..."
            />
        </div>
    );
};

export default FornecedoresView;

