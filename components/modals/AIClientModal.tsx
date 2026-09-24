import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIClientModal: React.FC<AIClientModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Cliente com IA"
        intro="Cole a conversa, fotografe um cartão ou anexe um PDF. A IA preenche o cadastro e você revisa antes de salvar."
        textPlaceholder="Cole ou descreva os dados do cliente…"
        textExample="João da Silva, 11 99999-8888, joao@email.com, Rua das Flores 123, São Paulo - SP, CEP 01234-567."
        filesHint="Print da conversa, cartão de visita, cartão CNPJ ou pedido em PDF."
        voiceHint="Fale nome, telefone e endereço do cliente."
        submitLabel="Preencher cliente"
        stages={['Lendo o conteúdo…', 'Encontrando os dados do cliente…', 'Preenchendo o cadastro…']}
    />
);

export default AIClientModal;
