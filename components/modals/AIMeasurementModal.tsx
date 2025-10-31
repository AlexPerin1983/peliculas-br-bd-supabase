import React, { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../ui/Modal';
import ErrorModal from './ErrorModal';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Measurement } from '../../types';

interface AIMeasurementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (data: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => void;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const MAX_IMAGES = 3;

const AIMeasurementModal: React.FC<AIMeasurementModalProps> = ({ isOpen, onClose, onProcess, isProcessing, provider }) => {
    const [activeTab, setActiveTab] = useState<'text' | 'image' | 'audio'>('text');
    const [text, setText] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '' });
    
    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleDragEvent = useCallback((e: React.DragEvent | React.TouchEvent, isEntering: boolean) => {
        e.preventDefault();
        if (isEntering) {
            setIsDragging(true);
        } else {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageFiles(e.dataTransfer.files);
        }
    }, []);

    const handleImageFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        setImageFiles(prev => {
            const currentCount = prev.length;
            if (currentCount + newFiles.length > MAX_IMAGES) {
                setError(`Limite de ${MAX_IMAGES} imagens excedido. Selecione apenas ${MAX_IMAGES - currentCount} arquivos.`);
                return prev;
            }
            return [...prev, ...newFiles];
        });
    }, []);

    const removeImage = useCallback((indexToRemove: number) => {
        setImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
    }, []);

    const startRecording = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setErrorModalContent({ title: "Erro de Gravação", message: "A gravação de áudio não é suportada neste navegador." });
            setIsErrorModalOpen(true);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            
            recorder.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };
            
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop()); // Stop microphone access
            };

            recorder.start();
            setIsRecording(true);
            setError(null);
        } catch (err) {
            console.error("Erro ao iniciar gravação de áudio:", err);
            setErrorModalContent({ title: "Erro de Permissão", message: "Permissão de microfone negada ou erro ao acessar o dispositivo de áudio." });
            setIsErrorModalOpen(true);
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    // Effect to generate previews and handle cleanup
    useEffect(() => {
        const newPreviews: string[] = [];
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newPreviews.push(reader.result as string);
                if (newPreviews.length === imageFiles.length) {
                    setImagePreviews(newPreviews);
                }
            };
            reader.readAsDataURL(file);
        });
        
        if (imageFiles.length === 0) {
            setImagePreviews([]);
        }

        return () => {
            // Revoke object URLs when component unmounts or files change
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [imageFiles, imagePreviews]);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            setActiveTab('text');
            setText('');
            setImageFiles([]);
            setImagePreviews([]);
            setAudioBlob(null);
            setAudioUrl(null);
            setIsRecording(false);
            setError(null);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }
    }, [isOpen]);

    const handleTabChange = (tab: 'text' | 'image' | 'audio') => {
        if (!isProcessing) {
            setActiveTab(tab);
            setError(null); // Clear error on tab switch
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
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
            onProcess(processData);
        } else {
            setError("Forneça um conteúdo para processar.");
        }
    };
    
    const isProcessable = (activeTab === 'text' && !!text.trim()) || (activeTab === 'image' && imageFiles.length > 0) || (activeTab === 'audio' && !!audioBlob);

    const footer = (
        <div className="flex justify-end gap-3">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="aiMeasurementForm"
                disabled={isProcessing || !isProcessable}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
                {isProcessing ? (
                    <div className="flex items-center gap-2">
                        <div className="loader-sm"></div>
                        Processando...
                    </div>
                ) : (
                    'Extrair Medidas'
                )}
            </button>
        </div>
    );

    const TabButton: React.FC<{tab: 'text'|'image'|'audio', icon: string, children: React.ReactNode}> = ({tab, icon, children}) => (
        <button
            type="button"
            onClick={() => handleTabChange(tab)}
            disabled={isProcessing}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
            <i className={icon}></i>
            {children}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Extrair Medidas com IA" footer={footer}>
            <form id="aiMeasurementForm" onSubmit={handleSubmit} className="space-y-4">
                 <div className="flex space-x-2 p-1 bg-slate-100 rounded-lg">
                    <TabButton tab="text" icon="fas fa-font">Texto</TabButton>
                    <TabButton tab="image" icon="fas fa-image">Imagem</TabButton>
                    {provider === 'gemini' && (
                        <TabButton tab="audio" icon="fas fa-microphone">Áudio</TabButton>
                    )}
                </div>

                <div className="min-h-[250px] flex flex-col justify-center items-center">
                    {activeTab === 'text' && (
                        <>
                            <p className="text-xs text-slate-500 mb-2 self-start">
                                Ex: <span className="italic">5 janelas de 1.20 por 2.10 na sala, 2 vidros fixos 0.80x1.50 no escritório.</span>
                            </p>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Descreva ou cole as medidas aqui..."
                                className="w-full h-48 p-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                                disabled={isProcessing}
                            />
                        </>
                    )}
                    {activeTab === 'image' && (
                        <div className="w-full text-center flex flex-col items-center justify-center">
                             {imagePreviews.length > 0 && (
                                <div className="w-full mb-2">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-100 rounded-lg">
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
                                    className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-slate-500 bg-slate-100' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'} ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <label htmlFor="image-upload" className={isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}>
                                        <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 mb-2"></i>
                                        <p className="text-slate-600 text-sm">Arraste e solte imagens aqui, ou <span className="font-semibold text-slate-800">clique para selecionar</span>.</p>
                                        <p className="text-xs text-slate-500 mt-1">
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
                                    <button type="button" onClick={stopRecording} disabled={isProcessing} className="px-6 py-2 bg-red-600 text-white rounded-full font-semibold shadow-md hover:bg-red-700">
                                        Parar Gravação
                                    </button>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-microphone text-3xl text-slate-400 mb-3"></i>
                                    <p className="text-slate-600 mb-4">Clique no botão para começar a gravar o áudio com as medidas.</p>
                                    <button type="button" onClick={startRecording} disabled={isProcessing} className="px-6 py-2 bg-slate-800 text-white rounded-full font-semibold shadow-md hover:bg-slate-700">
                                        Iniciar Gravação
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2 mt-3">
                    <p className="text-xs text-yellow-800 font-medium">
                        ⚠️ <strong>Aviso de Responsabilidade:</strong> O uso desta funcionalidade envia dados (como descrições de medidas) para o provedor de IA escolhido. O custo e a responsabilidade pelo uso da API são inteiramente do usuário. A Películas Brasil não cobra pelo uso desta funcionalidade e não se responsabiliza pelo processamento de dados por terceiros.
                    </p>
                </div>
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md mt-2" role="alert">
                        {error}
                    </div>
                )}
            </form>
            <style jsx>{`
                .loader-sm {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #fff;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </Modal>
        <ErrorModal
            isOpen={isErrorModalOpen}
            onClose={() => setIsErrorModalOpen(false)}
            title={errorModalContent.title}
            message={errorModalContent.message}
        />
        </>
    );
};

export default AIMeasurementModal;