import React, { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { AIInput } from '../../types';

interface AIQuickProposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai' | 'local_ocr';
}

const MAX_IMAGES = 5;

const AIQuickProposalModal: React.FC<AIQuickProposalModalProps> = ({
    isOpen,
    onClose,
    onProcess,
    isProcessing,
    provider
}) => {
    const { showAlert, showToast } = useFeedback();
    const [activeTab, setActiveTab] = useState<'text' | 'image' | 'audio'>('text');
    const [text, setText] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [processingStage, setProcessingStage] = useState<'idle' | 'analyzing' | 'building' | 'saving' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const processingMessages: Record<string, string> = {
        analyzing: 'Analisando atendimento...',
        building: 'Montando cliente e medidas...',
        saving: 'Criando proposta...'
    };

    const stopRecordingCleanup = () => {
        if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const resetState = () => {
        if (isRecording) stopRecording();
        stopRecordingCleanup();
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setText('');
        setImageFiles([]);
        setImagePreviews([]);
        setAudioBlob(null);
        setAudioUrl(null);
        setIsRecording(false);
        setIsDragging(false);
        setProcessingStage('idle');
        setErrorMessage(null);
    };

    useEffect(() => {
        return () => {
            stopRecordingCleanup();
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [imagePreviews, audioUrl]);

    useEffect(() => {
        if (!isOpen) {
            resetState();
            setActiveTab('text');
        }
    }, [isOpen]);

    useEffect(() => {
        if (isProcessing && processingStage === 'idle') {
            setProcessingStage('analyzing');
            const timer1 = setTimeout(() => setProcessingStage('building'), 1500);
            const timer2 = setTimeout(() => setProcessingStage('saving'), 3000);
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
        if (!isProcessing && processingStage !== 'idle' && processingStage !== 'error') {
            setProcessingStage('idle');
        }
    }, [isProcessing, processingStage]);

    const handleTabChange = (tab: 'text' | 'image' | 'audio') => {
        setActiveTab(tab);
    };

    const handleImageFiles = (files: FileList | null) => {
        if (!files) return;

        const newFiles: File[] = [];
        const newPreviews: string[] = [];

        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            if (imageFiles.length + newFiles.length >= MAX_IMAGES) {
                showToast(`Você pode enviar no máximo ${MAX_IMAGES} imagens.`, { tone: 'warning' });
                break;
            }
            if (file && file.type.startsWith('image/')) {
                newFiles.push(file);
                newPreviews.push(URL.createObjectURL(file));
            } else if (file) {
                showToast(`O arquivo "${file.name}" não é uma imagem válida.`, { tone: 'error' });
            }
        }

        setImageFiles(previous => [...previous, ...newFiles]);
        setImagePreviews(previous => [...previous, ...newPreviews]);
    };

    const handleDragEvent = (event: DragEvent<HTMLDivElement>, isEntering: boolean) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isProcessing && imageFiles.length < MAX_IMAGES) {
            setIsDragging(isEntering);
        }
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        handleDragEvent(event, false);
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            handleImageFiles(event.dataTransfer.files);
            event.dataTransfer.clearData();
        }
    };

    const removeImage = (indexToRemove: number) => {
        URL.revokeObjectURL(imagePreviews[indexToRemove]);
        setImageFiles(previous => previous.filter((_, index) => index !== indexToRemove));
        setImagePreviews(previous => previous.filter((_, index) => index !== indexToRemove));
    };

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
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            showAlert({
                title: 'Microfone indisponível',
                message: 'Não foi possível acessar o microfone. Verifique as permissões do navegador.',
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

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (isProcessing) return;

        const hasContent = !!text.trim() || imageFiles.length > 0 || !!audioBlob;
        if (!hasContent) {
            showToast('Forneça um conteúdo para criar a proposta.', { tone: 'warning' });
            return;
        }

        // Extração mesclada: envia texto + imagens + áudio juntos numa única chamada.
        const processData: AIInput = {
            text: text.trim() ? text : undefined,
            images: imageFiles.length > 0 ? imageFiles : undefined,
            audio: audioBlob || undefined,
        };

        setProcessingStage('analyzing');
        setErrorMessage(null);
        try {
            await onProcess(processData);
        } catch (error: any) {
            setProcessingStage('error');
            setErrorMessage(error?.message || 'Erro ao criar proposta. Tente novamente.');
        }
    };

    const isProcessable = !!text.trim() || imageFiles.length > 0 || !!audioBlob;

    const footer = (
        <>
            <button
                type="submit"
                form="aiQuickProposalForm"
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 min-w-[150px] disabled:bg-slate-500 disabled:cursor-wait flex items-center justify-center gap-2"
                disabled={isProcessing || !isProcessable}
                aria-busy={isProcessing}
            >
                {isProcessing ? (
                    <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Criando...</span>
                    </>
                ) : (
                    'Criar proposta'
                )}
            </button>
        </>
    );

    const TabButton: React.FC<{ tab: 'text' | 'image' | 'audio'; icon: string; children: React.ReactNode }> = ({ tab, icon, children }) => (
        <button
            type="button"
            onClick={() => handleTabChange(tab)}
            disabled={isProcessing}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
            <i className={icon}></i>
            {children}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Proposta rápida com IA" footer={footer} fullScreenOnMobile>
            <form id="aiQuickProposalForm" onSubmit={handleSubmit} className="space-y-4" aria-busy={isProcessing}>
                <div className="flex space-x-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <TabButton tab="text" icon="fas fa-font">Texto</TabButton>
                    <TabButton tab="image" icon="fas fa-image">Imagem</TabButton>
                    {provider === 'gemini' && <TabButton tab="audio" icon="fas fa-microphone">Áudio</TabButton>}
                </div>

                <div className="relative min-h-[270px] flex flex-col justify-center items-center">
                    {isProcessing && (
                        <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg" aria-live="polite">
                            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 overflow-hidden absolute top-0 rounded-t-lg">
                                <div className="h-full bg-blue-500 animate-indeterminate-progress"></div>
                            </div>
                            <i className="fas fa-wand-magic-sparkles text-4xl text-blue-500 dark:text-blue-400 mb-4 animate-pulse"></i>
                            <p className="text-slate-700 dark:text-slate-200 font-medium text-lg">{processingMessages[processingStage] || 'Processando...'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">A proposta vai abrir para revisão</p>
                        </div>
                    )}

                    {processingStage === 'error' && !isProcessing && (
                        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center z-10 rounded-lg p-4">
                            <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
                            <p className="text-red-700 dark:text-red-300 font-medium text-center mb-4">
                                {errorMessage || 'Erro ao criar proposta. Tente novamente.'}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setProcessingStage('idle');
                                    setErrorMessage(null);
                                }}
                                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 flex items-center gap-2"
                            >
                                <i className="fas fa-redo"></i>
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {activeTab === 'text' && (
                        <>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 self-start">
                                Ex: cliente Maria, 83 99999-8888, Rua A 123. Sala 2 janelas 1,20x1,50 fume, quarto 1 janela 0,80x1,20.
                            </p>
                            <textarea
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                placeholder="Cole ou descreva dados do cliente, endereço, medidas e película..."
                                className="w-full h-52 p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                                disabled={isProcessing}
                            />
                        </>
                    )}

                    {activeTab === 'image' && (
                        <div className="w-full text-center flex flex-col items-center justify-center">
                            {imagePreviews.length > 0 && (
                                <div className="w-full mb-2">
                                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        {imagePreviews.map((previewUrl, index) => (
                                            <div key={previewUrl} className="relative group aspect-square">
                                                <img src={previewUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-md border border-slate-200" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    disabled={isProcessing}
                                                    className="absolute top-1 right-1 h-6 w-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    aria-label={`Remover imagem ${index + 1}`}
                                                >
                                                    <i className="fas fa-times text-xs"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {imageFiles.length < MAX_IMAGES && (
                                        <label htmlFor="quick-proposal-image-upload" className="mt-2 text-sm text-slate-700 hover:text-slate-900 font-semibold cursor-pointer inline-block">
                                            Adicionar mais imagens... ({imageFiles.length}/{MAX_IMAGES})
                                        </label>
                                    )}
                                </div>
                            )}

                            {imageFiles.length < MAX_IMAGES && imagePreviews.length === 0 && (
                                <div
                                    onDragEnter={(event) => handleDragEvent(event, true)}
                                    onDragLeave={(event) => handleDragEvent(event, false)}
                                    onDragOver={(event) => handleDragEvent(event, true)}
                                    onDrop={handleDrop}
                                    className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-slate-500 bg-slate-100 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'} ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <label htmlFor="quick-proposal-image-upload" className={isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}>
                                        <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 mb-2"></i>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">Arraste prints, fotos ou anotações aqui, ou <span className="font-semibold text-slate-800 dark:text-slate-200">clique para selecionar</span>.</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Até {MAX_IMAGES} imagens com cliente, medidas e película.</p>
                                    </label>
                                </div>
                            )}
                            {imageFiles.length < MAX_IMAGES && (
                                <div className="mt-3 flex gap-2 justify-center">
                                    <label htmlFor="quick-proposal-camera-capture" className={`px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white text-sm font-semibold rounded-md hover:bg-slate-600 dark:hover:bg-slate-500 transition-colors flex items-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <i className="fas fa-camera"></i>
                                        Tirar Foto
                                    </label>
                                </div>
                            )}
                            <input type="file" accept="image/*" capture="environment" onChange={(event) => handleImageFiles(event.target.files)} className="hidden" id="quick-proposal-camera-capture" disabled={isProcessing || imageFiles.length >= MAX_IMAGES} />
                            <input type="file" accept="image/*" onChange={(event) => handleImageFiles(event.target.files)} className="hidden" id="quick-proposal-image-upload" disabled={isProcessing || imageFiles.length >= MAX_IMAGES} multiple />
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="w-full flex flex-col items-center justify-center text-center">
                            {audioUrl ? (
                                <>
                                    <audio src={audioUrl} controls className="w-full" />
                                    <button type="button" onClick={() => { setAudioBlob(null); setAudioUrl(null); }} disabled={isProcessing} className="mt-2 text-sm text-red-600 hover:text-red-800">
                                        Gravar novamente
                                    </button>
                                </>
                            ) : isRecording ? (
                                <>
                                    <i className="fas fa-microphone-alt text-3xl text-red-500 mb-3 animate-pulse"></i>
                                    <p className="text-slate-600 dark:text-slate-300 mb-4">Gravando atendimento...</p>
                                    <button type="button" onClick={stopRecording} className="px-6 py-2 bg-red-600 text-white rounded-full font-semibold shadow-md">
                                        Parar gravação
                                    </button>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-microphone text-3xl text-slate-400 mb-3"></i>
                                    <p className="text-slate-600 dark:text-slate-300 mb-4">Grave cliente, endereço, medidas e película no mesmo áudio.</p>
                                    <button type="button" onClick={startRecording} disabled={isProcessing} className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-full font-semibold shadow-md hover:bg-slate-700 dark:hover:bg-slate-600">
                                        Iniciar gravação
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default AIQuickProposalModal;
