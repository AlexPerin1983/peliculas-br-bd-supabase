import React, { useState, useEffect, useRef, FormEvent, DragEvent } from 'react';
import Modal from '../ui/Modal';

interface AIMeasurementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIMeasurementModal: React.FC<AIMeasurementModalProps> = ({ isOpen, onClose, onProcess, isProcessing, provider }) => {
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

    // Estados para feedback de processamento melhorado
    const [processingStage, setProcessingStage] = useState<'idle' | 'analyzing' | 'extracting' | 'filling' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Limite de 3 imagens conforme solicitado
    const MAX_IMAGES = 3;

    // Mensagens de status para cada etapa
    const processingMessages: Record<string, string> = {
        analyzing: 'Analisando dados...',
        extracting: 'Extraindo informações...',
        filling: 'Preenchendo campos...',
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
        return () => { // Ensure cleanup on component unmount
            stopRecordingCleanup();
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        }
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
            const timer1 = setTimeout(() => setProcessingStage('extracting'), 1500);
            const timer2 = setTimeout(() => setProcessingStage('filling'), 3000);
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
        if (isProcessing) return; // Evita duplo clique

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
            setProcessingStage('analyzing');
            setErrorMessage(null);
            try {
                await onProcess(processData);
            } catch (err: any) {
                setProcessingStage('error');
                setErrorMessage(err?.message || 'Erro ao processar. Tente novamente.');
            }
        } else {
            alert("Forneça um conteúdo para processar.");
        }
    };

    const handleRetry = () => {
        setProcessingStage('idle');
        setErrorMessage(null);
    };

    const isProcessable = (activeTab === 'text' && !!text.trim()) || (activeTab === 'image' && imageFiles.length > 0) || (activeTab === 'audio' && !!audioBlob);

    const footer = (
        <>
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
                disabled={isProcessing}
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="aiForm"
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 min-w-[140px] disabled:bg-slate-500 disabled:cursor-wait flex items-center justify-center gap-2"
                disabled={isProcessing || !isProcessable}
                aria-busy={isProcessing}
            >
                {isProcessing ? (
                    <>
                        <i className="fas fa-spinner fa-spin"></i>
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Preenchimento Automático com IA" footer={footer}>
            <form id="aiForm" onSubmit={handleSubmit} className="space-y-4" aria-busy={isProcessing}>
                <div className="flex space-x-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <TabButton tab="text" icon="fas fa-font">Texto</TabButton>
                    <TabButton tab="image" icon="fas fa-image">Imagem</TabButton>
                    {provider === 'gemini' && (
                        <TabButton tab="audio" icon="fas fa-microphone">Áudio</TabButton>
                    )}
                </div>

                <div className="relative min-h-[250px] flex flex-col justify-center items-center">
                    {/* Overlay de processamento */}
                    {isProcessing && (
                        <div
                            className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg"
                            aria-live="polite"
                        >
                            {/* Barra de progresso indeterminada */}
                            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 overflow-hidden absolute top-0 rounded-t-lg">
                                <div className="h-full bg-blue-500 animate-indeterminate-progress"></div>
                            </div>
                            <i className="fas fa-robot text-4xl text-blue-500 dark:text-blue-400 mb-4 animate-pulse"></i>
                            <p className="text-slate-700 dark:text-slate-200 font-medium text-lg">
                                {processingMessages[processingStage] || 'Processando...'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Isso pode levar alguns segundos
                            </p>
                        </div>
                    )}

                    {/* Estado de erro */}
                    {processingStage === 'error' && !isProcessing && (
                        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center z-10 rounded-lg p-4">
                            <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
                            <p className="text-red-700 dark:text-red-300 font-medium text-center mb-4">
                                {errorMessage || 'Erro ao processar. Tente novamente.'}
                            </p>
                            <button
                                type="button"
                                onClick={handleRetry}
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
                                Ex: <span className="italic">5 janelas de 1.20 por 2.10 na sala, 2 vidros fixos 0.80x1.50 no escritório.</span>
                            </p>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Descreva ou cole as medidas aqui..."
                                className="w-full h-48 p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                                disabled={isProcessing}
                            />
                        </>
                    )}
                    {activeTab === 'image' && (
                        <div className="w-full text-center flex flex-col items-center justify-center">
                            {imagePreviews.length > 0 && (
                                <div className="w-full mb-2">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        {imagePreviews.map((previewUrl, index) => (
                                            <div key={index} className="relative group aspect-square">
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
                                        <label htmlFor="image-upload" className="mt-2 text-sm text-slate-700 hover:text-slate-900 font-semibold cursor-pointer inline-block">
                                            Adicionar mais imagens... ({imageFiles.length}/{MAX_IMAGES})
                                        </label>
                                    )}
                                </div>
                            )}

                            {imageFiles.length < MAX_IMAGES && imagePreviews.length === 0 && (
                                <div
                                    onDragEnter={(e) => handleDragEvent(e, true)}
                                    onDragLeave={(e) => handleDragEvent(e, false)}
                                    onDragOver={(e) => handleDragEvent(e, true)}
                                    onDrop={handleDrop}
                                    className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-slate-500 bg-slate-100 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'} ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <label htmlFor="image-upload" className={isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}>
                                        <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 mb-2"></i>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">Arraste e solte imagens aqui, ou <span className="font-semibold text-slate-800 dark:text-slate-200">clique para selecionar</span>.</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Até {MAX_IMAGES} imagens. Pode ser uma foto, um print ou um rascunho.
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
                                    <p className="text-slate-600 mb-4">Gravando... fale as medidas.</p>
                                    <button type="button" onClick={stopRecording} className="px-6 py-2 bg-red-600 text-white rounded-full font-semibold shadow-md">
                                        Parar Gravação
                                    </button>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-microphone text-3xl text-slate-400 mb-3"></i>
                                    <p className="text-slate-600 mb-4">Clique no botão para começar a gravar o áudio com as medidas.</p>
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
                @keyframes indeterminate-progress {
                    0% { transform: translateX(-100%); width: 50%; }
                    50% { transform: translateX(0%); width: 50%; }
                    100% { transform: translateX(200%); width: 50%; }
                }
                .animate-indeterminate-progress {
                    animation: indeterminate-progress 1.5s ease-in-out infinite;
                }
            `}</style>
        </Modal>
    );
};

export default AIMeasurementModal;