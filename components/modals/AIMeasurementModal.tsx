import React, { useState, useEffect, useRef, FormEvent, DragEvent } from 'react';
import Modal from '../ui/Modal';

interface AIMeasurementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => Promise<void>;
    isProcessing: boolean;
}

const MAX_IMAGES = 5;

const AIMeasurementModal: React.FC<AIMeasurementModalProps> = ({ isOpen, onClose, onProcess, isProcessing }) => {
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
                 alert(`Você pode enviar no máximo ${MAX_IMAGES} imagens.`);
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
    
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
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
            alert("Forneça um conteúdo para processar.");
        }
    };
    
    const isProcessable = (activeTab === 'text' && !!text.trim()) || (activeTab === 'image' && imageFiles.length > 0) || (activeTab === 'audio' && !!audioBlob);

    const footer = (
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 disabled:opacity-50" disabled={isProcessing}>
          Cancelar
        </button>
        <button
          type="submit"
          form="aiForm"
          className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700 min-w-[120px] disabled:bg-slate-500 disabled:cursor-wait"
          disabled={isProcessing || !isProcessable}
        >
          {isProcessing ? (
            <div className="loader-sm mx-auto"></div>
          ) : (
            'Processar'
          )}
        </button>
      </>
    );

    const TabButton: React.FC<{tab: 'text'|'image'|'audio', icon: string, children: React.ReactNode}> = ({tab, icon, children}) => (
        <button
            type="button"
            onClick={() => handleTabChange(tab)}
            disabled={isProcessing}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
            <i className={icon}></i>
            {children}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Preenchimento Automático com IA" footer={footer}>
            <form id="aiForm" onSubmit={handleSubmit} className="space-y-4">
                 <div className="flex space-x-2 p-1 bg-slate-100 rounded-lg">
                    <TabButton tab="text" icon="fas fa-font">Texto</TabButton>
                    <TabButton tab="image" icon="fas fa-image">Imagem</TabButton>
                    <TabButton tab="audio" icon="fas fa-microphone">Áudio</TabButton>
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
                                        <p className="text-xs text-slate-500 mt-1">Até {MAX_IMAGES} imagens. Pode ser uma foto, um print ou um rascunho.</p>
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
                                    <button type="button" onClick={startRecording} disabled={isProcessing} className="px-6 py-2 bg-slate-800 text-white rounded-full font-semibold shadow-md hover:bg-slate-700">
                                        Iniciar Gravação
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
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
    );
};

export default AIMeasurementModal;