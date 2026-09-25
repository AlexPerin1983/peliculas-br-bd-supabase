import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, Copy, ExternalLink, Link2, LoaderCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import type { Client, SavedPDF } from '../../types';
import { buildProposalShareMessage, createProposalPortal, type CreatedProposalPortal } from '../../src/lib/proposalPortal';
import { buildProposalWhatsAppAppUrl, buildProposalWhatsAppBusinessUrl } from '../../src/lib/proposalMessages';
import { attachProposalLink } from '../../src/lib/proposalShareText';
import Modal from '../ui/Modal';
import ProposalWhatsAppChooser from './ProposalWhatsAppChooser';

interface ProposalShareModalProps {
    isOpen: boolean;
    client: Client;
    pdfs: SavedPDF[];
    onClose: () => void;
    autoCreate?: boolean;
    /** Mensagens prontas da proposta; o link é incluído nelas na hora de enviar. */
    messageOptions?: string[];
}

// -1 = mensagem padrão do link (com os valores); 0..n = mensagens prontas.
const DEFAULT_CHOICE = -1;

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

const ProposalShareModal: React.FC<ProposalShareModalProps> = ({ isOpen, client, pdfs, onClose, autoCreate = false, messageOptions = [] }) => {
    const [expiration, setExpiration] = useState(() => getDefaultExpiration(pdfs));
    const [created, setCreated] = useState<CreatedProposalPortal | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState<'link' | 'message' | null>(null);
    const [isWhatsAppChooserOpen, setIsWhatsAppChooserOpen] = useState(false);
    const autoCreateKeyRef = useRef<string | null>(null);
    const pdfKey = pdfs.map(pdf => pdf.id).join(',');

    useEffect(() => {
        if (!isOpen) return;
        setExpiration(getDefaultExpiration(pdfs));
        setCreated(null);
        setError('');
        setCopied(null);
        setIsWhatsAppChooserOpen(false);
        setChoice(DEFAULT_CHOICE);
        setMessage('');
    // A chave evita apagar o link criado quando o pai apenas recria o array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, pdfKey]);

    const readyMessages = useMemo(() => messageOptions.map(option => option.trim()).filter(Boolean), [messageOptions]);
    const [choice, setChoice] = useState(DEFAULT_CHOICE);
    const [message, setMessage] = useState('');

    const buildChoiceMessage = (nextChoice: number, portal: CreatedProposalPortal) => (
        nextChoice === DEFAULT_CHOICE || !readyMessages[nextChoice]
            ? buildProposalShareMessage(client, pdfs, portal.url, portal.expiresAt)
            : attachProposalLink(readyMessages[nextChoice], portal.url, portal.expiresAt)
    );

    // Com o link criado, monta a mensagem escolhida já com o link dentro (editável antes de enviar).
    useEffect(() => {
        if (created) setMessage(buildChoiceMessage(choice, created));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [created, choice]);

    const linkMissing = !!created && !!message && !message.includes(created.url);
    const whatsappAppUrl = created ? buildProposalWhatsAppAppUrl(client.telefone, message) : null;
    const whatsappBusinessUrl = created ? buildProposalWhatsAppBusinessUrl(client.telefone, message) : null;

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

    useEffect(() => {
        if (!isOpen || !autoCreate || !pdfKey || autoCreateKeyRef.current === pdfKey) return;
        autoCreateKeyRef.current = pdfKey;
        void create();
        // A criação deve acontecer uma única vez para o conjunto aberto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, autoCreate, pdfKey]);

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
        <>
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
                        {pdfs.some(pdf => (pdf.followUpDiscountAmount || 0) > 0 && pdf.expirationDate && new Date(pdf.expirationDate).getTime() <= Date.now()) && (
                            <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Esta proposta venceu. Sugerimos uma nova validade para a oferta com desconto; confira a data abaixo.</p>
                        )}
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
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/25">
                            <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">Link criado com sucesso</span>
                            </p>
                            <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">até {new Date(created.expiresAt).toLocaleDateString('pt-BR')}</span>
                        </div>

                        <div className="flex gap-2">
                            <input readOnly value={created.url} aria-label="Link do cliente" className="ui-field h-10 min-w-0 flex-1 px-3 text-xs text-[var(--text-muted)]" />
                            <button type="button" onClick={() => void copy('link', created.url)} aria-label="Copiar link"
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)]">
                                {copied === 'link' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                            <a href={created.url} target="_blank" rel="noreferrer" aria-label="Visualizar página"
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)]">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[var(--text-body)]">Mensagem com o link</span>
                                {readyMessages.length > 0 && (
                                    <div className="flex gap-1" role="group" aria-label="Escolher mensagem">
                                        {[DEFAULT_CHOICE, ...readyMessages.map((_, index) => index)].map(option => (
                                            <button key={option} type="button" aria-pressed={choice === option} onClick={() => setChoice(option)}
                                                aria-label={option === DEFAULT_CHOICE ? 'Mensagem padrão' : `Mensagem pronta ${option + 1}`}
                                                className={`h-7 min-w-[28px] rounded-full px-2.5 text-xs font-bold transition-colors ${choice === option
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}>
                                                {option === DEFAULT_CHOICE ? 'Padrão' : option + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <textarea value={message} onChange={event => setMessage(event.target.value)} rows={8} aria-label="Mensagem que será enviada"
                                className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-[13px] leading-5 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                            {linkMissing ? (
                                <p className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                    O link não está mais na mensagem.
                                    <button type="button" onClick={() => setMessage(buildChoiceMessage(choice, created))} className="shrink-0 underline">Refazer</button>
                                </p>
                            ) : (
                                <p className="text-[11px] text-[var(--text-muted)]">Pode ajustar o texto à vontade; o link já está incluído.</p>
                            )}
                        </div>

                        {whatsappAppUrl && whatsappBusinessUrl
                            ? <button type="button" onClick={() => setIsWhatsAppChooserOpen(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"><MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp</button>
                            : <button disabled className="h-12 w-full rounded-xl bg-slate-200 text-sm font-bold text-slate-500 dark:bg-slate-800">Sem telefone</button>}
                        <button type="button" onClick={() => void copy('message', message)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-semibold text-[var(--text-strong)]">
                            {copied === 'message' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied === 'message' ? 'Mensagem copiada' : 'Copiar mensagem'}
                        </button>
                    </>
                )}
            </div>
        </Modal>
        {isOpen && isWhatsAppChooserOpen && whatsappAppUrl && whatsappBusinessUrl && (
            <ProposalWhatsAppChooser
                clientName={client.nome}
                appUrl={whatsappAppUrl}
                businessUrl={whatsappBusinessUrl}
                onClose={() => setIsWhatsAppChooserOpen(false)}
            />
        )}
        </>
    );
};

export default ProposalShareModal;
