import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => Promise<void>;
    currentApiKey?: string;
    provider: 'gemini' | 'openai';
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey, provider }) => {
    const [apiKey, setApiKey] = useState(currentApiKey || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setApiKey(currentApiKey || '');
            setIsSaving(false);
            setError(null);
        }
    }, [isOpen, currentApiKey]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        setError(null);
        try {
            await onSave(apiKey);
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar chave de API. Tente novamente.');
            setIsSaving(false);
        }
    };

    const providerInfo = {
        gemini: {
            name: 'Google Gemini',
            url: 'https://aistudio.google.com/app/apikey',
        },
        openai: {
            name: 'OpenAI',
            url: 'https://platform.openai.com/api-keys',
        }
    };
    const currentProvider = providerInfo[provider];

    const footer = (
        <>
            <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
                Cancelar
            </button>
            <button
                type="submit"
                form="apiKeyForm"
                disabled={isSaving || !apiKey.trim()}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700 disabled:opacity-70 disabled:cursor-wait flex items-center gap-2"
            >
                {isSaving ? (
                    <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Salvando...</span>
                    </>
                ) : (
                    'Salvar Chave'
                )}
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={isSaving ? () => {} : onClose} title={`Configurar Chave de API (${currentProvider.name})`} footer={footer} disableClose={isSaving}>
            <form id="apiKeyForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="text-sm text-slate-500 space-y-2">
                    <p>
                        Esta aplicação utiliza o {currentProvider.name} para a funcionalidade "Preencher com IA".
                    </p>
                    <p>
                        Você deve inserir sua própria chave de API. Você pode obter uma no site da <a href={currentProvider.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{currentProvider.name}</a>.
                    </p>
                </div>
                <Input
                    id="apiKey"
                    label={`Sua Chave de API do ${currentProvider.name}`}
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Cole sua chave aqui"
                />
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default ApiKeyModal;
