import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgendamentoModal from './AgendamentoModal';
import { Client, QuickClientDraft, SavedPDF, UserInfo } from '../../types';

vi.mock('../../services/db', () => ({
    getActiveTeamSize: vi.fn().mockResolvedValue(1),
}));

const userInfo = {
    workingHours: { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] },
} as UserInfo;

// Sexta-feira, 02/10/2026, das 9h às 12h no horário do aparelho.
const voiceStart = new Date(2026, 9, 2, 9, 0);
const voiceEnd = new Date(2026, 9, 2, 12, 0);

const quickClient: QuickClientDraft = {
    nome: 'Maria Souza',
    local: 'Rua das Flores, 120, Centro',
    endereco: { logradouro: 'Rua das Flores', numero: '120', bairro: 'Centro', cidade: '', uf: '' },
    reviewHints: ['O horário não ficou claro. Confira o início.'],
};

const createdClient: Client = {
    id: 42,
    nome: 'Maria Souza',
    telefone: '',
    email: '',
    cpfCnpj: '',
    logradouro: 'Rua das Flores',
    numero: '120',
    bairro: 'Centro',
};

const renderVoiceDraft = (overrides: {
    onSave?: ReturnType<typeof vi.fn>;
    onCreateQuickClient?: ReturnType<typeof vi.fn>;
    start?: Date;
} = {}) => {
    const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
    const onCreateQuickClient = overrides.onCreateQuickClient ?? vi.fn().mockResolvedValue(createdClient);
    const props = {
        isOpen: true,
        onClose: vi.fn(),
        onSave,
        onDelete: vi.fn(),
        schedulingInfo: {
            agendamento: {
                clienteNome: 'Maria Souza',
                start: (overrides.start ?? voiceStart).toISOString(),
                end: voiceEnd.toISOString(),
                notes: 'Película G20 em 3 janelas',
            },
            quickClient,
        },
        clients: [] as Client[],
        savedPdfs: [],
        onAddNewClient: vi.fn(),
        onCreateQuickClient,
        userInfo,
        agendamentos: [],
    };
    const view = render(<AgendamentoModal {...props} />);
    return { ...view, props, onSave, onCreateQuickClient };
};

