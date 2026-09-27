import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, MessageCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import type { Client } from '../../types';
import { buildClientWhatsAppUrl, type ClientFollowUpKind } from '../../src/lib/clientInsights';

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement('textarea');
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
};

/** Pedido de avaliação ou de indicação: mensagem pronta (editável) para o WhatsApp. */
const ClientPostSaleSheet: React.FC<{
    isOpen: boolean;
    kind: ClientFollowUpKind;
    client: Client;
    message: string;
    missingReviewLink?: boolean;
    onClose: () => void;
    // Chamado quando a mensagem é enviada (ou copiada): registra o pedido.
    onSent: (channel: 'whatsapp' | 'other') => void;
}> = ({ isOpen, kind, client, message, missingReviewLink, onClose, onSent }) => {
    const [text, setText] = useState(message);
    const [copied, setCopied] = useState(false);

    useEffect(() => { if (isOpen) setText(message); }, [isOpen, message]);

    const whatsappUrl = buildClientWhatsAppUrl(client, text);
    const title = kind === 'review_request' ? 'Pedir avaliação no Google' : 'Pedir indicação';

    const footer = (
        <div className="flex w-full gap-2 text-sm font-semibold">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[var(--border-subtle)] text-[var(--text-body)]">Cancelar</button>
            {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => { onSent('whatsapp'); onClose(); }}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp
                </a>
            ) : (
                <button type="button" onClick={() => { void copyText(text).then(() => { setCopied(true); onSent('other'); window.setTimeout(() => setCopied(false), 1800); }); }}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-white">
                    {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
                </button>
            )}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} keyboardAwareFooter>
            <div className="space-y-3 text-sm">
                <p className="text-[13px] leading-5 text-[var(--text-muted)]">
                    {kind === 'review_request'
                        ? 'Peça logo depois do serviço, enquanto o cliente está satisfeito. Avaliações no Google aparecem para quem procura películas na sua região.'
                        : 'Cliente satisfeito indica. Um pedido simples, alguns dias depois do serviço, costuma trazer vizinhos, amigos e colegas de trabalho.'}
                </p>
                {kind === 'review_request' && missingReviewLink ? (
                    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Cadastre o link de avaliação do Google em Configurações (redes sociais) para ele entrar na mensagem.
                    </p>
                ) : null}
                <label className="block">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Mensagem para {client.nome}</span>
                    <textarea value={text} onChange={event => setText(event.target.value)} rows={9} aria-label="Mensagem do pós-venda" style={{ fontSize: 16 }}
                        className="mt-1 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 leading-6 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </label>
            </div>
        </Modal>
    );
};

export default ClientPostSaleSheet;
