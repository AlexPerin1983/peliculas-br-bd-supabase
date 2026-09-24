import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIMeasurementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIMeasurementModal: React.FC<AIMeasurementModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Medidas com IA"
        intro="Escreva, fotografe, anexe um PDF ou fale as medidas. A Inteligência Artificial monta seu orçamento."
        textPlaceholder="Descreva ou cole as medidas…"
        textExample="5 janelas de 1,20 por 2,10 na sala, 2 vidros fixos 0,80 x 1,50 no escritório."
        filesHint="Foto da trena ou do rascunho, print do WhatsApp ou PDF com a lista de medidas."
        voiceHint="Fale as medidas e onde ficam. Ex.: “três janelas de 1,20 por 2,10 na sala”."
        submitLabel="Preencher medidas"
        stages={['Lendo o conteúdo…', 'Encontrando as medidas…', 'Montando a lista…']}
    />
);

export default AIMeasurementModal;
