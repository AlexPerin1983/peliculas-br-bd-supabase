import React, { useState, useEffect, useRef, FormEvent } from 'react';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../../src/contexts/FeedbackContext';
import { AIInput } from '../../../types';

interface EstoqueAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
}

const EstoqueAIModal: React.FC<EstoqueAIModalProps> = ({ isOpen, onClose, onProcess, isProcessing }) => {
    const { showAlert, showToast } = useFeedback();
    const [activeTab, setActiveTab] = useState<'audio' | 'text'>('audio');
    const [text, setText] = useState('');

    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const stopRecordingCleanup = () => {
        if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    useEffect(() => {
        if (!isOpen) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            stopRecordingCleanup();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setText('');
            setAudioBlob(null);
            setAudioUrl(null);
            setIsRecording(false);
            setErrorMessage(null);
            setActiveTab('audio');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        return () => {
            stopRecordingCleanup();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                audioChunksRef.current = [];
                stopRecordingCleanup();
            };
            audioChunksRef.current = [];
            setAudioBlob(null);
            setAudioUrl(null);
            setErrorMessage(null);
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            showAlert({
                title: 'Microfone indisponivel',
                message: 'Não foi possível acessar o microfone. Verifique as permissões do seu navegador.',
                tone: 'error'
            });
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isProcessing) return;

        const hasContent = !!text.trim() || !!audioBlob;
        if (!hasContent) {
            showToast('Grave um áudio ou descreva o item para processar.', { tone: 'warning' });
            return;
        }

        setErrorMessage(null);
        try {
            await onProcess({
                text: text.trim() ? text : undefined,
                audio: audioBlob || undefined,
            });
        } catch (err: any) {
            setErrorMessage(err?.message || 'Erro ao processar. Tente novamente.');
        }
    };

    const isProcessable = !!text.trim() || !!audioBlob;

    const footer = (
        <button
            type="submit"
            form="estoqueAIForm"
            className="flex-1 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 py-3 font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            disabled={isProcessing || !isProcessable}
            aria-busy={isProcessing}
        >
            {isProcessing ? (
                <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    <span>Interpretando...</span>
                </>
            ) : (
                <>
                    <i className="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                    <span>Preencher com IA</span>
                </>
            )}
        </button>
    );

    const TabButton: React.FC<{ tab: 'audio' | 'text'; icon: string; children: React.ReactNode }> = ({ tab, icon, children }) => (
        <button
            type="button"
            onClick={() => setActiveTab(tab)}
            disabled={isProcessing}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-[var(--radius-control)] transition-colors duration-200 flex items-center justify-center gap-2 ${
                activeTab === tab
                    ? 'bg-[var(--surface-inverse)] text-[var(--surface)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
            }`}
        >
            <i className={icon} aria-hidden="true"></i>
            {children}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar ao estoque com IA" footer={footer}>
            <form id="estoqueAIForm" onSubmit={handleSubmit} className="space-y-4" aria-busy={isProcessing}>
                <p className="text-sm leading-6 text-[var(--text-muted)]">
                    Fale ou escreva o que quer cadastrar. A IA identifica se é bobina ou retalho e preenche o
                    formulário — você só revisa e confirma.
                </p>

                <div className="rounded-[var(--radius-control)] border border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)] p-3 text-xs leading-5 text-[var(--text-body)]">
                    <p className="font-semibold text-[var(--text-strong)]">Exemplos:</p>
                    <p className="mt-1">"Retalho de Blackout, 60 por 120 centímetros, prateleira A"</p>
                    <p>"Bobina de Suntek, 1,52 de largura, 30 metros, fornecedor 3M, custou 1500 reais"</p>
                    <p>"3 retalhos iguais de Silver 20, 50 por 80 centímetros"</p>
                </div>

                <div className="flex space-x-2 p-1 bg-[var(--surface-muted)] rounded-[var(--radius-control)]">
                    <TabButton tab="audio" icon="fas fa-microphone">Áudio</TabButton>
                    <TabButton tab="text" icon="fas fa-font">Texto</TabButton>
                </div>

                <div className="relative min-h-[180px] flex flex-col justify-center items-center">
                    {isProcessing && (
                        <div
                            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface)]/90 backdrop-blur-sm"
                            aria-live="polite"
                        >
                            <i className="fas fa-wand-magic-sparkles text-3xl text-[var(--brand-primary)] mb-3 animate-pulse" aria-hidden="true"></i>
                            <p className="font-medium text-[var(--text-strong)]">Interpretando o item...</p>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">Isso pode levar alguns segundos</p>
                        </div>
                    )}

                    {errorMessage && !isProcessing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface)]/95 p-4">
                            <i className="fas fa-exclamation-circle text-3xl text-red-500 mb-3" aria-hidden="true"></i>
                            <p className="mb-4 text-center font-medium text-red-600 dark:text-red-300">{errorMessage}</p>
                            <button
                                type="button"
                                onClick={() => setErrorMessage(null)}
                                className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-inverse)] px-4 py-2 text-[var(--surface)]"
                            >
                                <i className="fas fa-redo" aria-hidden="true"></i>
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="w-full flex flex-col items-center justify-center text-center">
                            {audioUrl ? (
                                <>
                                    <audio src={audioUrl} controls className="w-full" />
                                    <button
                                        type="button"
                                        onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                                        disabled={isProcessing}
                                        className="mt-3 text-sm font-semibold text-red-600 hover:text-red-800 dark:text-red-400"
                                    >
                                        Gravar novamente
                                    </button>
                                </>
                            ) : isRecording ? (
                                <>
                                    <i className="fas fa-microphone-alt text-3xl text-red-500 mb-3 animate-pulse" aria-hidden="true"></i>
                                    <p className="mb-4 text-[var(--text-muted)]">Gravando... fale a película, as medidas e onde fica.</p>
                                    <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="rounded-full bg-red-600 px-6 py-2 font-semibold text-white shadow-md"
                                    >
                                        Parar gravação
                                    </button>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-microphone text-3xl text-[var(--text-soft)] mb-3" aria-hidden="true"></i>
                                    <p className="mb-4 text-[var(--text-muted)]">Toque para gravar a descrição do item.</p>
                                    <button
                                        type="button"
                                        onClick={startRecording}
                                        disabled={isProcessing}
                                        className="rounded-full bg-[var(--brand-primary)] px-6 py-2 font-semibold text-white shadow-md transition-colors hover:bg-[var(--brand-primary-strong)]"
                                    >
                                        Iniciar gravação
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'text' && (
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Ex: Retalho de Blackout, 60 por 120 centímetros, prateleira A..."
                            className="ui-field h-36 w-full resize-none p-3 text-sm placeholder:text-[var(--text-muted)]"
                            disabled={isProcessing}
                        />
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default EstoqueAIModal;
