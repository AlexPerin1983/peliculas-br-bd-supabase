import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import AIComposerModal, { AIComposerModalProps } from './AIComposerModal';

vi.mock('../../ui/Modal', () => ({
    default: ({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) => (
        <section>
            <h1>{title}</h1>
            <div>{children}</div>
            {footer && <footer>{footer}</footer>}
        </section>
    ),
}));

const showToast = vi.fn();
vi.mock('../../../src/contexts/FeedbackContext', () => ({
    useFeedback: () => ({ showAlert: vi.fn(), showToast }),
}));

beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
});

const renderComposer = (overrides: Partial<AIComposerModalProps> = {}) => {
    const onProcess = vi.fn().mockResolvedValue(undefined);
    render(
        <AIComposerModal
            isOpen
            onClose={vi.fn()}
            onProcess={onProcess}
            isProcessing={false}
            provider="gemini"
            title="Medidas com IA"
            intro="Envie as medidas."
            textPlaceholder="Descreva…"
            textExample="2 janelas de 1,20 x 1,50"
            filesHint="Foto ou PDF."
            voiceHint="Fale as medidas."
            submitLabel="Preencher medidas"
            stages={['Lendo…']}
            {...overrides}
        />
    );
    return { onProcess };
};

const pdf = () => new File(['%PDF-1.4'], 'lista-medidas.pdf', { type: 'application/pdf' });

describe('AIComposerModal', () => {
    it('com Gemini aceita foto e PDF e oferece voz', () => {
        renderComposer();
        expect(screen.getByRole('tab', { name: 'Foto/PDF' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Voz/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Foto/PDF' }));
        expect(document.getElementById('ai-composer-files')).toHaveAttribute('accept', 'image/*,application/pdf');
    });

    it('sem Gemini aceita só foto e esconde voz', () => {
        renderComposer({ provider: 'openai' });
        expect(screen.queryByRole('tab', { name: /PDF/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Voz/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /Foto/ }));
        expect(document.getElementById('ai-composer-files')).toHaveAttribute('accept', 'image/*');
    });

    it('lista o PDF com botão de remover visível e envia para a IA', async () => {
        const { onProcess } = renderComposer();
        fireEvent.click(screen.getByRole('tab', { name: 'Foto/PDF' }));
        const file = pdf();
        fireEvent.change(document.getElementById('ai-composer-files')!, { target: { files: [file] } });

        expect(await screen.findByText('lista-medidas.pdf')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remover lista-medidas.pdf' })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Preencher medidas' }));
        await waitFor(() => expect(onProcess).toHaveBeenCalledTimes(1));
        expect(onProcess).toHaveBeenCalledWith(expect.objectContaining({ images: [file] }));
    });

    it('recusa arquivos que não são foto nem PDF', async () => {
        renderComposer();
        fireEvent.click(screen.getByRole('tab', { name: 'Foto/PDF' }));
        fireEvent.change(document.getElementById('ai-composer-files')!, {
            target: { files: [new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' })] },
        });
        await waitFor(() => expect(showToast).toHaveBeenCalled());
        expect(screen.queryByText('planilha.xlsx')).not.toBeInTheDocument();
    });

    it('"Usar" preenche o exemplo no texto', () => {
        renderComposer();
        fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
        expect(screen.getByRole('textbox')).toHaveValue('2 janelas de 1,20 x 1,50');
    });
});
