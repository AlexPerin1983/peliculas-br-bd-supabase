import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => void;
    currentApiKey?: string;
    provider: 'gemini' | 'openai';
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey, provider }) => {
    const [apiKey, setApiKey] = useState(currentApiKey || '');

    useEffect(() => {
        if (isOpen) {
            setApiKey(currentApiKey || '');
        }
    }, [isOpen, currentApiKey]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(apiKey);
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
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Cancelar
            </button>
            <button
                type="submit"
                form="apiKeyForm"
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                Salvar Chave
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Configurar Chave de API (${currentProvider.name})`} footer={footer}>
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
            </form>
        </Modal>
    );
};

export default ApiKeyModal;