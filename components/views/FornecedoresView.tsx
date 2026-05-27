import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Fornecedor } from '../../types';
import ConfirmationModal from '../modals/ConfirmationModal';
import ContentState from '../ui/ContentState';
import Modal from '../ui/Modal';
import {
    createFornecedor,
    deleteFornecedor,
    getFornecedores,
    migrateFromLocalStorage,
    saveFornecedor
} from '../../services/fornecedorService';
import { useFeedback } from '../../src/contexts/FeedbackContext';

const EMPTY_FORM = {
    empresa: '',
    contato: '',
    telefone: '',
    representacoes: '',
    email: '',
    endereco: '',
    observacao: '',
};

type FornecedorViewMode = 'grid' | 'list';

const FORNECEDOR_VIEW_MODE_STORAGE_KEY = 'fornecedores-view-mode';

function getFornecedorTags(fornecedor: Fornecedor): string[] {
    return fornecedor.representacoes
        ?.split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 3) || [];
}

function getFornecedorCollapsedSummary(fornecedor: Fornecedor, tags = getFornecedorTags(fornecedor)): string {
    const primaryTag = tags[0] ? `${tags[0]}${tags.length > 1 ? ` +${tags.length - 1}` : ''}` : null;

    return [
        fornecedor.contato || null,
        primaryTag,
        fornecedor.endereco ? 'Endereço salvo' : null,
    ]
        .filter(Boolean)
        .join(' / ');
}

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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

