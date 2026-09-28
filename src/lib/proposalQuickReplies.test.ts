import { describe, expect, it } from 'vitest';
import type { Agendamento, ProposalPaymentSelection } from '../../types';
import type { CompanyProposalPortal, ProposalPortalMessage } from './proposalPortal';
import { buildFollowUpTimeline } from './proposalFollowUpQueue';
import {
    agreementConfirmedAt,
    approvedValue,
    buildAgreementConfirmation,
    detectQuickReplyTopics,
    findUpcomingInstallation,
    installationDoneSince,
    quickReplyCatalog,
    stripWhatsAppFormatting,
    suggestQuickReplies,
} from './proposalQuickReplies';

const NOW = new Date('2026-09-26T12:00:00Z').getTime();
const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

const portal = (overrides: Partial<CompanyProposalPortal> = {}): CompanyProposalPortal => ({
    id: 'p1',
    token: 'tok',
    clientId: 1,
    clientName: 'Carlos Lima',
    expiresAt: at(20),
    status: 'active',
    lastActivityAt: at(-1),
    viewCount: 2,
    proposals: [{ id: 10, name: 'Térmica 10 anos', total: 4500 }, { id: 11, name: 'Opção 2', total: 3200 }],
    messages: [],
    unreadCount: 0,
    createdAt: at(-5),
    followUps: [],
    ...overrides,
});

const clientSays = (body: string, kind: ProposalPortalMessage['kind'] = 'message', extra: Partial<ProposalPortalMessage> = {}): ProposalPortalMessage =>
    ({ id: 1, sender_type: 'client', kind, body, created_at: at(-0.1), ...extra });

const card = (installments: number): ProposalPaymentSelection => ({
    methodType: installments > 1 ? 'parcelado_sem_juros' : 'pix',
    installments,
    label: installments > 1 ? `${installments}x sem juros` : 'Pix à vista',
    calculationMode: installments > 1 ? 'no_interest' : 'cash',
    baseTotal: 4500,
    customerTotal: 4500,
    installmentValue: 4500 / installments,
    ratePercent: 0,
    discountPercent: 0,
});

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

describe('respostas rápidas', () => {
    it('reconhece o assunto pelas palavras do cliente (sem acento e sem confundir "bom dia")', () => {
        expect(detectQuickReplyTopics(clientSays('Achei um pouco caro'))).toEqual(['price']);
        expect(detectQuickReplyTopics(clientSays('Tá salgado, dá pra fazer um preço melhor?'))).toEqual(['price']);
        expect(detectQuickReplyTopics(clientSays('Dá pra parcelar no cartão?'))).toEqual(['payment']);
        expect(detectQuickReplyTopics(clientSays('Quando vocês podem vir?'))).toEqual(['schedule']);
        expect(detectQuickReplyTopics(clientSays('Vou ver com a minha esposa'))).toEqual(['decision']);
        expect(detectQuickReplyTopics(clientSays('Bom dia! Tudo bem?'))).toEqual([]);
        expect(detectQuickReplyTopics(clientSays('Fechado, pode agendar pra sexta'))).toEqual(['approved', 'schedule']);
        expect(detectQuickReplyTopics(clientSays('Vou deixar pra outra hora'))).toEqual(['rejected']);
        // Contraproposta pelo link vem antes do que estiver escrito.
        expect(detectQuickReplyTopics(clientSays('Faz por 4 mil à vista?', 'negotiation'))[0]).toBe('negotiation');
    });

    it('"tá caro": nomeia a dúvida e pergunta o motivo antes de falar em desconto', () => {
        const replies = suggestQuickReplies(portal({ messages: [clientSays('Tá caro')] }));
        expect(replies.map(reply => reply.label)).toEqual(['Nomear a dúvida', 'Entender o motivo', 'Ajustar o projeto', 'Parcelar']);
        expect(replies[0].text).toBe('Entendi, Carlos. Parece que o valor ficou acima do que você tinha planejado, é isso?');
    });

    it('sem assunto reconhecido: perguntas para entender o cliente; nada quando a empresa falou por último', () => {
        expect(suggestQuickReplies(portal({ messages: [clientSays('Oi, tudo bem?')] })).map(reply => reply.id)).toEqual(['importante', 'fotos', 'ligar']);
        expect(suggestQuickReplies(portal({ messages: [clientSays('Quando podem vir?')] })).map(reply => reply.id)).toEqual(['agenda', 'importante', 'fotos', 'ligar']);
        const answered = portal({ messages: [clientSays('Tá caro'), { id: 2, sender_type: 'company', kind: 'message', body: 'Entendi', created_at: at(0) }] });
        expect(suggestQuickReplies(answered)).toEqual([]);
        expect(suggestQuickReplies(portal())).toEqual([]);
    });

    it('aprovou: confirmar o combinado e agradecer (sem perguntas de venda)', () => {
        const approved = portal({ status: 'approved', messages: [clientSays('', 'approved', { saved_pdf_id: 10 })] });
        const replies = suggestQuickReplies(approved);
        expect(replies.map(reply => reply.label)).toEqual(['Confirmar o combinado', 'Agradecer']);
        expect(replies[0].text).toContain('Confirmando o que combinamos:');
        // Vai para a conversa do link: sem a formatação do WhatsApp.
        expect(replies[0].text).toContain(`• Valor: ${brl(4500)}\n`);
        expect(stripWhatsAppFormatting('de ~R$ 10~ por *R$ 9*')).toBe('de R$ 10 por R$ 9');
    });

    it('lista completa: todos os assuntos, cada resposta uma vez', () => {
        const catalog = quickReplyCatalog(portal());
        expect(catalog.map(group => group.label)).toEqual(['Achou caro', 'Mandou uma contraproposta', 'Forma de pagamento', 'Data da instalação', 'Vai pensar ou decidir com alguém', 'Para entender o cliente', 'Fechou', 'Não quis fechar']);
        const ids = catalog.flatMap(group => group.replies.map(reply => reply.id));
        expect(new Set(ids).size).toBe(ids.length);
        expect(catalog.every(group => group.replies.length > 0)).toBe(true);
        expect(ids.every(id => !catalog.flatMap(group => group.replies).find(reply => reply.id === id)?.text.includes('{{'))).toBe(true);
    });
});

