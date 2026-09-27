import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CalendarClock, Check, Copy, ExternalLink, Link2, LoaderCircle, MessageCircle, RefreshCw, ShieldCheck, Star } from 'lucide-react';
import type { Client, SavedPDF } from '../../types';
import {
    buildProposalShareMessage,
    createProposalPortal,
    findClientProposalPortals,
    refreshProposalPortal,
    revokeProposalPortal,
    setProposalPortalHighlight,
    type CreatedProposalPortal,
    type ExistingProposalPortal,
} from '../../src/lib/proposalPortal';
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

const shortDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const describePortal = (portal: ExistingProposalPortal) => [
    `enviado em ${shortDate(portal.createdAt)}`,
    portal.viewCount > 0 ? `aberto ${portal.viewCount}x` : 'ainda não aberto',
    portal.expired ? 'vencido' : portal.status === 'negotiating' ? 'em negociação' : `válido até ${shortDate(portal.expiresAt)}`,
].join(' · ');

const ProposalShareModal: React.FC<ProposalShareModalProps> = ({ isOpen, client, pdfs, onClose, autoCreate = false, messageOptions = [] }) => {
    const [expiration, setExpiration] = useState(() => getDefaultExpiration(pdfs));
    const [created, setCreated] = useState<CreatedProposalPortal | null>(null);
    // Como o link da tela chegou: criado agora, atualizado agora ou já existia.
    const [origin, setOrigin] = useState<'created' | 'updated' | 'existing'>('created');
    const [shownPortal, setShownPortal] = useState<ExistingProposalPortal | null>(null);
    const [existing, setExisting] = useState<ExistingProposalPortal[]>([]);
    const [checking, setChecking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [copied, setCopied] = useState<'link' | 'message' | string | null>(null);
    const [isWhatsAppChooserOpen, setIsWhatsAppChooserOpen] = useState(false);
    const [editingValidity, setEditingValidity] = useState(false);
    const [confirmingRevoke, setConfirmingRevoke] = useState(false);
    const autoCreateKeyRef = useRef<string | null>(null);
    // Opção destacada como "Recomendada" na página do cliente (só com 2 ou mais opções).
    const [highlightId, setHighlightId] = useState<number | null>(null);
    const pdfKey = pdfs.map(pdf => pdf.id).join(',');

    const readyMessages = useMemo(() => messageOptions.map(option => option.trim()).filter(Boolean), [messageOptions]);
    const [choice, setChoice] = useState(DEFAULT_CHOICE);
    const [message, setMessage] = useState('');

    // Links que ainda podem receber estas propostas (o mais recente primeiro).
    const updatablePortals = existing.filter(portal => portal.updatable && !(portal.sameProposals && !portal.expired));

    const showPortal = (portal: ExistingProposalPortal) => {
        setShownPortal(portal);
        setOrigin('existing');
        setCreated({ portalId: portal.id, token: '', shareCode: '', expiresAt: portal.expiresAt, url: portal.url });
    };

    // O destaque é um extra: se falhar, o link continua valendo.
    const applyHighlight = async (portalId: string) => {
        if (pdfs.length < 2) return;
        try {
            await setProposalPortalHighlight(portalId, highlightId);
        } catch (err) {
            console.warn('[ProposalShareModal] Destaque não salvo:', err);
            setNotice('O link foi criado, mas não deu para marcar a opção recomendada.');
        }
    };

    const create = async () => {
        setBusy(true);
        setError('');
        try {
            const next = await createProposalPortal(pdfs, expiration, client.nome);
            await applyHighlight(next.portalId);
            setCreated(next);
            setOrigin('created');
            setShownPortal(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível criar o link.');
        } finally {
            setBusy(false);
        }
    };

    const update = async (portal: ExistingProposalPortal) => {
        setBusy(true);
        setError('');
        try {
            const next = await refreshProposalPortal(portal.id, pdfs, expiration, client.nome);
            await applyHighlight(next.portalId);
            setCreated(next);
            setOrigin('updated');
            setShownPortal({ ...portal, expired: false, status: 'active' });
            setEditingValidity(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível atualizar o link.');
        } finally {
            setBusy(false);
        }
    };

    const revoke = async (portalId: string) => {
        setBusy(true);
        setError('');
        try {
            await revokeProposalPortal(portalId);
            setExisting(current => current.filter(portal => portal.id !== portalId));
            if (created?.portalId === portalId) {
                setCreated(null);
                setShownPortal(null);
            }
            setConfirmingRevoke(false);
            setNotice('Link encerrado. O cliente não consegue mais abrir esse endereço.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível encerrar o link.');
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setExpiration(getDefaultExpiration(pdfs));
        setCreated(null);
        setShownPortal(null);
        setOrigin('created');
        setExisting([]);
        setError('');
        setNotice('');
        setCopied(null);
        setIsWhatsAppChooserOpen(false);
        setEditingValidity(false);
        setConfirmingRevoke(false);
        setChoice(DEFAULT_CHOICE);
        setMessage('');

        // Antes de criar, procura os links que este cliente já recebeu.
        let cancelled = false;
        setChecking(true);
        findClientProposalPortals(pdfs, client.nome)
            .catch(() => [] as ExistingProposalPortal[])
            .then(list => {
                if (cancelled) return;
                setExisting(list);
                const current = list.find(portal => portal.sameProposals && !portal.expired && portal.updatable);
                if (current) {
                    showPortal(current);
                    return;
                }
                const hasOther = list.some(portal => portal.updatable);
                if (autoCreate && !hasOther && autoCreateKeyRef.current !== pdfKey) {
                    autoCreateKeyRef.current = pdfKey;
                    void create();
                }
            })
            .finally(() => { if (!cancelled) setChecking(false); });
        return () => { cancelled = true; };
    // A chave evita refazer a busca quando o pai apenas recria o array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, pdfKey]);

    const buildChoiceMessage = (nextChoice: number, portal: CreatedProposalPortal) => (
        nextChoice === DEFAULT_CHOICE || !readyMessages[nextChoice]
            ? buildProposalShareMessage(client, pdfs, portal.url, portal.expiresAt)
            : attachProposalLink(readyMessages[nextChoice], portal.url, portal.expiresAt)
    );

    // Com o link na tela, monta a mensagem escolhida já com o link dentro (editável antes de enviar).
    useEffect(() => {
        if (created) setMessage(buildChoiceMessage(choice, created));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [created, choice]);

    const linkMissing = !!created && !!message && !message.includes(created.url);
    const whatsappAppUrl = created ? buildProposalWhatsAppAppUrl(client.telefone, message) : null;
    const whatsappBusinessUrl = created ? buildProposalWhatsAppBusinessUrl(client.telefone, message) : null;

    const copy = async (type: string, value: string) => {
        try {
            await copyText(value);
            setCopied(type);
            window.setTimeout(() => setCopied(current => current === type ? null : current), 1800);
        } catch {
            setError('Não foi possível copiar automaticamente. Selecione o texto e copie.');
        }
    };

    const validityField = (
        <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--text-body)]"><CalendarClock className="h-4 w-4 text-[var(--brand-primary)]" /> Válido até</span>
            <input type="date" min={dateInput(new Date(Date.now() + 86_400_000))} value={expiration} onChange={event => setExpiration(event.target.value)} className="ui-field h-12 w-full px-3 text-sm font-bold" />
            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">O contador termina às 23:59 desta data. Depois disso, decisões e download ficam bloqueados.</span>
        </label>
    );

    const headline = origin === 'existing'
        ? 'Link já enviado para este cliente'
        : origin === 'updated'
            ? 'Link atualizado (mesmo endereço)'
            : 'Link criado com sucesso';

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

                {notice ? <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{notice}</p> : null}

                {checking ? (
                    <p className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--text-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Procurando links deste cliente…</p>
                ) : !created ? (
                    <>
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Propostas incluídas</p>
                            <div className="max-h-40 space-y-2 overflow-y-auto">
                                {pdfs.map((pdf, index) => {
                                    const name = pdf.proposalOptionName || pdf.nomeArquivo || `Proposta ${index + 1}`;
                                    const highlighted = pdf.id != null && pdf.id === highlightId;
                                    return (
                                        <div key={pdf.id ?? index} className={`flex items-center justify-between gap-3 rounded-xl border bg-[var(--surface)] px-3 py-2.5 ${highlighted ? 'border-amber-300 dark:border-amber-700' : 'border-[var(--border-subtle)]'}`}>
                                            <span className="min-w-0 truncate text-xs font-bold text-[var(--text-strong)]">{name}</span>
                                            <span className="flex shrink-0 items-center gap-2">
                                                <span className="text-xs font-black text-[var(--brand-primary)]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pdf.totalPreco || 0)}</span>
                                                {pdfs.length > 1 && pdf.id != null ? (
                                                    <button type="button" aria-pressed={highlighted} onClick={() => setHighlightId(highlighted ? null : pdf.id!)}
                                                        aria-label={highlighted ? `Tirar destaque de ${name}` : `Recomendar ${name}`} title="Mostrar esta opção como Recomendada para o cliente"
                                                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${highlighted ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40' : 'text-[var(--text-soft)] hover:text-amber-500'}`}>
                                                        <Star className="h-4 w-4" fill={highlighted ? 'currentColor' : 'none'} aria-hidden="true" />
                                                    </button>
                                                ) : null}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {pdfs.length > 1 ? <p className="text-[11px] text-[var(--text-muted)]">Toque na estrela para mostrar uma opção como <strong className="font-semibold">Recomendada</strong> para o cliente.</p> : null}
                        </div>
                        {pdfs.some(pdf => (pdf.followUpDiscountAmount || 0) > 0 && pdf.expirationDate && new Date(pdf.expirationDate).getTime() <= Date.now()) && (
                            <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Esta proposta venceu. Sugerimos uma nova validade para a oferta com desconto; confira a data abaixo.</p>
                        )}

                        {updatablePortals.length > 0 ? (
                            <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800/60 dark:bg-amber-950/20" aria-label="Links já enviados">
                                <p className="text-xs font-bold text-amber-900 dark:text-amber-100">{updatablePortals.length === 1 ? 'Este cliente já tem um link' : `Este cliente já tem ${updatablePortals.length} links`}</p>
                                {updatablePortals.slice(0, 3).map(portal => (
                                    <div key={portal.id} className="rounded-lg bg-[var(--surface)] px-3 py-2">
                                        <p className="truncate text-xs font-semibold text-[var(--text-strong)]">{portal.proposals.map(item => item.name).join(', ') || 'Proposta'}</p>
                                        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{describePortal(portal)}</p>
                                        <div className="mt-1.5 flex gap-3 text-[11px] font-semibold">
                                            <button type="button" onClick={() => void copy(portal.id, portal.url)} className="text-[var(--brand-primary)]">{copied === portal.id ? 'Copiado' : 'Copiar link'}</button>
                                            <button type="button" onClick={() => showPortal(portal)} className="text-[var(--brand-primary)]">Ver e enviar</button>
                                            <button type="button" disabled={busy} onClick={() => void revoke(portal.id)} className="text-red-600 disabled:opacity-50">Encerrar</button>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        ) : null}

                        {validityField}
                        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

                        {updatablePortals.length > 0 ? (
                            <div className="space-y-2">
                                <button type="button" disabled={busy || pdfs.length === 0} onClick={() => void update(updatablePortals[0])} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] text-sm font-black text-white shadow-lg shadow-blue-500/15 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {busy ? 'Atualizando…' : `Atualizar o link de ${shortDate(updatablePortals[0].createdAt)}`}</button>
                                <p className="text-center text-[11px] leading-4 text-[var(--text-muted)]">O cliente continua no mesmo endereço e passa a ver as propostas acima. A conversa é mantida.</p>
                                <button type="button" disabled={busy || pdfs.length === 0} onClick={() => void create()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-semibold text-[var(--text-strong)] disabled:opacity-60"><Link2 className="h-4 w-4" /> Criar um link separado</button>
                            </div>
                        ) : (
                            <button type="button" disabled={busy || pdfs.length === 0} onClick={() => void create()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] text-sm font-black text-white shadow-lg shadow-blue-500/15 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {busy ? 'Criando link…' : 'Criar link da proposta'}</button>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/25">
                            <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">{headline}</span>
                            </p>
                            <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">até {new Date(created.expiresAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {origin === 'existing' && shownPortal ? <p className="-mt-2 text-[11px] text-[var(--text-muted)]">{describePortal(shownPortal)}. Não precisa criar outro: use este mesmo link.</p> : null}

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

                        {/* Gerenciar o link: prorrogar, encerrar ou criar outro. */}
                        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
                            {editingValidity ? (
                                <div className="space-y-2">
                                    {validityField}
                                    <div className="flex gap-2">
                                        <button type="button" disabled={busy} onClick={() => setEditingValidity(false)} className="h-10 flex-1 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-body)]">Cancelar</button>
                                        <button type="button" disabled={busy} onClick={() => void update(shownPortal ?? { id: created.portalId } as ExistingProposalPortal)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] text-sm font-bold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Salvar validade</button>
                                    </div>
                                </div>
                            ) : confirmingRevoke ? (
                                <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
                                    <p className="text-xs font-semibold text-red-800 dark:text-red-200">Encerrar este link? O cliente não vai mais conseguir abrir a proposta por ele.</p>
                                    <div className="mt-2 flex gap-2">
                                        <button type="button" disabled={busy} onClick={() => setConfirmingRevoke(false)} className="h-9 flex-1 rounded-lg border border-red-200 bg-white text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">Manter</button>
                                        <button type="button" disabled={busy} onClick={() => void revoke(created.portalId)} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 text-xs font-bold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null} Encerrar link</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs font-semibold">
                                    <button type="button" onClick={() => { setExpiration(dateInput(new Date(created.expiresAt))); setEditingValidity(true); }} className="inline-flex items-center gap-1.5 text-[var(--brand-primary)]"><CalendarClock className="h-3.5 w-3.5" /> Alterar validade</button>
                                    {origin === 'existing' ? <button type="button" disabled={busy} onClick={() => void create()} className="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)]"><Link2 className="h-3.5 w-3.5" /> Criar um link separado</button> : null}
                                    <button type="button" onClick={() => setConfirmingRevoke(true)} className="inline-flex items-center gap-1.5 text-red-600"><Ban className="h-3.5 w-3.5" /> Encerrar link</button>
                                </div>
                            )}
                            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
                        </div>
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
