import type { Agendamento } from '../../types';
import type { CompanyProposalPortal, ProposalPortalMessage } from './proposalPortal';
import { formatDeadline, portalTotal } from './proposalFollowUpQueue';

// Respostas rápidas para a conversa do link, conforme o que o cliente escreveu:
// - nomear o que ele sente ("parece que o valor ficou acima do planejado") e esperar;
// - perguntas abertas ("o que…", "como…") para entender o motivo antes de ceder;
// - dar valor sem baixar o preço (ajustar o projeto, parcelar);
// - depois do "sim", confirmar por escrito o que, quanto, quando e quem recebe a equipe.

export type QuickReplyTopic = 'approved' | 'rejected' | 'negotiation' | 'price' | 'payment' | 'schedule' | 'decision' | 'general';

export interface QuickReply {
    id: string;
    label: string;
    // Técnica usada (aparece na lista completa).
    technique?: string;
    text: string;
}

// Ordem da lista completa ("Respostas prontas").
export const QUICK_REPLY_TOPICS: Array<{ topic: QuickReplyTopic; label: string }> = [
    { topic: 'price', label: 'Achou caro' },
    { topic: 'negotiation', label: 'Mandou uma contraproposta' },
    { topic: 'payment', label: 'Forma de pagamento' },
    { topic: 'schedule', label: 'Data da instalação' },
    { topic: 'decision', label: 'Vai pensar ou decidir com alguém' },
    { topic: 'general', label: 'Para entender o cliente' },
    { topic: 'approved', label: 'Fechou' },
    { topic: 'rejected', label: 'Não quis fechar' },
];

const CONFIRM_ID = 'confirmar';

const REPLIES: Record<string, Omit<QuickReply, 'id'>> = {
    rotular: { label: 'Nomear a dúvida', technique: 'Nomear o sentimento', text: 'Entendi, {{primeiro_nome}}. Parece que o valor ficou acima do que você tinha planejado, é isso?' },
    motivo: { label: 'Entender o motivo', technique: 'Pergunta aberta', text: 'Me ajuda a entender: você tinha um valor em mente ou comparou com outro orçamento?' },
    motivo_contraproposta: { label: 'Entender o motivo', technique: 'Pergunta aberta', text: 'Obrigado por me dizer, {{primeiro_nome}}! Me ajuda a entender: esse é o valor que você separou pra isso ou você recebeu outro orçamento?' },
    como: { label: 'Dizer não com uma pergunta', technique: 'Pergunta "como"', text: 'Queria muito fechar com você, {{primeiro_nome}}! Só que nesse valor eu não consigo manter a mesma película e o mesmo acabamento. Como a gente pode fazer isso funcionar pra você?' },
    projeto: { label: 'Ajustar o projeto', technique: 'Sem baixar o preço', text: 'Dá pra ajustar o projeto pra caber melhor no seu orçamento: começar pelos ambientes que mais pegam sol e deixar o restante pra uma segunda etapa. Quer que eu monte essa opção pra você ver?' },
    parcelar: { label: 'Parcelar', technique: 'Sem baixar o preço', text: 'Se o que pesa é pagar tudo de uma vez, consigo parcelar pra ficar mais leve no mês. Quer que eu te mostre como fica?' },
    pagamento: { label: 'Formas de pagamento', technique: 'Pergunta de escolha', text: 'Tenho algumas formas de pagamento. O que fica melhor pra você: à vista no Pix ou parcelado no cartão?' },
    agenda: { label: 'Combinar a data', technique: 'Pergunta de escolha', text: 'Tenho horários nos próximos dias. Qual dia e período ficam melhor pra você: manhã ou tarde?' },
    sem_pressa: { label: 'Sem pressão', technique: 'Nomear o sentimento', text: 'Claro, {{primeiro_nome}}, sem pressa! Parece que você quer ter certeza antes de decidir, e faz todo sentido. Ficou alguma dúvida que eu possa esclarecer?' },
    decisao_conjunta: { label: 'Decisão em conjunto', text: 'Se ajudar, te mando um resumo curtinho das opções pra você mostrar pra quem vai decidir junto. Quer?' },
    retorno: { label: 'Combinar o retorno', technique: 'Pergunta aberta', text: 'Combinado! Qual é um bom dia pra eu te chamar de novo?' },
    importante: { label: 'O que é mais importante', technique: 'Pergunta aberta', text: 'Me conta: o que é mais importante pra você nessa instalação? Diminuir o calor, a claridade ou ter mais privacidade?' },
    fotos: { label: 'Mandar fotos', text: 'Posso te mandar fotos de trabalhos parecidos com o seu? Ajuda a ter uma ideia de como fica 📸' },
    ligar: { label: 'Ligar', text: 'Se preferir, te ligo rapidinho pra explicar melhor. Qual horário fica bom pra você?' },
    [CONFIRM_ID]: { label: 'Confirmar o combinado', technique: 'Combinado por escrito', text: '' },
    agradecer: { label: 'Agradecer', text: 'Muito obrigado pela confiança, {{primeiro_nome}}! 🙌 Já te chamo pra combinarmos a data da instalação.' },
    motivo_recusa: { label: 'Entender o motivo', technique: 'Pergunta aberta', text: 'Obrigado por me avisar, {{primeiro_nome}}! Pra eu melhorar, posso te perguntar o que pesou mais na sua decisão?' },
    porta_aberta: { label: 'Deixar a porta aberta', text: 'Tudo bem, {{primeiro_nome}}! Obrigado por considerar. Se mudar de ideia ou quiser outra opção, é só me chamar por aqui 🙂' },
};

