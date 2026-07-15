import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Copy, ExternalLink, Link2, LoaderCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import type { Client, SavedPDF } from '../../types';
import { buildProposalShareMessage, createProposalPortal, type CreatedProposalPortal } from '../../src/lib/proposalPortal';
import Modal from '../ui/Modal';

interface ProposalShareModalProps {
    isOpen: boolean;
    client: Client;
    pdfs: SavedPDF[];
    onClose: () => void;
}

const dateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDefaultExpiration = (pdfs: SavedPDF[]) => {
    const proposalDates = pdfs
        .map(pdf => pdf.expirationDate ? new Date(pdf.expirationDate) : null)
        .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()) && date.getTime() > Date.now());
    if (proposalDates.length > 0) return dateInput(new Date(Math.min(...proposalDates.map(date => date.getTime()))));
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    return dateInput(fallback);
};

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
};

const ProposalShareModal: React.FC<ProposalShareModalProps> = ({ isOpen, client, pdfs, onClose }) => {
    const [expiration, setExpiration] = useState(() => getDefaultExpiration(pdfs));
    const [created, setCreated] = useState<CreatedProposalPortal | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState<'link' | 'message' | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setExpiration(getDefaultExpiration(pdfs));
        setCreated(null);
        setError('');
        setCopied(null);
    }, [isOpen, pdfs]);

    const message = useMemo(() => created ? buildProposalShareMessage(client, pdfs, created.url, created.expiresAt) : '', [client, created, pdfs]);
    const phone = client.telefone?.replace(/\D/g, '') || '';
    const normalizedPhone = phone && !phone.startsWith('55') ? `55${phone}` : phone;
    const whatsappUrl = created && normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}` : '';

    const create = async () => {
        setBusy(true);
        setError('');
        try {
            setCreated(await createProposalPortal(pdfs, expiration, client.nome));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível criar o link.');
        } finally {
            setBusy(false);
        }
    };

    const copy = async (type: 'link' | 'message', value: string) => {
        try {
            await copyText(value);
            setCopied(type);
            window.setTimeout(() => setCopied(current => current === type ? null : current), 1800);
        } catch {
            setError('Não foi possível copiar automaticamente. Selecione o texto e copie.');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<span className="inline-flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue-600 text-white"><Link2 className="h-4 w-4" /></span> Link interativo da proposta</span>}
        >
            <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></span>
                        <div><h3 className="text-sm font-black text-[var(--text-strong)]">Página segura para {client.nome}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">O cliente verá {pdfs.length === 1 ? 'esta proposta' : `as ${pdfs.length} propostas selecionadas`}, o contador de validade, o PDF e os botões Aprovar, Negociar e Recusar.</p></div>
                    </div>
                </section>

                {!created ? (
                    <>
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Propostas incluídas</p>
                            <div className="max-h-40 space-y-2 overflow-y-auto">
                                {pdfs.map((pdf, index) => <div key={pdf.id ?? index} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5"><span className="truncate text-xs font-bold text-[var(--text-strong)]">{pdf.proposalOptionName || pdf.nomeArquivo || `Proposta ${index + 1}`}</span><span className="shrink-0 text-xs font-black text-[var(--brand-primary)]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pdf.totalPreco || 0)}</span></div>)}
                            </div>
                        </div>
                        <label className="block">
                            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--text-body)]"><CalendarClock className="h-4 w-4 text-[var(--brand-primary)]" /> Válido até</span>
                            <input type="date" min={dateInput(new Date(Date.now() + 86_400_000))} value={expiration} onChange={event => setExpiration(event.target.value)} className="ui-field h-12 w-full px-3 text-sm font-bold" />
                            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">O contador termina às 23:59 desta data. Depois disso, decisões e download ficam bloqueados.</span>
                        </label>
                        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
                        <button type="button" disabled={busy || pdfs.length === 0} onClick={() => void create()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] text-sm font-black text-white shadow-lg shadow-blue-500/15 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {busy ? 'Criando link…' : 'Criar link da proposta'}</button>
                    </>
                ) : (
                    <>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <p className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-200"><Check className="h-4 w-4" /> Link criado com sucesso</p>
                            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">As visualizações, decisões e mensagens ficarão vinculadas a este atendimento.</p>
                        </div>
                        <label className="block"><span className="mb-1.5 block text-xs font-bold text-[var(--text-body)]">Link do cliente</span><div className="flex gap-2"><input readOnly value={created.url} className="ui-field h-11 min-w-0 flex-1 px-3 text-xs" /><button type="button" onClick={() => void copy('link', created.url)} className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text-strong)]">{copied === 'link' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied === 'link' ? 'Copiado' : 'Copiar'}</button></div></label>
                        <label className="block"><span className="mb-1.5 block text-xs font-bold text-[var(--text-body)]">Mensagem pronta</span><textarea readOnly value={message} rows={6} className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--text-body)]" /></label>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <button type="button" onClick={() => void copy('message', message)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-xs font-bold text-[var(--text-strong)]">{copied === 'message' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} Copiar mensagem</button>
                            {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</a> : <button disabled className="h-11 rounded-xl bg-slate-200 text-xs font-bold text-slate-500">Sem telefone</button>}
                            <a href={created.url} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white"><ExternalLink className="h-4 w-4" /> Visualizar página</a>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ProposalShareModal;
