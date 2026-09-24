import React, { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, FileText, Loader2, Mic, Paperclip, RotateCcw, Sparkles, Square, Trash2, Type, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../../src/contexts/FeedbackContext';
import { AIInput } from '../../../types';
import { AI_MAX_FILES, AI_MAX_PDF_BYTES, AI_MAX_TOTAL_BYTES, AIFileKind, formatFileSize, getAIFileKind, prepareAIFile } from './aiFiles';

type Mode = 'text' | 'files' | 'voice';

interface AttachedFile {
    id: string;
    file: File;
    kind: AIFileKind;
    previewUrl?: string;
}

export interface AIComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai' | 'local_ocr';
    title: string;
    /** Frase curta explicando o que a IA faz nesta tela. */
    intro: string;
    textPlaceholder: string;
    textExample: string;
    /** O que costuma ser enviado como arquivo (ex.: "print do WhatsApp, rascunho ou PDF com a lista"). */
    filesHint: string;
    voiceHint: string;
    submitLabel: string;
    /** Mensagens mostradas em sequência enquanto a IA trabalha. */
    stages: string[];
    keyboardAwareFooter?: boolean;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Entrada única das telas de IA: texto, foto/PDF e voz podem ser combinados
 * e seguem juntos numa só chamada. Mobile-first: alvos grandes, nada escondido no hover.
 */
const AIComposerModal: React.FC<AIComposerModalProps> = ({
    isOpen, onClose, onProcess, isProcessing, provider, title, intro,
    textPlaceholder, textExample, filesHint, voiceHint, submitLabel, stages, keyboardAwareFooter,
}) => {
    const { showAlert, showToast } = useFeedback();
    const allowPdf = provider === 'gemini';
    const allowVoice = provider === 'gemini';

    const [mode, setMode] = useState<Mode>('text');
    const [text, setText] = useState('');
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const [stageIndex, setStageIndex] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const filesRef = useRef<AttachedFile[]>([]);
    filesRef.current = files;

    const stopStream = () => recorderRef.current?.stream.getTracks().forEach(track => track.stop());

    // Libera prévias, áudio e microfone ao fechar.
    useEffect(() => () => {
        stopStream();
        filesRef.current.forEach(item => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    }, []);
    useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

    useEffect(() => {
        if (!isRecording) return;
        const timer = window.setInterval(() => setRecordSeconds(value => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, [isRecording]);

    // Avança as mensagens de progresso enquanto processa.
    useEffect(() => {
        if (!isProcessing) { setStageIndex(0); return; }
        const timer = window.setInterval(() => setStageIndex(index => Math.min(index + 1, stages.length - 1)), 1600);
        return () => window.clearInterval(timer);
    }, [isProcessing, stages.length]);

    const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);

    const addFiles = async (list: FileList | null) => {
        if (!list?.length) return;
        setIsPreparing(true);
        const next: AttachedFile[] = [];
        let running = totalBytes;
        try {
            for (const raw of Array.from(list)) {
                if (files.length + next.length >= AI_MAX_FILES) {
                    showToast(`Envie no máximo ${AI_MAX_FILES} arquivos por vez.`, { tone: 'warning' });
                    break;
                }
                const kind = getAIFileKind(raw);
                if (!kind || (kind === 'pdf' && !allowPdf)) {
                    showToast(`"${raw.name}" não é ${allowPdf ? 'uma foto ou PDF' : 'uma foto'}.`, { tone: 'error' });
                    continue;
                }
                if (kind === 'pdf' && raw.size > AI_MAX_PDF_BYTES) {
                    showToast(`O PDF "${raw.name}" tem ${formatFileSize(raw.size)}. O limite é ${formatFileSize(AI_MAX_PDF_BYTES)}.`, { tone: 'error' });
                    continue;
                }
                const file = await prepareAIFile(raw);
                if (running + file.size > AI_MAX_TOTAL_BYTES) {
                    showToast(`Os arquivos passaram de ${formatFileSize(AI_MAX_TOTAL_BYTES)}. Remova algum ou envie menos páginas.`, { tone: 'warning' });
                    break;
                }
                running += file.size;
                next.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    file,
                    kind,
                    previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
                });
            }
        } finally {
            setIsPreparing(false);
        }
        if (next.length) setFiles(previous => [...previous, ...next]);
    };

    const removeFile = (id: string) => setFiles(previous => {
        const target = previous.find(item => item.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        return previous.filter(item => item.id !== id);
    });

    const onDrag = (event: DragEvent<HTMLElement>, entering: boolean) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isProcessing) setIsDragging(entering);
    };

    const onDrop = (event: DragEvent<HTMLElement>) => {
        onDrag(event, false);
        void addFiles(event.dataTransfer.files);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            recorder.ondataavailable = event => chunksRef.current.push(event.data);
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
                chunksRef.current = [];
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stopStream();
            };
            recorderRef.current = recorder;
            chunksRef.current = [];
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordSeconds(0);
            recorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            showAlert({ title: 'Microfone indisponível', message: 'Não foi possível acessar o microfone. Verifique as permissões do navegador.', tone: 'error' });
        }
    };

    const stopRecording = () => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        setIsRecording(false);
    };

    const discardAudio = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordSeconds(0);
    };

    const hasText = !!text.trim();
    const hasContent = hasText || files.length > 0 || !!audioBlob;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (isProcessing || isPreparing) return;
        if (!hasContent) {
            showToast('Escreva, anexe um arquivo ou grave um áudio para continuar.', { tone: 'warning' });
            return;
        }
        if (isRecording) stopRecording();
        setErrorMessage(null);
        try {
            // Tudo junto numa só chamada: texto, fotos/PDF e áudio se completam.
            await onProcess({
                text: hasText ? text : undefined,
                images: files.length ? files.map(item => item.file) : undefined,
                audio: audioBlob || undefined,
            });
        } catch (error: any) {
            setErrorMessage(error?.message || 'Não foi possível processar. Tente novamente.');
        }
    };

    const sources = [
        hasText && 'texto',
        files.length && `${files.length} ${files.length === 1 ? 'arquivo' : 'arquivos'}`,
        audioBlob && 'áudio',
    ].filter(Boolean) as string[];

    const modes: { id: Mode; label: string; icon: React.ReactNode; filled: boolean }[] = [
        { id: 'text', label: 'Texto', icon: <Type size={16} aria-hidden="true" />, filled: hasText },
        { id: 'files', label: allowPdf ? 'Foto/PDF' : 'Foto', icon: <Paperclip size={16} aria-hidden="true" />, filled: files.length > 0 },
        ...(allowVoice ? [{ id: 'voice' as Mode, label: 'Voz', icon: <Mic size={16} aria-hidden="true" />, filled: !!audioBlob }] : []),
    ];

    const footer = (
        <div className="w-full">
            {sources.length > 0 && !isProcessing && (
                <p className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">Vai enviar: {sources.join(' + ')}</p>
            )}
            <button type="submit" form="aiComposerForm" disabled={isProcessing || isPreparing || !hasContent} aria-busy={isProcessing}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[15px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white sm:ml-auto sm:w-auto sm:min-w-[220px] sm:px-6">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {isProcessing ? 'Processando…' : submitLabel}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} fullScreenOnMobile keyboardAwareFooter={keyboardAwareFooter}>
            <form id="aiComposerForm" onSubmit={handleSubmit} aria-busy={isProcessing} className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{intro}</p>

                {/* Modo de entrada: segmented control com marcador quando já tem conteúdo. */}
                <div role="tablist" aria-label="Forma de envio" className="grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80" style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
                    {modes.map(item => (
                        <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} disabled={isProcessing}
                            onClick={() => setMode(item.id)}
                            className={`flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors ${mode === item.id
                                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                            {item.filled && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-label="com conteúdo" />}
                        </button>
                    ))}
                </div>

                <div className="relative min-h-[260px]">
                    {mode === 'text' && (
                        <div className="flex flex-col gap-2">
                            <textarea value={text} onChange={event => setText(event.target.value)} disabled={isProcessing} placeholder={textPlaceholder}
                                className="min-h-[200px] w-full resize-none rounded-xl border-0 bg-slate-100 p-3.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-500" />
                            <div className="flex items-start justify-between gap-3 px-1">
                                <p className="min-w-0 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">Exemplo: </span>{textExample}
                                </p>
                                {!hasText && (
                                    <button type="button" onClick={() => setText(textExample)} disabled={isProcessing}
                                        className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">Usar</button>
                                )}
                            </div>
                        </div>
                    )}

                    {mode === 'files' && (
                        <div className="flex flex-col gap-3" onDragEnter={event => onDrag(event, true)} onDragOver={event => onDrag(event, true)}
                            onDragLeave={event => onDrag(event, false)} onDrop={onDrop}>
                            {files.length < AI_MAX_FILES && (
                                <div className={`grid grid-cols-2 gap-2 rounded-xl transition-colors ${isDragging ? 'ring-2 ring-blue-400' : ''}`}>
                                    <label htmlFor="ai-composer-camera" className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 ${isProcessing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                                        <Camera className="h-5 w-5" aria-hidden="true" />
                                        <span className="text-[13px] font-semibold">Tirar foto</span>
                                    </label>
                                    <label htmlFor="ai-composer-files" className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 ${isProcessing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                                        {allowPdf ? <FileText className="h-5 w-5" aria-hidden="true" /> : <Paperclip className="h-5 w-5" aria-hidden="true" />}
                                        <span className="text-[13px] font-semibold">{allowPdf ? 'Escolher arquivo' : 'Escolher foto'}</span>
                                    </label>
                                </div>
                            )}
                            <input id="ai-composer-camera" type="file" accept="image/*" capture="environment" className="hidden"
                                disabled={isProcessing} onChange={event => { void addFiles(event.target.files); event.target.value = ''; }} />
                            <input id="ai-composer-files" type="file" accept={allowPdf ? 'image/*,application/pdf' : 'image/*'} multiple className="hidden"
                                disabled={isProcessing} onChange={event => { void addFiles(event.target.files); event.target.value = ''; }} />

                            {files.length === 0 ? (
                                <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    {filesHint} Até {AI_MAX_FILES} arquivos{allowPdf ? `; PDF até ${formatFileSize(AI_MAX_PDF_BYTES)}` : ''}.
                                    <span className="hidden sm:inline"> Você também pode arrastar para cá.</span>
                                </p>
                            ) : (
                                <ul className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl bg-slate-100 dark:divide-slate-700/70 dark:bg-slate-800/80">
                                    {files.map(item => (
                                        <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                                            {item.kind === 'image' ? (
                                                <img src={item.previewUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                                            ) : (
                                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                                    <FileText className="h-5 w-5" aria-hidden="true" />
                                                </span>
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.file.name}</span>
                                                <span className="block text-xs text-slate-500 dark:text-slate-400">{item.kind === 'pdf' ? 'PDF' : 'Foto'} · {formatFileSize(item.file.size)}</span>
                                            </span>
                                            <button type="button" onClick={() => removeFile(item.id)} disabled={isProcessing} aria-label={`Remover ${item.file.name}`}
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-700">
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {files.length > 0 && (
                                <p className="px-1 text-xs text-slate-500 dark:text-slate-400">{files.length} de {AI_MAX_FILES} · {formatFileSize(totalBytes)}</p>
                            )}
                            {isPreparing && (
                                <p className="flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Preparando arquivo…
                                </p>
                            )}
                        </div>
                    )}

                    {mode === 'voice' && (
                        <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl bg-slate-100 px-4 py-6 text-center dark:bg-slate-800/80">
                            {audioUrl ? (
                                <>
                                    <audio src={audioUrl} controls className="w-full" />
                                    <div className="flex gap-2">
                                        <button type="button" onClick={startRecording} disabled={isProcessing}
                                            className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700">
                                            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Gravar de novo
                                        </button>
                                        <button type="button" onClick={discardAudio} disabled={isProcessing}
                                            className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                                            <Trash2 className="h-4 w-4" aria-hidden="true" /> Descartar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isProcessing}
                                        aria-label={isRecording ? 'Parar gravação' : 'Começar a gravar'}
                                        className={`grid h-20 w-20 place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${isRecording ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900'}`}>
                                        {isRecording ? <Square className="h-7 w-7 fill-current" aria-hidden="true" /> : <Mic className="h-8 w-8" aria-hidden="true" />}
                                    </button>
                                    <div>
                                        <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                                            {isRecording ? `Gravando ${formatTime(recordSeconds)}` : 'Toque para gravar'}
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                            {isRecording ? 'Toque de novo para parar.' : voiceHint}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {isProcessing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/95 text-center dark:bg-slate-900/95" aria-live="polite">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-900 dark:text-slate-100" aria-hidden="true" />
                            <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{stages[stageIndex] || 'Processando…'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Leva alguns segundos. Você revisa tudo antes de salvar.</p>
                        </div>
                    )}

                    {errorMessage && !isProcessing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/95 p-4 text-center dark:bg-slate-900/95" role="alert">
                            <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{errorMessage}</p>
                            <button type="button" onClick={() => setErrorMessage(null)}
                                className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                                <X className="h-4 w-4" aria-hidden="true" /> Voltar e ajustar
                            </button>
                        </div>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default AIComposerModal;
