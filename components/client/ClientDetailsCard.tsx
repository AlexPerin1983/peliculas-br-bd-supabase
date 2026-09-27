import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Pencil, Pin, PinOff } from 'lucide-react';
import type { Client } from '../../types';
import { buildClientMapsUrl, clientPhoneDigits, formatClientAddress } from '../../src/lib/clientInsights';

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement('textarea');
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
};

const Field: React.FC<{ label: string; value?: string; href?: string | null; external?: boolean; onAdd: () => void }> = ({ label, value, href, external, onAdd }) => {
    const [copied, setCopied] = useState(false);
    const text = value?.trim();
    return (
        <div className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
                <dt className="text-[11px] font-medium text-[var(--text-muted)]">{label}</dt>
                <dd className="mt-0.5 break-words text-sm text-[var(--text-strong)]">
                    {text ? (
                        href ? <a href={href} className="hover:underline" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{text}</a> : text
                    ) : (
                        <span className="text-xs font-semibold"><button type="button" onClick={onAdd} className="text-[var(--brand-primary)]">Adicionar</button></span>
                    )}
                </dd>
            </div>
            {text ? (
                <div className="flex shrink-0 items-center gap-1">
                    {href && external ? (
                        <a href={href} target="_blank" rel="noreferrer" aria-label={`Abrir ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                    ) : null}
                    <button type="button" aria-label={copied ? `${label} copiado` : `Copiar ${label.toLowerCase()}`}
                        onClick={() => { void copyText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
                        {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                    </button>
                </div>
            ) : null}
        </div>
    );
};

/** Dados de contato e cadastro, com copiar e abrir no mapa. */
const ClientDetailsCard: React.FC<{
    client: Client;
    onEditClient: () => void;
    onTogglePin?: () => void;
}> = ({ client, onEditClient, onTogglePin }) => {
    const phone = clientPhoneDigits(client);
    const address = formatClientAddress(client);
    return (
        <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 shadow-[var(--shadow-hairline)]" aria-label="Dados do cliente">
            <dl className="divide-y divide-[var(--border-subtle)]">
                <Field label="Telefone" value={client.telefone} href={phone ? `tel:+${phone}` : null} onAdd={onEditClient} />
                <Field label="E-mail" value={client.email} href={client.email?.trim() ? `mailto:${client.email.trim()}` : null} onAdd={onEditClient} />
                <Field label="Endereço" value={address} href={buildClientMapsUrl(client)} external onAdd={onEditClient} />
                <Field label="CPF/CNPJ" value={client.cpfCnpj} onAdd={onEditClient} />
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] py-3 text-xs font-semibold">
                <button type="button" onClick={onEditClient} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)]">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar dados
                </button>
                {onTogglePin ? (
                    <button type="button" onClick={onTogglePin} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)]">
                        {client.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
                        {client.pinned ? 'Desafixar' : 'Fixar no topo'}
                    </button>
                ) : null}
            </div>
        </section>
    );
};

export default ClientDetailsCard;