describe('AgendamentoModal', () => {
    it('abre a criacao manual sem depender dos recursos de IA', () => {
        render(
            <AgendamentoModal
                isOpen
                onClose={vi.fn()}
                onSave={vi.fn().mockResolvedValue(undefined)}
                onDelete={vi.fn()}
                schedulingInfo={{ agendamento: {} }}
                clients={[]}
                savedPdfs={[]}
                onAddNewClient={vi.fn()}
                userInfo={null}
                agendamentos={[]}
            />
        );

        expect(screen.getByText('Novo Agendamento')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agendar' })).toBeInTheDocument();
        expect(screen.queryByText(/sugerir com ia/i)).not.toBeInTheDocument();
    });

    describe('agendamento por voz', () => {
        it('mostra nome, local, dia e hora ditos, sem a busca de clientes', () => {
            renderVoiceDraft();

            expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Maria Souza');
            expect(screen.getByLabelText('Local')).toHaveValue('Rua das Flores, 120, Centro');
            expect(screen.getByLabelText('Início')).toHaveValue('09:00');
            expect(screen.getByLabelText('Término')).toHaveValue('12:00');
            expect(screen.getByLabelText('Observações')).toHaveValue('Película G20 em 3 janelas');
            expect(screen.getByText('O horário não ficou claro. Confira o início.')).toBeInTheDocument();
            expect(screen.queryByPlaceholderText('Selecione ou digite um nome')).not.toBeInTheDocument();
        });

        it('cria o cliente simples e salva o agendamento ligado a ele', async () => {
            const { onSave, onCreateQuickClient } = renderVoiceDraft();

            fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Rua das Flores, 120, apto 3' } });
            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));

            await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
            expect(onCreateQuickClient).toHaveBeenCalledWith(
                { nome: 'Maria Souza', local: 'Rua das Flores, 120, apto 3' },
                quickClient,
            );
            expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
                clienteId: 42,
                clienteNome: 'Maria Souza',
                start: voiceStart.toISOString(),
                end: voiceEnd.toISOString(),
                notes: 'Película G20 em 3 janelas',
                pdfIds: [],
            }));
        });

        it('não cria cliente quando o horário não pode ser agendado', async () => {
            // Domingo não é dia de trabalho nesta empresa.
            const { onSave, onCreateQuickClient } = renderVoiceDraft({ start: new Date(2026, 9, 4, 9, 0) });

            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));

            expect(await screen.findByText('A data selecionada não é um dia de trabalho.')).toBeInTheDocument();
            expect(onCreateQuickClient).not.toHaveBeenCalled();
            expect(onSave).not.toHaveBeenCalled();
        });

        it('pede o nome quando ele ficou vazio', async () => {
            const { onCreateQuickClient } = renderVoiceDraft();

            fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: '   ' } });
            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));

            expect(await screen.findByText('Informe o nome do cliente.')).toBeInTheDocument();
            expect(onCreateQuickClient).not.toHaveBeenCalled();
        });

        it('"Já é cliente?" volta para a lista e guarda o local nas observações', () => {
            renderVoiceDraft();

            fireEvent.click(screen.getByRole('button', { name: 'Já é cliente? Escolher da lista' }));

            expect(screen.queryByLabelText('Nome do cliente')).not.toBeInTheDocument();
            expect(screen.getByPlaceholderText('Selecione ou digite um nome')).toBeInTheDocument();
            expect(screen.getByLabelText('Observações')).toHaveValue('Película G20 em 3 janelas\nLocal: Rua das Flores, 120, Centro');
        });

        describe('cliente já cadastrado', () => {
            const maria: Client = { ...createdClient, id: 7, nome: 'Maria Souza', telefone: '83988881234', bairro: 'Bessa' };
            const mariaLima: Client = { ...createdClient, id: 8, nome: 'Maria Lima', telefone: '', bairro: 'Manaíra' };
            const approved = {
                id: 50, clienteId: 7, date: '2026-09-12', totalPreco: 1250, status: 'approved', proposalOptionName: 'Opção 1',
            } as unknown as SavedPDF;

            const renderWith = (agendamento: Record<string, unknown>, draft: QuickClientDraft) => {
                const onSave = vi.fn().mockResolvedValue(undefined);
                const onCreateQuickClient = vi.fn();
                render(
                    <AgendamentoModal
                        isOpen onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
                        schedulingInfo={{
                            agendamento: { start: voiceStart.toISOString(), end: voiceEnd.toISOString(), notes: '', ...agendamento },
                            quickClient: draft,
                        }}
                        clients={[maria, mariaLima]} savedPdfs={[approved]} onAddNewClient={vi.fn()}
                        onCreateQuickClient={onCreateQuickClient} userInfo={userInfo} agendamentos={[]}
                    />
                );
                return { onSave, onCreateQuickClient };
            };

            it('achado pelo nome: vem escolhido, com a proposta ligada e sem criar cliente', async () => {
                const { onSave, onCreateQuickClient } = renderWith(
                    { clienteId: 7, clienteNome: 'Maria Souza', pdfId: 50, pdfIds: [50] },
                    { nome: 'Maria Souza', local: '', matchedClientId: 7 },
                );

                expect(screen.getByText('Achei Maria Souza nos seus clientes.')).toBeInTheDocument();
                expect(screen.getByRole('checkbox', { name: 'Selecionar Opção 1' })).toBeChecked();

                fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));
                await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 7, pdfIds: [50] })));
                expect(onCreateQuickClient).not.toHaveBeenCalled();
            });

            it('"Não é?" troca para cliente novo com o nome falado', () => {
                renderWith(
                    { clienteId: 7, clienteNome: 'Maria Souza', pdfIds: [50] },
                    { nome: 'Maria Souza', local: 'Av. Beira Mar', matchedClientId: 7 },
                );

                fireEvent.click(screen.getByRole('button', { name: 'Não é? Cadastrar como cliente novo' }));

                expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Maria Souza');
                expect(screen.getByLabelText('Local')).toHaveValue('Av. Beira Mar');
                expect(screen.queryByText('Achei Maria Souza nos seus clientes.')).not.toBeInTheDocument();
            });

            it('com parecidos, um toque escolhe o cliente e liga a proposta dele', async () => {
                const { onSave } = renderWith(
                    { clienteNome: 'Maria' },
                    { nome: 'Maria', local: 'Av. Beira Mar', candidateIds: [7, 8] },
                );

                expect(screen.getByText('Parecidos nos seus clientes')).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Agendar para Maria Souza' }));

                expect(screen.getByRole('checkbox', { name: 'Selecionar Opção 1' })).toBeChecked();
                expect(screen.getByLabelText('Observações')).toHaveValue('Local: Av. Beira Mar');
                fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));
                await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 7, pdfIds: [50] })));
            });
        });

        it('se o agendamento falhar depois do cadastro, a nova tentativa usa o mesmo cliente', async () => {
            const onSave = vi.fn()
                .mockRejectedValueOnce(new Error('Sem conexão.'))
                .mockResolvedValueOnce(undefined);
            const { onCreateQuickClient, rerender, props } = renderVoiceDraft({ onSave });

            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));
            expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();

            // O App coloca o cliente recém-criado na lista.
            rerender(<AgendamentoModal {...props} clients={[createdClient]} />);
            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));

            await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
            expect(onCreateQuickClient).toHaveBeenCalledTimes(1);
            expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ clienteId: 42 }));
        });
    });

    describe('vários dias', () => {
        const amaury: Client = { ...createdClient, id: 9, nome: 'Amaury' };

        const renderDays = (extraDays: string[]) => {
            const onSave = vi.fn().mockResolvedValue(undefined);
            render(
                <AgendamentoModal
                    isOpen onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
                    schedulingInfo={{
                        agendamento: { clienteId: 9, clienteNome: 'Amaury', start: voiceStart.toISOString(), end: voiceEnd.toISOString(), notes: 'Bessa' },
                        extraDays,
                    }}
                    clients={[amaury]} savedPdfs={[]} onAddNewClient={vi.fn()} userInfo={userInfo} agendamentos={[]}
                />
            );
            return { onSave };
        };

        it('agenda sexta e segunda de uma vez, com a segunda como continuação', async () => {
            const { onSave } = renderDays(['2026-10-05']);

            expect(screen.getByText(/\+ seg.*05\/10/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Agendar 2 dias' }));

            await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
            const [days] = onSave.mock.calls[0];
            expect(days).toHaveLength(2);
            expect(days[0]).toMatchObject({ clienteId: 9, start: voiceStart.toISOString(), notes: 'Bessa' });
            expect(days[1]).toMatchObject({
                clienteId: 9,
                start: new Date(2026, 9, 5, 9, 0).toISOString(),
                end: new Date(2026, 9, 5, 12, 0).toISOString(),
                notes: 'Continuação do atendimento de 02/10.\n\nBessa',
                pdfIds: [],
            });
        });

        it('avisa qual dia não pode ser agendado', async () => {
            const { onSave } = renderDays(['2026-10-03']);

            fireEvent.click(screen.getByRole('button', { name: 'Agendar 2 dias' }));

            expect(await screen.findByText(/^sáb.*03\/10: A data selecionada não é um dia de trabalho\.$/)).toBeInTheDocument();
            expect(onSave).not.toHaveBeenCalled();
        });

        it('"Mais um dia" acrescenta o dia seguinte e dá para tirar', () => {
            renderDays([]);

            fireEvent.click(screen.getByRole('button', { name: /Mais um dia/ }));
            expect(screen.getByRole('button', { name: 'Agendar 2 dias' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /^Tirar sáb.*03\/10$/ }));
            expect(screen.getByRole('button', { name: 'Agendar' })).toBeInTheDocument();
        });
    });

    describe('tipo, título e cor', () => {
        const ana: Client = { ...createdClient, id: 11, nome: 'Ana' };

        const renderWith = (agendamento: Record<string, unknown>) => {
            const onSave = vi.fn().mockResolvedValue(undefined);
            render(
                <AgendamentoModal
                    isOpen onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
                    schedulingInfo={{
                        agendamento: { clienteId: 11, clienteNome: 'Ana', start: voiceStart.toISOString(), end: voiceEnd.toISOString(), ...agendamento },
                    }}
                    clients={[ana]} savedPdfs={[]} onAddNewClient={vi.fn()} userInfo={userInfo} agendamentos={[]}
                />
            );
            return { onSave };
        };

        it('agendamento novo começa como Instalação, sem título e com a cor do tipo', async () => {
            const { onSave } = renderWith({});

            expect(screen.getByRole('radio', { name: /Instalação/ })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('button', { name: 'Cor padrão' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));
            await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'instalacao', title: undefined, color: undefined,
            })));
        });

        it('troca para Consulta, dá um título e escolhe outra cor', async () => {
            const { onSave } = renderWith({});

            fireEvent.click(screen.getByRole('radio', { name: /Consulta/ }));
            fireEvent.change(screen.getByLabelText('Título (opcional)'), { target: { value: 'Medir a sala' } });
            fireEvent.click(screen.getByRole('button', { name: 'Cor padrão' }));
            fireEvent.click(screen.getByRole('radio', { name: 'Rosa' }));

            expect(screen.getByRole('button', { name: 'Cor' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Agendar' }));
            await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'consulta', title: 'Medir a sala', color: '#db2777',
            })));
        });

        it('agendamento antigo sem tipo continua sem tipo ao salvar', async () => {
            const { onSave } = renderWith({ id: 300, serviceStatus: 'scheduled' });

            expect(screen.getAllByRole('radio').filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(0);
            fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
            await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 300, eventType: undefined })));
        });
    });
});