const TOPIC_REPLIES: Record<QuickReplyTopic, string[]> = {
    approved: [CONFIRM_ID, 'agradecer'],
    rejected: ['motivo_recusa', 'porta_aberta'],
    negotiation: ['motivo_contraproposta', 'como', 'projeto', 'parcelar'],
    price: ['rotular', 'motivo', 'projeto', 'parcelar'],
    payment: ['pagamento', 'parcelar'],
    schedule: ['agenda'],
    decision: ['sem_pressa', 'decisao_conjunta', 'retorno'],
    general: ['importante', 'fotos', 'ligar'],
};

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Palavras que indicam o assunto (sem acento), na ordem de prioridade.
const TOPIC_PATTERNS: Array<[QuickReplyTopic, RegExp]> = [
    ['approved', /\b(fechado|fechamos|pode fazer|vamos fazer|pode agendar|pode marcar|aprovei|aceito)\b/],
    ['rejected', /\b(desist\w*|nao vou fazer|nao vou fechar|vou deixar pra|fica pra outra|sem interesse|nao tenho interesse)\b/],
    ['price', /\b(caro|salgad\w*|puxad\w*|preco|valor|desconto|barat\w*|orcamento|mais em conta)\b/],
    ['payment', /\b(parcel\w*|pix|cartao|boleto|a vista|entrada|pagamento|pagar|credito|debito)\b/],
    ['schedule', /\b(quando|data|agenda\w*|prazo|demora\w*|horario\w*|disponib\w*|que dia|qual dia|sabado|segunda|terca|quarta|quinta|sexta|semana que vem|proxima semana|podem? vir)\b/],
    ['decision', /\b(pensar|pensando|ver com|falar com|conversar com|marido|esposa|mulher|socio|decidir|avaliar|analisar|te aviso|te falo|te retorno)\b/],
];

/** Assuntos da mensagem do cliente: pelo tipo (aprovou, recusou, contraproposta) e pelas palavras. */
export const detectQuickReplyTopics = (message: Pick<ProposalPortalMessage, 'kind' | 'body'>): QuickReplyTopic[] => {
    const topics: QuickReplyTopic[] = [];
    if (message.kind === 'approved') topics.push('approved');
    if (message.kind === 'rejected') topics.push('rejected');
    if (message.kind === 'negotiation') topics.push('negotiation');
    const body = normalize(message.body || '');
    for (const [topic, pattern] of TOPIC_PATTERNS) {
        if (!topics.includes(topic) && pattern.test(body)) topics.push(topic);
    }
    return topics;
};

const firstName = (portal: CompanyProposalPortal) => portal.clientName.trim().split(/\s+/)[0] || '';
const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);

/** Última aprovação do cliente, com a opção escolhida e a forma de pagamento. */
export const findApproval = (portal: CompanyProposalPortal) => {
    const message = [...portal.messages].reverse().find(item => item.kind === 'approved') || null;
    const proposal = portal.proposals.find(item => item.id === message?.saved_pdf_id)
        || (portal.proposals.length === 1 ? portal.proposals[0] : null);
    return { message, proposal, payment: message?.payment_selection || null };
};

/** Valor fechado: o da forma de pagamento escolhida (com desconto ou juros), senão o da opção. */
export const approvedValue = (portal: CompanyProposalPortal) => {
    const { proposal, payment } = findApproval(portal);
    return payment ? payment.customerTotal : proposal ? (proposal.conditionFinalValue ?? proposal.total) : portalTotal(portal);
};

const paymentDetail = (payment: NonNullable<ProposalPortalMessage['payment_selection']>) =>
    payment.installments > 1 ? `${payment.label}, parcelas de ${brl(payment.installmentValue)}` : payment.label;