describe('confirmar o combinado', () => {
    const approvedPortal = (payment?: ProposalPaymentSelection, extra: Partial<CompanyProposalPortal> = {}) => portal({
        status: 'approved',
        messages: [clientSays('', 'approved', { saved_pdf_id: 10, payment_selection: payment ?? null, created_at: at(-1) })],
        ...extra,
    });

    it('o que, quanto, quando e quem recebe a equipe (com a data agendada)', () => {
        const installation = new Date(NOW + 3 * DAY);
        const lines = buildAgreementConfirmation(approvedPortal(card(10)), installation).split('\n');
        expect(lines[0]).toBe('Oi, Carlos! Recebi a sua aprovação, muito obrigado pela confiança 🙌');
        expect(lines).toContain('• Proposta: Térmica 10 anos');
        expect(lines).toContain(`• Valor: *${brl(4500)}* (10x sem juros, parcelas de ${brl(450)})`);
        expect(lines.find(line => line.startsWith('• Instalação: '))).toMatch(/\d{2}\/\d{2} às \d{2}:\d{2}$/);
        expect(lines.at(-1)).toContain('Quem vai receber a nossa equipe no local?');
    });

    it('sem data: pergunta o melhor dia; sem pagamento escolhido: valor da opção aprovada', () => {
        const message = buildAgreementConfirmation(approvedPortal());
        expect(message).toContain(`• Valor: *${brl(4500)}*\n`);
        expect(message).toContain('• Instalação: a combinar');
        expect(message).toContain('Qual dia e período (manhã ou tarde) ficam melhor pra você?');
        expect(approvedValue(approvedPortal(card(1)))).toBe(4500);
    });

    it('nome de arquivo não vira "proposta"', () => {
        const pdfName = approvedPortal(undefined, { proposals: [{ id: 10, name: 'orcamento_carlos_opcao_1.pdf', total: 900 }] });
        expect(buildAgreementConfirmation(pdfName)).toContain('• Serviço: instalação das películas');
    });

    it('próxima instalação do cliente (ignora outros clientes, canceladas e passadas)', () => {
        const agendamentos: Agendamento[] = [
            { id: 1, clienteId: 2, clienteNome: 'Outro', start: at(1), end: at(1.1) },
            { id: 2, clienteId: 1, clienteNome: 'Carlos Lima', start: at(2), end: at(2.1), serviceStatus: 'cancelled' },
            { id: 3, clienteId: 1, clienteNome: 'Carlos Lima', start: at(5), end: at(5.1) },
            { id: 4, clienteId: 1, clienteNome: 'Carlos Lima', start: at(4), end: at(4.1), serviceStatus: 'scheduled' },
            { id: 5, clienteId: 1, clienteNome: 'Carlos Lima', start: at(-3), end: at(-2.9), serviceStatus: 'completed' },
        ];
        expect(findUpcomingInstallation(agendamentos, 1, NOW)?.toISOString()).toBe(at(4));
        expect(findUpcomingInstallation(undefined, 1, NOW)).toBeNull();
    });

    it('instalação que já aconteceu depois da aprovação, mesmo sem marcar como concluída', () => {
        const agendamentos: Agendamento[] = [
            { id: 1, clienteId: 1, clienteNome: 'Carlos Lima', start: at(-10), end: at(-9.9), serviceStatus: 'completed' },
            { id: 2, clienteId: 1, clienteNome: 'Carlos Lima', start: at(-2), end: at(-1.9) },
            { id: 3, clienteId: 1, clienteNome: 'Carlos Lima', start: at(-1), end: at(-0.9), serviceStatus: 'no_show' },
            { id: 4, clienteId: 1, clienteNome: 'Carlos Lima', start: at(3), end: at(3.1) },
        ];
        // O serviço de 10 dias atrás é de antes da aprovação.
        expect(installationDoneSince(agendamentos, 1, NOW - 5 * DAY, NOW)?.toISOString()).toBe(at(-2));
        expect(installationDoneSince(agendamentos, 1, NOW - 1.5 * DAY, NOW)).toBeNull();
        expect(installationDoneSince(agendamentos, 1, NOW - 20 * DAY, NOW)?.toISOString()).toBe(at(-2));
        expect(installationDoneSince(undefined, 1, NOW - DAY, NOW)).toBeNull();
    });

    it('confirmação registrada depois da aprovação (e no histórico)', () => {
        const confirmed = approvedPortal(undefined, {
            followUps: [
                { id: 1, kind: 'contact', step: 'hot', channel: 'whatsapp', created_at: at(-3) },
                { id: 2, kind: 'contact', step: 'confirm', channel: 'whatsapp', created_at: at(-0.5) },
            ],
        });
        expect(agreementConfirmedAt(confirmed)).toBe(NOW - 0.5 * DAY);
        expect(agreementConfirmedAt(approvedPortal())).toBeNull();
        expect(buildFollowUpTimeline(confirmed, NOW).map(entry => entry.label)).toContain('Você mandou mensagem (confirmação do combinado)');
    });
});
