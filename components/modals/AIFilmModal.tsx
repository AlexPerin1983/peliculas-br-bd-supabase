import React from 'react';
import { AIInput } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIFilmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai';
}

const AIFilmModal: React.FC<AIFilmModalProps> = props => (
    <AIComposerModal
        {...props}
        title="Película com IA"
        intro="Anexe a ficha técnica em PDF, fotografe a caixa ou descreva a película. A IA preenche as especificações e você revisa antes de salvar."
        textPlaceholder="Descreva ou cole as informações da película…"
        textExample="Película G5, R$ 100 o metro, bloqueia 99% de UV e 50% do calor."
        filesHint="Ficha técnica do fornecedor em PDF, foto da caixa ou da etiqueta da bobina."
        voiceHint="Fale o nome, o preço e as especificações da película."
        submitLabel="Preencher película"
        stages={['Lendo o conteúdo…', 'Encontrando as especificações…', 'Preenchendo o cadastro…']}
    />
);

export default AIFilmModal;