const FornecedorViewModeToggle: React.FC<{
    value: FornecedorViewMode;
    onChange: (value: FornecedorViewMode) => void;
}> = ({ value, onChange }) => {
    return (
        <div className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1 shadow-[var(--shadow-hairline)]">
            <button
                type="button"
                onClick={() => onChange('grid')}
                className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-[12px] transition-all ${
                    value === 'grid'
                        ? 'bg-[var(--surface)] text-[var(--brand-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                }`}
                title="Visualização em grade"
                aria-label="Visualização em grade"
            >
                <i className="fas fa-th-large text-[10px]" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                onClick={() => onChange('list')}
                className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-[12px] transition-all ${
                    value === 'list'
                        ? 'bg-[var(--surface)] text-[var(--brand-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                }`}
                title="Visualização em lista"
                aria-label="Visualização em lista"
            >
                <i className="fas fa-list text-[10px]" aria-hidden="true"></i>
            </button>
        </div>
    );
};

const FornecedorCard: React.FC<{
    fornecedor: Fornecedor;
    onEdit: (fornecedor: Fornecedor) => void;
    onDelete: (id: string) => void;
    onWhatsAppClick: (fornecedor: Fornecedor) => void;
    index: number;
}> = ({ fornecedor, onEdit, onDelete, onWhatsAppClick, index }) => {
    const [copied, setCopied] = useState(false);
    const initials = fornecedor.empresa.slice(0, 2).toUpperCase();
    const tags = getFornecedorTags(fornecedor);
    const hasAddress = Boolean(fornecedor.endereco);

    const handleCopyAddress = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!fornecedor.endereco) return;

        navigator.clipboard.writeText(fornecedor.endereco);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
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
        <article
            className="group animate-stagger relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            style={{ animationDelay: `${index * 0.08}s` }}
        >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />

            <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-emerald-100 bg-emerald-50 text-sm font-semibold text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                            {initials}
                        </div>

                        <div className="min-w-0">
                            <h3 className="truncate text-[1.08rem] font-semibold leading-tight tracking-[-0.03em] text-slate-900 dark:text-slate-50 sm:text-[1.15rem]">
                                {fornecedor.empresa}
                            </h3>
                            <p className="mt-1 truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                {fornecedor.contato}
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0 pl-2 text-right">
                        <p className="text-[0.95rem] font-semibold leading-none tracking-[-0.03em] text-slate-950 dark:text-slate-50 sm:text-[1.02rem]">
                            {formatPhone(fornecedor.telefone)}
                        </p>
                        <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            whatsapp
                        </p>
                    </div>
                </div>

                {tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {tags.map(item => (
                            <span
                                key={item}
                                className="inline-flex items-center rounded-full bg-emerald-50/90 px-2 py-1 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                ) : null}

                <div className="mt-4 rounded-[18px] border border-slate-100 bg-slate-50/92 p-3 dark:border-slate-800/60 dark:bg-slate-900/45">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                Endereço
                            </span>
                            <p
                                className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
                                title={fornecedor.endereco || 'Endereço não informado'}
                            >
                                {fornecedor.endereco || 'Endereço não informado.'}
                            </p>
                        </div>

                        {hasAddress ? (
                            <div className="flex shrink-0 gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleOpenMaps}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] border border-slate-200 bg-white text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
                                    title="Abrir no Maps"
                                >
                                    <i className="fas fa-location-arrow text-[10px]" aria-hidden="true"></i>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyAddress}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-[11px] border transition-all ${
                                        copied
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:text-emerald-300'
                                    }`}
                                    title={copied ? 'Endereço copiado' : 'Copiar endereço'}
                                >
                                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[10px]`} aria-hidden="true"></i>
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] sm:text-[13px]">
                        <div>
                            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Contato
                            </span>
                            <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                                {fornecedor.contato}
                            </p>
                        </div>

                        <div>
                            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                E-mail
                            </span>
                            <p className="mt-1 truncate font-medium text-slate-700 dark:text-slate-200">
                                {fornecedor.email || 'Não informado'}
                            </p>
                        </div>

                        {fornecedor.observacao ? (
                            <div className="col-span-2">
                                <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    Observação
                                </span>
                                <p className="mt-1 line-clamp-2 font-medium text-slate-600 dark:text-slate-300">
                                    {fornecedor.observacao}
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5 dark:border-slate-700/60">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => onEdit(fornecedor)}
                            className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-slate-100 px-3.5 text-[11px] font-medium text-slate-600 transition-all hover:bg-slate-900 hover:text-white dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900"
                            title="Editar"
                        >
                            <i className="fas fa-pen text-[9px]" aria-hidden="true"></i>
                            Editar
                        </button>

                        <button
                            type="button"
                            onClick={() => onDelete(fornecedor.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-100 text-slate-500 transition-all hover:bg-red-600 hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-600"
                            title="Excluir"
                        >
                            <i className="fas fa-trash-alt text-[10px]" aria-hidden="true"></i>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => onWhatsAppClick(fornecedor)}
                        className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-emerald-500 px-3.5 text-[11px] font-semibold text-white shadow-[0_10px_18px_rgba(16,185,129,0.22)] transition-all hover:bg-emerald-600"
                    >
                        <i className="fab fa-whatsapp text-[12px]" aria-hidden="true"></i>
                        WhatsApp
                    </button>
                </div>
            </div>
        </article>
    );
};

const FornecedorListItem: React.FC<{
    fornecedor: Fornecedor;
    onEdit: (fornecedor: Fornecedor) => void;
    onDelete: (id: string) => void;
    onWhatsAppClick: (fornecedor: Fornecedor) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    index: number;
}> = ({ fornecedor, onEdit, onDelete, onWhatsAppClick, isExpanded, onToggleExpand, index }) => {
    const initials = fornecedor.empresa.slice(0, 2).toUpperCase();
    const tags = getFornecedorTags(fornecedor);
    const collapsedSummary = getFornecedorCollapsedSummary(fornecedor, tags);

    return (
        <article
            className="group animate-stagger relative bg-transparent transition-all duration-300"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/20 sm:px-5 sm:py-3.5"
            >
                <div className="flex items-start gap-3">
                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-slate-200/70 bg-slate-50 text-sm font-semibold text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-300 sm:flex sm:h-12 sm:w-12 sm:rounded-[13px]">
                        {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                            <span className="mt-[0.38rem] h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                            <h3 className="text-[0.92rem] font-medium leading-[1.2] tracking-[-0.02em] text-slate-900 dark:text-slate-50 sm:truncate sm:text-[1.04rem]">
                                {fornecedor.empresa}
                            </h3>
                        </div>

                        <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="sm:hidden">{fornecedor.contato}</span>
                            <span className="hidden sm:inline">{collapsedSummary || 'Toque para ver os detalhes do fornecedor'}</span>
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3 pr-1 sm:hidden">
                            <p className="text-[0.98rem] font-semibold leading-none tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatPhone(fornecedor.telefone)}
                            </p>
                            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                whatsapp
                            </p>
                        </div>
                    </div>

                    <div className="hidden shrink-0 pl-2 text-right sm:block">
                        <p className="text-[1.02rem] font-semibold leading-none tracking-[-0.03em] text-slate-950 dark:text-slate-50 sm:text-[1.08rem]">
                            {formatPhone(fornecedor.telefone)}
                        </p>
                        <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            whatsapp
                        </p>
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100/80 text-slate-400 dark:bg-slate-700/70 dark:text-slate-300">
                        <i
                            className={`fas fa-chevron-right text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                        ></i>
                    </div>
                </div>
            </button>

            <div
                className={`overflow-hidden transition-all duration-300 ${
                    isExpanded ? 'max-h-[560px] opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="border-t border-slate-100/80 bg-slate-50/60 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/20 sm:px-5">
                    <div className="space-y-3">
                        {tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map(item => (
                                    <span
                                        key={item}
                                        className="inline-flex items-center rounded-full bg-emerald-50/90 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3 text-[12px] sm:text-[13px]">
                            <div>
                                <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">
                                    Contato
                                </span>
                                <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                                    {fornecedor.contato}
                                </p>
                            </div>

                            <div>
                                <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">
                                    Telefone
                                </span>
                                <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                                    {formatPhone(fornecedor.telefone)}
                                </p>
                            </div>

                            {fornecedor.email ? (
                                <div>
                                    <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">
                                        E-mail
                                    </span>
                                    <p className="mt-1 truncate font-medium text-slate-700 dark:text-slate-200">
                                        {fornecedor.email}
                                    </p>
                                </div>
                            ) : null}

                            {fornecedor.endereco ? (
                                <div className={fornecedor.email ? '' : 'col-span-2'}>
                                    <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">
                                        Endereço
                                    </span>
                                    <p className="mt-1 line-clamp-2 font-medium text-slate-600 dark:text-slate-300">
                                        {fornecedor.endereco}
                                    </p>
                                </div>
                            ) : null}

                            {fornecedor.observacao ? (
                                <div className="col-span-2">
                                    <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">
                                        Observação
                                    </span>
                                    <p className="mt-1 line-clamp-2 font-medium text-slate-600 dark:text-slate-300">
                                        {fornecedor.observacao}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/80 pt-3 dark:border-slate-700/60">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onWhatsAppClick(fornecedor)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-emerald-500 px-3 text-[11px] font-medium text-white shadow-[0_10px_18px_rgba(16,185,129,0.22)] transition-all hover:bg-emerald-600"
                                >
                                    <i className="fab fa-whatsapp text-[11px]" aria-hidden="true"></i>
                                    WhatsApp
                                </button>

                                {fornecedor.endereco ? (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fornecedor.endereco)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-emerald-300"
                                    >
                                        <i className="fas fa-location-arrow text-[10px]" aria-hidden="true"></i>
                                        Maps
                                    </a>
                                ) : null}

                                {fornecedor.email ? (
                                    <a
                                        href={`mailto:${fornecedor.email}`}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-emerald-300"
                                    >
                                        <i className="fas fa-envelope text-[10px]" aria-hidden="true"></i>
                                        E-mail
                                    </a>
                                ) : null}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onEdit(fornecedor)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-900 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900"
                                    title="Editar"
                                >
                                    <i className="fas fa-pen text-[9px]" aria-hidden="true"></i>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(fornecedor.id)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-slate-500 shadow-sm transition-all hover:bg-red-600 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-600"
                                    title="Excluir"
                                >
                                    <i className="fas fa-trash-alt text-[10px]" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
};

interface FornecedoresMobileToolbarProps {
    totalFornecedores: number;
    filteredCount: number;
    searchTerm: string;
    isSearchActive: boolean;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onActivateSearch: () => void;
    onCloseSearch: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onCreate: () => void;
}

const FornecedoresMobileToolbar: React.FC<FornecedoresMobileToolbarProps> = ({
    totalFornecedores,
    filteredCount,
    searchTerm,
    isSearchActive,
    searchInputRef,
    onActivateSearch,
    onCloseSearch,
    onSearchChange,
    onClearSearch,
    onCreate,
}) => {
    if (isSearchActive) {
        return (
            <section className="sm:hidden">
                <div className="rounded-[18px] border border-slate-200/80 bg-white/96 p-2 shadow-[0_8px_18px_rgba(15,23,42,0.05)] dark:border-slate-700/70 dark:bg-slate-900/95">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCloseSearch}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            aria-label="Fechar busca"
                        >
                            <i className="fas fa-arrow-left text-[13px]" aria-hidden="true"></i>
                        </button>

                        <label className="relative flex-1">
                            <i
                                className="fas fa-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-slate-500"
                                aria-hidden="true"
                            ></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Buscar fornecedor..."
                                className="h-10 w-full rounded-[14px] border border-slate-200 bg-slate-50/90 pl-9 pr-9 text-[13px] font-medium text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
                            />
                            {searchTerm ? (
                                <button
                                    type="button"
                                    onClick={onClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label="Limpar busca"
                                >
                                    <i className="fas fa-times-circle text-[13px]" aria-hidden="true"></i>
                                </button>
                            ) : null}
                        </label>
                    </div>

                    <div className="pl-11 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {searchTerm.trim()
                            ? `${filteredCount} resultados em foco`
                            : totalFornecedores > 0
                              ? 'Busque por empresa, contato, telefone ou marca'
                              : 'Cadastre um fornecedor para liberar a busca'}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="sm:hidden">
            <div className="rounded-[20px] border border-slate-200/80 bg-white/96 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:border-slate-700/70 dark:bg-slate-900/95">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[1.3rem] font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-50">
                                Fornecedores
                            </h2>
                            <span className="inline-flex min-h-6 items-center rounded-full bg-slate-100 px-2 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                {totalFornecedores}
                            </span>
                        </div>
                        <p className="mt-1 pr-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                            {totalFornecedores === 0
                                ? 'Monte sua rede de compras.'
                                : `${filteredCount} contatos prontos para consulta.`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onActivateSearch}
                            disabled={totalFornecedores === 0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            aria-label="Buscar fornecedor"
                        >
                            <i className="fas fa-search text-[13px]" aria-hidden="true"></i>
                        </button>

                        <button
                            type="button"
                            onClick={onCreate}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-900 text-white shadow-[0_8px_16px_rgba(15,23,42,0.12)] transition-all hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                            aria-label="Adicionar fornecedor"
                        >
                            <i className="fas fa-plus text-[13px]" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface FornecedoresDesktopHeaderProps {
    totalFornecedores: number;
    filteredCount: number;
    totalMarcas: number;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onCreate: () => void;
}

const FornecedoresDesktopHeader: React.FC<FornecedoresDesktopHeaderProps> = ({
    totalFornecedores,
    filteredCount,
    totalMarcas,
    searchTerm,
    onSearchChange,
    onClearSearch,
    onCreate,
}) => {
    const summary =
        totalFornecedores === 0
            ? 'Monte uma base confiavel de fabricantes e distribuidores com busca e consulta mais rapidas.'
            : filteredCount !== totalFornecedores
              ? `${filteredCount} de ${totalFornecedores} fornecedores em foco agora.`
              : `${totalFornecedores} fornecedores e ${totalMarcas} marcas mapeadas para consulta rapida.`;

    return (
        <section className="hidden sm:block">
            <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                <div className="mb-5 flex items-end justify-between gap-4">
                    <div className="space-y-2">
                        <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Rede
                        </span>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black tracking-[-0.03em] text-[var(--text-strong)]">
                                Fornecedores
                            </h2>
                            <span className="inline-flex min-h-8 items-center rounded-full bg-[var(--surface-muted)] px-3 text-xs font-bold text-[var(--text-muted)]">
                                {totalFornecedores}
                            </span>
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                            {summary}
                        </p>
                    </div>

                    {totalFornecedores > 0 ? (
                        <div className="hidden items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] shadow-[var(--shadow-hairline)] lg:inline-flex">
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            {filteredCount} visíveis agora
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center gap-3">
                    <label className="relative flex-1">
                        <i
                            className="fas fa-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-slate-400"
                            aria-hidden="true"
                        ></i>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Buscar por empresa, contato, telefone ou marca..."
                            className="h-12 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-11 pr-11 text-sm font-medium text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition-all placeholder:text-[var(--text-soft)] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                        {searchTerm ? (
                            <button
                                type="button"
                                onClick={onClearSearch}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-100"
                                aria-label="Limpar busca"
                            >
                                <i className="fas fa-times-circle text-[14px]" aria-hidden="true"></i>
                            </button>
                        ) : null}
                    </label>

                    <button
                        type="button"
                        onClick={onCreate}
                        className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-slate-950 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)] transition-all hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                        <i className="fas fa-plus text-[12px]" aria-hidden="true"></i>
                        Novo fornecedor
                    </button>
                </div>
            </div>
        </section>
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
                className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="fornecedorStyledForm"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:cursor-wait disabled:opacity-70"
            >
                {isSaving ? (
                    <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Salvando...</span>
                    </>
                ) : (
                    <span>{editing && !editing.id?.startsWith('temp-') ? 'Salvar alteracoes' : 'Adicionar fornecedor'}</span>
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
                            {editing && !editing.id?.startsWith('temp-') ? 'Editar fornecedor' : 'Novo fornecedor'}
                        </div>
                    </div>
                </div>
            }
            footer={footer}
        >
            <form id="fornecedorStyledForm" onSubmit={handleSubmit} className="space-y-5">
                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        {error}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Empresa *
                        </label>
                        <input
                            type="text"
                            value={form.empresa || ''}
                            onChange={setField('empresa')}
                            placeholder="Nome da empresa"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Contato *
                        </label>
                        <input
                            type="text"
                            value={form.contato || ''}
                            onChange={setField('contato')}
                            placeholder="Ex: Joao Silva"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Telefone / WhatsApp *
                        </label>
                        <input
                            type="tel"
                            value={form.telefone || ''}
                            onChange={setField('telefone')}
                            placeholder="(11) 99999-9999"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Marcas / Representacoes
                        </label>
                        <input
                            type="text"
                            value={form.representacoes || ''}
                            onChange={setField('representacoes')}
                            placeholder="Ex: 3M, SunTek, Llumar"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            E-mail
                        </label>
                        <input
                            type="email"
                            value={form.email || ''}
                            onChange={setField('email')}
                            placeholder="contato@empresa.com"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Endereço
                        </label>
                        <input
                            type="text"
                            value={form.endereco || ''}
                            onChange={setField('endereco')}
                            placeholder="Rua, numero, bairro, cidade"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Observação
                    </label>
                    <textarea
                        value={form.observacao || ''}
                        onChange={setField('observacao')}
                        placeholder="Informacoes adicionais sobre atendimento, prazo, marcas ou condicoes."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                    />
                </div>
            </form>
        </Modal>
    );
};

const FornecedoresView: React.FC = () => {
    const { showAlert } = useFeedback();
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState<FornecedorViewMode>(() => {
        if (typeof window === 'undefined') return 'list';

        try {
            return window.localStorage.getItem(FORNECEDOR_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
        } catch {
            return 'list';
        }
    });
    const [search, setSearch] = useState('');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [expandedFornecedorId, setExpandedFornecedorId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedF, setSelectedF] = useState<Fornecedor | null>(null);
    const [fornecedorToDelete, setFornecedorToDelete] = useState<Fornecedor | null>(null);
    const [fornecedorForWhatsApp, setFornecedorForWhatsApp] = useState<Fornecedor | null>(null);
    const [isDeletingFornecedor, setIsDeletingFornecedor] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const deferredSearch = useDeferredValue(search);

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

    useEffect(() => {
        if (!isSearchActive) return;

        const frame = window.requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isSearchActive]);

    useEffect(() => {
        try {
            window.localStorage.setItem(FORNECEDOR_VIEW_MODE_STORAGE_KEY, viewType);
        } catch {
            // Ignore storage failures and keep the current session state in memory.
        }
    }, [viewType]);

    const filtered = useMemo(() => {
        const lowerTerm = deferredSearch.toLowerCase().trim();
        const phoneTerm = deferredSearch.replace(/\D/g, '');

        if (!lowerTerm && !phoneTerm) return fornecedores;

        return fornecedores.filter(fornecedor => {
            const tags = getFornecedorTags(fornecedor).join(' ').toLowerCase();
            const normalizedPhone = fornecedor.telefone.replace(/\D/g, '');

            return (
                fornecedor.empresa.toLowerCase().includes(lowerTerm) ||
                fornecedor.contato.toLowerCase().includes(lowerTerm) ||
                (fornecedor.email || '').toLowerCase().includes(lowerTerm) ||
                (fornecedor.endereco || '').toLowerCase().includes(lowerTerm) ||
                tags.includes(lowerTerm) ||
                (phoneTerm ? normalizedPhone.includes(phoneTerm) : false)
            );
        });
    }, [deferredSearch, fornecedores]);

    const totalMarcas = useMemo(() => {
        const unique = new Set(
            fornecedores.flatMap(fornecedor =>
                getFornecedorTags(fornecedor).map(item => item.toLowerCase())
            )
        );

        return unique.size;
    }, [fornecedores]);

    const handleOpenCreate = () => {
        setSelectedF(null);
        setShowModal(true);
    };

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
            showAlert({
                title: 'Erro ao excluir fornecedor',
                message: 'Não foi possível excluir o fornecedor. Tente novamente.',
                tone: 'error'
            });
        } finally {
            setIsDeletingFornecedor(false);
        }
    }, [fornecedorToDelete, showAlert]);

    const handleToggleExpand = (fornecedorId: string) => {
        setExpandedFornecedorId(current => current === fornecedorId ? null : fornecedorId);
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setExpandedFornecedorId(null);
    };

    const handleClearSearch = () => {
        setSearch('');
        setExpandedFornecedorId(null);
    };

    const handleCloseSearch = () => {
        setIsSearchActive(false);
        handleClearSearch();
    };

    return (
        <div className="space-y-5 sm:space-y-6">
            <FornecedoresMobileToolbar
                totalFornecedores={fornecedores.length}
                filteredCount={filtered.length}
                searchTerm={search}
                isSearchActive={isSearchActive}
                searchInputRef={searchInputRef}
                onActivateSearch={() => setIsSearchActive(true)}
                onCloseSearch={handleCloseSearch}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
                onCreate={handleOpenCreate}
            />

            <FornecedoresDesktopHeader
                totalFornecedores={fornecedores.length}
                filteredCount={filtered.length}
                totalMarcas={totalMarcas}
                searchTerm={search}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
                onCreate={handleOpenCreate}
            />

            {fornecedores.length > 0 ? (
                <div className="flex items-start justify-between gap-3 px-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] shadow-[var(--shadow-hairline)] sm:text-xs">
                            {filtered.length} de {fornecedores.length} fornecedores
                        </span>
                        {totalMarcas > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300 sm:text-xs">
                                {totalMarcas} marcas mapeadas
                            </span>
                        ) : null}
                        {search.trim() ? (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-colors hover:text-[var(--text-strong)] sm:text-xs"
                            >
                                <i className="fas fa-times-circle text-[11px]" aria-hidden="true"></i>
                                Limpar busca
                            </button>
                        ) : null}
                    </div>

                    <FornecedorViewModeToggle value={viewType} onChange={setViewType} />
                </div>
            ) : null}

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
                    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-soft)] dark:divide-slate-700/60">
                        {filtered.map((fornecedor, index) => (
                            <FornecedorListItem
                                key={fornecedor.id}
                                fornecedor={fornecedor}
                                isExpanded={expandedFornecedorId === fornecedor.id}
                                onToggleExpand={() => handleToggleExpand(fornecedor.id)}
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
                )
            ) : search.trim() ? (
                <ContentState
                    compact
                    iconClassName="fas fa-search"
                    title="Nenhum fornecedor encontrado"
                    description="Tente outro nome, contato, telefone ou marca."
                />
            ) : (
                <ContentState
                    iconClassName="fas fa-truck-loading"
                    title="Cadastre seu primeiro fornecedor"
                    description="Adicione fabricantes e distribuidores para consultar contatos quando precisar."
                    actionLabel="Adicionar fornecedor"
                    actionIconClassName="fas fa-plus"
                    onAction={handleOpenCreate}
                />
            )}

            {showModal ? (
                <FornecedorStyledModal
                    editing={selectedF}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedF(null);
                    }}
                />
            ) : null}

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
                title="Confirmar exclusao de fornecedor"
                message={
                    <>
                        Tem certeza que deseja excluir o fornecedor <strong>"{fornecedorToDelete?.empresa || ''}"</strong>?
                        <br />
                        Esta ação não pode ser desfeita.
                    </>
                }
                confirmButtonText="Sim, excluir"
                confirmButtonVariant="danger"
                isProcessing={isDeletingFornecedor}
                processingText="Excluindo..."
            />
        </div>
    );
};

export default FornecedoresView;
