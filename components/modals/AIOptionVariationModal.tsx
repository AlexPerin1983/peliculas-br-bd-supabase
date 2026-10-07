import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIOptionVariationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIOptionVariationModal: React.FC<AIOptionVariationModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Nova opção com IA"
        intro="Diga o que muda na nova opção. A IA monta as trocas de película e você confere antes de gerar."
        textPlaceholder="O que muda na nova opção…"
        textExample="Mantém o jateado e troca a outra pela Window Premium."
        filesHint="Print do pedido do cliente, se ele mandou por escrito."
        voiceHint="Ex.: “mantém o jateado e troca a outra pela Window Premium”."
        submitLabel="Montar nova opção"
        stages={['Entendendo o pedido…', 'Conferindo as películas…', 'Montando a nova opção…']}
        processingNote="Leva alguns segundos. Você confere as trocas antes de gerar."
        initialMode="voice"
        keyboardAwareFooter
    />
);

export default AIOptionVariationModal;
