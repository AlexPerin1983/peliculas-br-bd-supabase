
import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => void;
    currentApiKey?: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
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
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar Chave de API (IA)" footer={footer}>
            <form id="apiKeyForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="text-sm text-slate-500 space-y-2">
                    <p>
                        Esta aplicação utiliza o Google Gemini para a funcionalidade "Preencher com IA".
                    </p>
                    <p>
                        No ambiente de desenvolvimento (Google AI Studio), uma chave de API de teste é utilizada por padrão. Para usar esta aplicação em produção ou de forma independente, você deve inserir sua própria chave de API. Você pode obter uma gratuitamente no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
                    </p>
                </div>
                <Input
                    id="apiKey"
                    label="Sua Chave de API do Google Gemini"
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
