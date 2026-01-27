import React, { useState, useEffect, useRef, FormEvent, DragEvent } from 'react';
import Modal from '../ui/Modal';

interface AIClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIClientModal: React.FC<AIClientModalProps> = ({ isOpen, onClose, onProcess, isProcessing, provider }) => {
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

    // Estados para UX de processamento
    const [processingStage, setProcessingStage] = useState<'idle' | 'analyzing' | 'extracting' | 'filling'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const processingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const MAX_IMAGES = 1;

    const PROCESSING_MESSAGES = {
        idle: '',
        analyzing: 'Analisando entrada...',
        extracting: 'Extraindo dados do cliente...',
        filling: 'Preenchendo campos...'
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
        setError(null);
        setShowCancelConfirm(false);
        if (processingTimerRef.current) {
            clearTimeout(processingTimerRef.current);
            processingTimerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopRecordingCleanup();
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (processingTimerRef.current) {
                clearTimeout(processingTimerRef.current);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imagePreviews, audioUrl]);

    useEffect(() => {
        if (!isOpen) {
            resetState();
            setActiveTab('text');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Simula progressão de etapas durante processamento
    useEffect(() => {
        if (isProcessing && processingStage === 'idle') {
            setProcessingStage('analyzing');
            setError(null);

            // Avança para 'extracting' após 1.5s
            processingTimerRef.current = setTimeout(() => {
                setProcessingStage('extracting');
                // Avança para 'filling' após mais 1.5s
                processingTimerRef.current = setTimeout(() => {
                    setProcessingStage('filling');
                }, 1500);
            }, 1500);
        } else if (!isProcessing && processingStage !== 'idle') {
            // Quando termina o processamento, reseta a etapa
            setProcessingStage('idle');
            if (processingTimerRef.current) {
                clearTimeout(processingTimerRef.current);
                processingTimerRef.current = null;
            }
        }
    }, [isProcessing, processingStage]);

    const handleTabChange = (tab: 'text' | 'image' | 'audio') => {
        resetState();
        setActiveTab(tab);
    }

    const handleImageFiles = (files: FileList | null) => {
        if (!files) return;

        const newFiles: File[] = [];
        const newPreviews: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (imageFiles.length + newFiles.length >= MAX_IMAGES) {
                alert(`Você pode enviar no máximo ${MAX_IMAGES} ${MAX_IMAGES > 1 ? 'imagens' : 'imagem'}.`);
                break;
            }
            if (file && file.type.startsWith('image/')) {
                newFiles.push(file);
                newPreviews.push(URL.createObjectURL(file));
            } else {
                alert(`O arquivo "${file.name}" não é uma imagem válida.`);
            }
        }

        setImageFiles(prev => [...prev, ...newFiles]);
        setImagePreviews(prev => [...prev, ...newPreviews]);
    };

    const handleDragEvent = (e: DragEvent<HTMLDivElement>, isEntering: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isProcessing && imageFiles.length < MAX_IMAGES) setIsDragging(isEntering);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        handleDragEvent(e, false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    const removeImage = (indexToRemove: number) => {
        URL.revokeObjectURL(imagePreviews[indexToRemove]);
        setImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
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
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.");
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isProcessing) return; // Prevenir duplo clique

        setError(null);
        let processData: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob } | null = null;
        switch (activeTab) {
            case 'text':
                if (text.trim()) processData = { type: 'text', data: text };
                break;
            case 'image':
                if (imageFiles.length > 0) processData = { type: 'image', data: imageFiles };
                break;
            case 'audio':
                if (audioBlob) processData = { type: 'audio', data: audioBlob };
                break;
        }

        if (processData) {
            try {
                await onProcess(processData);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao processar. Tente novamente.';
                setError(errorMessage);
                setProcessingStage('idle');
            }
        } else {
            alert("Forneça um conteúdo para processar.");
        }
    };

    const handleRetry = () => {
        setError(null);
        setProcessingStage('idle');
    };

    const handleCancelClick = () => {
        if (isProcessing) {
            setShowCancelConfirm(true);
        } else {
            onClose();
        }
    };

    const handleConfirmCancel = () => {
        setShowCancelConfirm(false);
        onClose();
    };

    const isProcessable = (activeTab === 'text' && !!text.trim()) || (activeTab === 'image' && imageFiles.length > 0) || (activeTab === 'audio' && !!audioBlob);

    const footer = (
        <>
            <button
                onClick={handleCancelClick}
                className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="aiClientForm"
                className={`px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 min-w-[140px] disabled:bg-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isProcessing ? 'cursor-wait' : ''}`}
                disabled={isProcessing || !isProcessable || !!error}
            >
                {isProcessing ? (
                    <>
                        <div className="loader-sm"></div>
                        <span>Processando...</span>
                    </>
                ) : (
                    'Processar'
                )}
            </button>
        </>
    );

    const TabButton: React.FC<{ tab: 'text' | 'image' | 'audio', icon: string, children: React.ReactNode }> = ({ tab, icon, children }) => (
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

    // Componente de Overlay de Loading
    const LoadingOverlay = () => (
        <div
            className="absolute inset-0 bg-white/90 dark:bg-slate-800/95 flex flex-col items-center justify-center z-10 rounded-lg"
            role="status"
            aria-live="polite"
        >
            <div className="loader-lg mb-4"></div>
            <p className="text-slate-700 dark:text-slate-200 font-medium text-lg mb-1">
                {PROCESSING_MESSAGES[processingStage] || 'Processando...'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
                Isso pode levar alguns segundos
            </p>
            <div className="mt-4 flex gap-1">
                <span className={`w-2 h-2 rounded-full ${processingStage === 'analyzing' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                <span className={`w-2 h-2 rounded-full ${processingStage === 'extracting' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                <span className={`w-2 h-2 rounded-full ${processingStage === 'filling' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
            </div>
        </div>
    );

    // Componente de Estado de Erro
    const ErrorState = () => (
        <div className="absolute inset-0 bg-white/95 dark:bg-slate-800/95 flex flex-col items-center justify-center z-10 rounded-lg p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <i className="fas fa-exclamation-triangle text-2xl text-red-500"></i>
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-medium text-lg mb-2 text-center">
                Erro ao processar
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-4 max-w-xs">
                {error}
            </p>
            <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
                <i className="fas fa-redo"></i>
                Tentar novamente
            </button>
        </div>
    );

    // Diálogo de confirmação de cancelamento
    const CancelConfirmDialog = () => (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-lg">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mx-4 max-w-sm shadow-xl">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                    Processamento em andamento
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                    A IA está processando seus dados. Se você sair agora, o resultado pode ser perdido.
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300"
                    >
                        Continuar
                    </button>
                    <button
                        onClick={handleConfirmCancel}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700"
                    >
                        Sair mesmo assim
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={handleCancelClick} title="Preencher Cliente com IA" footer={footer}>
            <form id="aiClientForm" onSubmit={handleSubmit} className="space-y-4 relative" aria-busy={isProcessing}>
                {/* Overlay de Loading */}
                {isProcessing && <LoadingOverlay />}

                {/* Estado de Erro */}
                {error && !isProcessing && <ErrorState />}

                {/* Diálogo de Cancelamento */}
                {showCancelConfirm && <CancelConfirmDialog />}

                <div className="flex space-x-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <TabButton tab="text" icon="fas fa-font">Texto</TabButton>
                    <TabButton tab="image" icon="fas fa-image">Imagem</TabButton>
                    {provider === 'gemini' && (
                        <TabButton tab="audio" icon="fas fa-microphone">Áudio</TabButton>
                    )}
                </div>

                <div className="min-h-[250px] flex flex-col justify-center items-center">
                    {activeTab === 'text' && (
                        <>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 self-start">
                                Ex: <span className="italic">O cliente é João Silva, telefone (11) 98765-4321, mora na Rua das Flores, 123, São Paulo.</span>
                            </p>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Descreva ou cole as informações do cliente aqui..."
                                className="w-full h-48 p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                                disabled={isProcessing}
                            />
                        </>
                    )}
                    {activeTab === 'image' && (
                        <div className="w-full text-center flex flex-col items-center justify-center">
                            {imagePreviews.length > 0 && (
                                <div className="w-full mb-2">
                                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        {imagePreviews.map((previewUrl, index) => (
                                            <div key={index} className="relative group aspect-video">
                                                <img src={previewUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-contain rounded-md border border-slate-200" />
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
                                </div>
                            )}

                            {imageFiles.length < MAX_IMAGES && (
                                <div
                                    onDragEnter={(e) => handleDragEvent(e, true)}
                                    onDragLeave={(e) => handleDragEvent(e, false)}
                                    onDragOver={(e) => handleDragEvent(e, true)}
                                    onDrop={handleDrop}
                                    className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-slate-500 bg-slate-100 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'} ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <label htmlFor="image-upload" className={isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}>
                                        <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 mb-2"></i>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">Arraste e solte uma imagem aqui, ou <span className="font-semibold text-slate-800 dark:text-slate-200">clique para selecionar</span>.</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Pode ser um print de conversa ou um rascunho de dados.
                                        </p>
                                    </label>
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={(e) => handleImageFiles(e.target.files)} className="hidden" id="image-upload" disabled={isProcessing || imageFiles.length >= MAX_IMAGES} multiple />
                        </div>
                    )}
                    {activeTab === 'audio' && (
                        <div className="w-full flex flex-col items-center justify-center text-center">
                            {audioUrl ? (
                                <>
                                    <audio src={audioUrl} controls className="w-full" />
                                    <button type="button" onClick={() => { setAudioBlob(null); setAudioUrl(null); }} disabled={isProcessing} className="mt-2 text-sm text-red-600 hover:text-red-800">Gravar Novamente</button>
                                </>
                            ) : isRecording ? (
                                <>
                                    <i className="fas fa-microphone-alt text-3xl text-red-500 mb-3 animate-pulse"></i>
                                    <p className="text-slate-600 mb-4">Gravando... fale os dados do cliente.</p>
                                    <button type="button" onClick={stopRecording} className="px-6 py-2 bg-red-600 text-white rounded-full font-semibold shadow-md">
                                        Parar Gravação
                                    </button>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-microphone text-3xl text-slate-400 mb-3"></i>
                                    <p className="text-slate-600 mb-4">Clique no botão para começar a gravar o áudio com os dados do cliente.</p>
                                    <button type="button" onClick={startRecording} disabled={isProcessing} className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-full font-semibold shadow-md hover:bg-slate-700 dark:hover:bg-slate-600">
                                        Iniciar Gravação
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </form>
            <style>{`
                .loader-sm {
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top: 2px solid #fff;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    animation: spin 0.8s linear infinite;
                }
                .loader-lg {
                    border: 4px solid rgba(100,116,139,0.2);
                    border-top: 4px solid #3b82f6;
                    border-radius: 50%;
                    width: 48px;
                    height: 48px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </Modal>
    );
};

export default AIClientModal;