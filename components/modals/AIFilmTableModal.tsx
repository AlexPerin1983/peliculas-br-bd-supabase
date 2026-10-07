import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIFilmTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIFilmTableModal: React.FC<AIFilmTableModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Importar tabela com IA"
        intro="Envie a tabela de preços ou o catálogo do fornecedor. A IA lista as películas e você escolhe quais cadastrar."
        textPlaceholder="Cole a tabela ou a lista de películas…"
        textExample="3M G5 bobina 1,52 x 30 m R$ 1.500; 3M G20 R$ 1.500; Nano Cerâmica 70 R$ 2.400."
        filesHint="Tabela de preços em PDF ou foto do catálogo do fornecedor."
        voiceHint="Fale o nome, a marca e o preço de cada película."
        submitLabel="Ler tabela"
        stages={['Lendo a tabela…', 'Separando as películas…', 'Montando a lista…']}
    />
);

export default AIFilmTableModal;
