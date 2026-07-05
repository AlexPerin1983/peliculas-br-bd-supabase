import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserInfo, Film, AIInput } from '../../types';
import { GEMINI_TEXT_MODEL } from '../lib/geminiModel';

export interface ExtractedEstoqueItem {
    tipo?: 'bobina' | 'retalho';
    filmId?: string;
    largura?: string;
    comprimento?: string;
    quantidade?: number;
    fornecedor?: string;
    lote?: string;
    custo?: string;
    localizacao?: string;
    observacao?: string;
}

const blobToBase64 = (blob: Blob): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const parts = base64data.split(',');
            const mimeType = parts[0].match(/:(.*?);/)?.[1] || blob.type;
            resolve({ mimeType, data: parts[1] });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const buildPrompt = (films: Film[], activeTab: 'bobinas' | 'retalhos') => `
Você é um assistente de controle de estoque de películas (insulfilm). O usuário descreve, por áudio ou texto em português, UM item de estoque para cadastrar: uma BOBINA (rolo novo de película) ou um RETALHO (sobra/pedaço de película).

**Películas cadastradas (use EXATAMENTE um destes nomes no campo filmId se o que foi falado corresponder a um deles, mesmo com pronúncia ou grafia aproximada):**
${films.map((f) => `- ${f.nome}`).join('\n') || '- (nenhuma cadastrada)'}

**Como decidir o tipo:**
- Palavras como "bobina", "rolo", "bobina nova" => tipo "bobina".
- Palavras como "retalho", "sobra", "pedaço", "recorte" => tipo "retalho".
- Se não ficar claro, use "${activeTab === 'bobinas' ? 'bobina' : 'retalho'}" (aba atual do usuário).

**Regras de medidas (CRÍTICO):**
- largura: se falada em METROS, retorne decimal com vírgula (ex: "1,52"). Se falada em CENTÍMETROS, retorne número inteiro sem vírgula (ex: "152"). NUNCA converta entre unidades: preserve a unidade falada nesses dois formatos.
- comprimento de BOBINA: sempre em metros, número simples com vírgula se decimal (ex: "30" ou "30,5").
- comprimento de RETALHO: mesma regra da largura (metros => "0,55"; centímetros => "55").
- Ex.: "um metro e cinquenta e dois" => "1,52". "sessenta centímetros" => "60".

**Outros campos:**
- quantidade: só para retalhos iguais (ex: "3 retalhos de..."). Número inteiro. Se não falado, omita.
- fornecedor, lote: só para bobina, se mencionados.
- custo: só para bobina, apenas números com ponto decimal (ex: "1500.00"), se mencionado.
- localizacao: onde o item fica guardado (ex: "Prateleira A"), se mencionado.
- observacao: qualquer detalhe extra relevante que não caiba nos outros campos.
- filmId: nome da película. Se não corresponder a nenhuma da lista, retorne como foi falado, com iniciais maiúsculas.

Responda APENAS com um objeto JSON válido, sem markdown, contendo somente os campos identificados dentre: tipo, filmId, largura, comprimento, quantidade, fornecedor, lote, custo, localizacao, observacao. Se não conseguir identificar nada útil, retorne {}.
`;

export const useEstoqueAI = (userInfo: UserInfo | null) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const processEstoqueItem = useCallback(async (
        input: AIInput,
        films: Film[],
        activeTab: 'bobinas' | 'retalhos'
    ): Promise<ExtractedEstoqueItem> => {
        if (userInfo?.aiConfig?.provider !== 'gemini' || !userInfo.aiConfig.apiKey) {
            throw new Error("Configure o provedor Gemini e sua chave de API na aba 'Empresa' para usar esta funcionalidade.");
        }

        setIsProcessing(true);
        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

            const parts: any[] = [buildPrompt(films, activeTab)];
            if (input.text) parts.push(input.text);
            if (input.audio) {
                const { mimeType, data } = await blobToBase64(input.audio);
                parts.push({ inlineData: { mimeType, data } });
            }
            if (input.images) {
                for (const file of input.images) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            }

            const result = await model.generateContent(parts);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Não consegui interpretar o que foi dito. Tente falar a película e as medidas, ex: "retalho de Blackout, 60 por 120 centímetros".');
            }

            const item = JSON.parse(jsonMatch[0]) as ExtractedEstoqueItem;
            if (!item.filmId && !item.largura && !item.comprimento) {
                throw new Error('Não identifiquei película nem medidas. Tente novamente, ex: "bobina de Suntek, 1,52 de largura por 30 metros".');
            }

            return item;
        } finally {
            setIsProcessing(false);
        }
    }, [userInfo]);

    return { processEstoqueItem, isProcessing };
};
