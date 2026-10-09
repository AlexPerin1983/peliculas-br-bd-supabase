import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
    it('com Gemini separa Foto e PDF e oferece voz', () => {
        renderComposer();
        expect(screen.getByRole('tab', { name: 'Foto' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'PDF' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Voz/ })).toBeInTheDocument();
        // A galeria aceita só imagem: no Android, misturar com PDF abre o gerenciador de arquivos em vez da galeria.
        expect(document.getElementById('ai-composer-gallery')).toHaveAttribute('accept', 'image/*');
        expect(document.getElementById('ai-composer-gallery')).not.toHaveAttribute('capture');
        expect(document.getElementById('ai-composer-pdf')).toHaveAttribute('accept', 'application/pdf');
    });

    it('sem Gemini aceita só foto e esconde PDF e voz', () => {
        renderComposer({ provider: 'openai' });
        expect(screen.queryByRole('tab', { name: /PDF/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Voz/ })).not.toBeInTheDocument();
        expect(document.getElementById('ai-composer-pdf')).toBeNull();
        expect(document.getElementById('ai-composer-gallery')).toHaveAttribute('accept', 'image/*');
    });

    it('um toque na aba Foto já abre a galeria; com foto anexada, só mostra a lista', async () => {
        renderComposer();
        const gallery = document.getElementById('ai-composer-gallery')!;
        const openGallery = vi.fn();
        gallery.addEventListener('click', openGallery);

        fireEvent.click(screen.getByRole('tab', { name: 'Foto' }));
        expect(openGallery).toHaveBeenCalledTimes(1);

        fireEvent.change(gallery, { target: { files: [new File(['img'], 'sala.jpg', { type: 'image/jpeg' })] } });
        expect(await screen.findByText('sala.jpg')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Texto' }));
        fireEvent.click(screen.getByRole('tab', { name: /^Foto/ }));
        expect(openGallery).toHaveBeenCalledTimes(1);
        expect(screen.getByText('sala.jpg')).toBeInTheDocument();
    });

    it('um toque na aba PDF já abre a escolha do PDF', () => {
        renderComposer();
        const pdfInput = document.getElementById('ai-composer-pdf')!;
        const openPicker = vi.fn();
        pdfInput.addEventListener('click', openPicker);
        fireEvent.click(screen.getByRole('tab', { name: 'PDF' }));
        expect(openPicker).toHaveBeenCalledTimes(1);
    });

    it('lista o PDF com botão de remover visível e envia para a IA', async () => {
        const { onProcess } = renderComposer();
        fireEvent.click(screen.getByRole('tab', { name: 'PDF' }));
        const file = pdf();
        fireEvent.change(document.getElementById('ai-composer-pdf')!, { target: { files: [file] } });

        expect(await screen.findByText('lista-medidas.pdf')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remover lista-medidas.pdf' })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Preencher medidas' }));
        await waitFor(() => expect(onProcess).toHaveBeenCalledTimes(1));
        expect(onProcess).toHaveBeenCalledWith(expect.objectContaining({ images: [file] }));
    });

    it('recusa arquivos que não são foto nem PDF', async () => {
        renderComposer();
        fireEvent.click(screen.getByRole('tab', { name: 'PDF' }));
        fireEvent.change(document.getElementById('ai-composer-pdf')!, {
            target: { files: [new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' })] },
        });
        await waitFor(() => expect(showToast).toHaveBeenCalled());
        expect(screen.queryByText('planilha.xlsx')).not.toBeInTheDocument();
    });

    it('pode abrir direto no microfone', () => {
        renderComposer({ initialMode: 'voice' });
        expect(screen.getByRole('tab', { name: /Voz/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: 'Começar a gravar' })).toBeInTheDocument();
    });

    it('sem Gemini, pedir o microfone abre no texto', () => {
        renderComposer({ provider: 'openai', initialMode: 'voice' });
        expect(screen.getByRole('tab', { name: 'Texto' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    describe('gravação', () => {
        let recorders: FakeRecorder[] = [];

        class FakeRecorder {
            state: 'inactive' | 'recording' = 'inactive';
            ondataavailable: ((event: { data: Blob }) => void) | null = null;
            onstop: (() => void) | null = null;
            constructor(public stream: { getTracks: () => { stop: () => void }[] }) {
                recorders.push(this);
            }
            start() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
                this.onstop?.();
            }
        }

        beforeEach(() => {
            recorders = [];
            vi.stubGlobal('MediaRecorder', FakeRecorder);
            Object.defineProperty(navigator, 'mediaDevices', {
                configurable: true,
                value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('com envio automático, parar a gravação já manda o áudio para a IA', async () => {
            const { onProcess } = renderComposer({ initialMode: 'voice', autoSubmitVoice: true });

            fireEvent.click(screen.getByRole('button', { name: 'Começar a gravar' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Parar gravação' }));

            await waitFor(() => expect(onProcess).toHaveBeenCalledTimes(1));
            expect(onProcess).toHaveBeenCalledWith({ text: undefined, images: undefined, audio: expect.any(Blob) });
        });

        it('sem envio automático, parar só guarda o áudio para revisar', async () => {
            const { onProcess } = renderComposer({ initialMode: 'voice' });

            fireEvent.click(screen.getByRole('button', { name: 'Começar a gravar' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Parar gravação' }));

            expect(await screen.findByRole('button', { name: /Gravar de novo/ })).toBeInTheDocument();
            expect(onProcess).not.toHaveBeenCalled();
        });

        it('tocar em enviar durante a gravação manda o texto junto com o áudio', async () => {
            const { onProcess } = renderComposer();

            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Maria, sexta' } });
            fireEvent.click(screen.getByRole('tab', { name: /Voz/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Começar a gravar' }));
            await screen.findByRole('button', { name: 'Parar gravação' });
            fireEvent.click(screen.getByRole('button', { name: 'Preencher medidas' }));

            await waitFor(() => expect(onProcess).toHaveBeenCalledTimes(1));
            expect(onProcess).toHaveBeenCalledWith({ text: 'Maria, sexta', images: undefined, audio: expect.any(Blob) });
        });

        it('fechar a tela no meio da gravação não envia nada', async () => {
            const onProcess = vi.fn().mockResolvedValue(undefined);
            const { unmount } = render(
                <AIComposerModal
                    isOpen onClose={vi.fn()} onProcess={onProcess} isProcessing={false} provider="gemini"
                    title="Agenda" intro="Fale." textPlaceholder="" textExample="" filesHint="" voiceHint=""
                    submitLabel="Enviar" stages={['…']} initialMode="voice" autoSubmitVoice
                />
            );

            fireEvent.click(screen.getByRole('button', { name: 'Começar a gravar' }));
            await screen.findByRole('button', { name: 'Parar gravação' });
            unmount();
            // O navegador encerra a gravação quando o microfone é desligado.
            recorders[0].stop();

            expect(onProcess).not.toHaveBeenCalled();
        });
    });

    it('"Usar" preenche o exemplo no texto', () => {
        renderComposer();
        fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
        expect(screen.getByRole('textbox')).toHaveValue('2 janelas de 1,20 x 1,50');
    });
});
