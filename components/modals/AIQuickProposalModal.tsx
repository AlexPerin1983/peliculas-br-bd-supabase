import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIQuickProposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai' | 'local_ocr';
}

const AIQuickProposalModal: React.FC<AIQuickProposalModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Proposta rápida com IA"
        intro="Mande o atendimento como vier: conversa, fotos, PDF ou áudio. A IA cria cliente, medidas e proposta para você revisar."
        textPlaceholder="Cole ou descreva cliente, endereço, medidas e película…"
        textExample="Cliente Maria, 83 99999-8888, Rua A 123. Sala: 2 janelas 1,20 x 1,50 fumê; quarto: 1 janela 0,80 x 1,20."
        filesHint="Prints da conversa, fotos das medidas ou pedido de orçamento em PDF."
        voiceHint="Conte o atendimento: quem é o cliente, onde fica e as medidas."
        submitLabel="Criar proposta"
        stages={['Analisando o atendimento…', 'Montando cliente e medidas…', 'Criando a proposta…']}
        keyboardAwareFooter
    />
);

export default AIQuickProposalModal;
