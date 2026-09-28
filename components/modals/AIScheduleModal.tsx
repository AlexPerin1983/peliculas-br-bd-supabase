import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai' | 'local_ocr';
}

// Abre direto no microfone: a pessoa fala e confere o agendamento antes de salvar.
const AIScheduleModal: React.FC<AIScheduleModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Agendamento com IA"
        intro="Fale o nome do cliente, o local, o dia e a hora. A IA preenche o agendamento e você confere antes de salvar."
        textPlaceholder="Cliente, local, dia e hora…"
        textExample="Maria Souza, Rua das Flores 120, Centro, sexta às 9h."
        filesHint="Print da conversa em que o cliente combinou o dia e o horário."
        voiceHint="Ex.: “Maria Souza, Rua das Flores 120, sexta às 9 da manhã”."
        submitLabel="Preencher agendamento"
        stages={['Entendendo o pedido…', 'Separando dia e horário…', 'Montando o agendamento…']}
        initialMode="voice"
        keyboardAwareFooter
    />
);

export default AIScheduleModal;