// Depois do "sim": o que, quanto, quando e quem recebe a equipe (evita desencontro no dia).
export const buildAgreementConfirmation = (portal: CompanyProposalPortal, installation?: Date | null) => {
    const { proposal, payment } = findApproval(portal);
    const name = proposal?.name.trim();
    return [
        `Oi, ${firstName(portal)}! Recebi a sua aprovação, muito obrigado pela confiança 🙌`,
        'Confirmando o que combinamos:',
        name && !/\.pdf$/i.test(name) ? `• Proposta: ${name}` : '• Serviço: instalação das películas',
        `• Valor: *${brl(approvedValue(portal))}*${payment ? ` (${paymentDetail(payment)})` : ''}`,
        `• Instalação: ${installation ? formatDeadline(installation) : 'a combinar'}`,
        installation
            ? 'Quem vai receber a nossa equipe no local? No dia, é só deixar a área perto dos vidros livre (cortinas e objetos afastados).'
            : 'Qual dia e período (manhã ou tarde) ficam melhor pra você? E quem vai receber a nossa equipe no local?',
    ].join('\n');
};

// A conversa do link mostra o texto puro: sem o *negrito* e o ~riscado~ do WhatsApp.
export const stripWhatsAppFormatting = (text: string) =>
    text.replace(/\*([^*\n]+)\*/g, '$1').replace(/~([^~\n]+)~/g, '$1');

export const AGREEMENT_TIP = {
    title: 'Depois do "sim"',
    text: 'O negócio só está fechado quando está combinado: o que será feito, quanto, quando e quem recebe a equipe. Confirmar por escrito evita desencontro no dia e passa segurança para o cliente.',
};

const startOfDay = (now: number) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
};

/** Próxima instalação agendada do cliente (de hoje em diante). */
export const findUpcomingInstallation = (agendamentos: Agendamento[] | undefined, clientId: number, now = Date.now()) => {
    const next = (agendamentos || [])
        .filter(item => item.clienteId === clientId && (item.serviceStatus || 'scheduled') === 'scheduled' && time(item.start) >= startOfDay(now))
        .sort((a, b) => time(a.start) - time(b.start))[0];
    return next ? new Date(next.start) : null;
};

/** Instalação que já aconteceu depois da aprovação, mesmo sem ser marcada como concluída (canceladas e faltas não contam). */
export const installationDoneSince = (agendamentos: Agendamento[] | undefined, clientId: number, since: number, now = Date.now()) => {
    const last = (agendamentos || [])
        .filter(item => {
            const status = item.serviceStatus || 'scheduled';
            if (item.clienteId !== clientId || status === 'cancelled' || status === 'no_show' || time(item.start) < since) return false;
            return status === 'completed' || status === 'partial' || time(item.start) < startOfDay(now);
        })
        .sort((a, b) => time(b.start) - time(a.start))[0];
    return last ? new Date(last.start) : null;
};

// Aprovações mais antigas que isso já não pedem a confirmação (continua na lista de respostas prontas).
export const AGREEMENT_WINDOW_DAYS = 30;

/** Quando a empresa confirmou o combinado (WhatsApp ou link). */
export const agreementConfirmedAt = (portal: CompanyProposalPortal) => {
    const since = time(findApproval(portal).message?.created_at);
    const confirmations = (portal.followUps || [])
        .filter(event => event.kind === 'contact' && event.step === 'confirm' && time(event.created_at) >= since)
        .map(event => time(event.created_at));
    return confirmations.length ? Math.max(...confirmations) : null;
};

// Respostas para a conversa do link (texto puro).
const buildQuickReply = (id: string, portal: CompanyProposalPortal, installation?: Date | null): QuickReply => {
    const reply = REPLIES[id];
    const text = id === CONFIRM_ID
        ? stripWhatsAppFormatting(buildAgreementConfirmation(portal, installation))
        : reply.text.replace(/{{primeiro_nome}}/g, firstName(portal));
    return { id, label: reply.label, technique: reply.technique, text };
};

export const isAgreementReply = (reply: Pick<QuickReply, 'id'>) => reply.id === CONFIRM_ID;

/** Sugestões para responder a última mensagem do cliente (vazio quando a empresa falou por último). */
export const suggestQuickReplies = (portal: CompanyProposalPortal, options: { installation?: Date | null; limit?: number } = {}): QuickReply[] => {
    const last = portal.messages[portal.messages.length - 1];
    if (!last || last.sender_type !== 'client') return [];
    const topics = detectQuickReplyTopics(last);
    // Conversa em andamento: completa com perguntas para entender o cliente.
    if (!topics.includes('approved') && !topics.includes('rejected')) topics.push('general');
    const ids = [...new Set(topics.flatMap(topic => TOPIC_REPLIES[topic]))].slice(0, options.limit ?? 4);
    return ids.map(id => buildQuickReply(id, portal, options.installation));
};

/** Lista completa, por assunto (cada resposta aparece uma vez). */
export const quickReplyCatalog = (portal: CompanyProposalPortal, installation?: Date | null) => {
    const seen = new Set<string>();
    return QUICK_REPLY_TOPICS.map(({ topic, label }) => ({
        topic,
        label,
        replies: TOPIC_REPLIES[topic].filter(id => !seen.has(id) && seen.add(id)).map(id => buildQuickReply(id, portal, installation)),
    }));
};
