import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserInfo, Film } from '../../types';

// Interface para dados extraídos de clientes (copiada do App.tsx)
interface ExtractedClientData {
    nome?: string;
    telefone?: string;
    email?: string;
    cpfCnpj?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
}

export const useAIProcessing = (
    userInfo: UserInfo | null,
    showError: (message: string) => void
) => {
    const [isProcessingAI, setIsProcessingAI] = useState(false);

    // Converte Blob para Base64
    const blobToBase64 = (blob: Blob): Promise<{ mimeType: string, data: string }> => {
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

    // Processa dados de cliente com Gemini
    const processClientDataWithGemini = async (
        input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }
    ): Promise<ExtractedClientData | null> => {
        if (!userInfo?.aiConfig?.apiKey) {
            throw new Error("Chave de API do Gemini não configurada.");
        }

        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const prompt = `
                Você é um assistente especialista em extração de dados de clientes.Sua tarefa é extrair o máximo de informações de contato, endereço completo(incluindo CEP, logradouro, número, bairro, cidade e UF) e documento(CPF ou CNPJ) de um cliente a partir da entrada fornecida(texto, imagem ou áudio).
                
                ** Instrução Principal:** Analise todo o texto de entrada em busca de dados.Não pare no primeiro dado encontrado.
                
                ** Regra para Nome:** Identifique o nome do cliente.Se a entrada for apenas "Nome Telefone", separe - os.
                
                ** Regra de Extração de Números(CRÍTICO):**
            Varra o texto procurando por sequências numéricas.Use palavras - chave como "cep", "cpf", "cnpj", "tel", "cel" como dicas fortes, mas identifique também números soltos baseando - se na contagem de dígitos(ignorando símbolos):
                  - ** CNPJ:** 14 dígitos. (Ex: 28533595000160).Se encontrar, preencha o campo 'cpfCnpj'.
                  - ** CPF:** 11 dígitos. (Ex: 12345678900).Se encontrar, preencha o campo 'cpfCnpj'.
                  - ** Telefone:** 10 ou 11 dígitos(DDD + Número). (Ex: 83999998888).
                  - ** CEP:** 8 dígitos. (Ex: 58056170).
                
                ** Regra Crítica para Telefone:** Remova código de país(+55).Mantenha apenas DDD + Número.
                
                ** Formatação de Saída:** Retorne TODOS os campos numéricos(Telefone, CPF, CNPJ, CEP) APENAS com dígitos(string pura de números), removendo qualquer formatação original(pontos, traços, espaços).
                
                ** Endereço:** Tente separar inteligentemente o logradouro, número, bairro e cidade se estiverem misturados.
                
                ** Regra para UF:** O campo UF deve conter APENAS a sigla do estado(2 letras). ** SE NÃO ENCONTRAR, RETORNE UMA STRING VAZIA "".JAMAIS RETORNE A PALAVRA "string".**

            Responda APENAS com um objeto JSON válido, sem markdown, contendo os campos: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf.
            `;

            const parts: any[] = [prompt];

            if (input.type === 'text') {
                parts.push(input.data as string);
            } else if (input.type === 'image') {
                for (const file of input.data as File[]) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            } else if (input.type === 'audio') {
                const { mimeType, data } = await blobToBase64(input.data as Blob);
                parts.push({ inlineData: { mimeType, data } });
            }

            const result = await model.generateContent(parts);
            const response = await result.response;

            // Tenta fazer o parse do JSON
            try {
                const extractedData = JSON.parse(response.text());
                return extractedData as ExtractedClientData;
            } catch (e) {
                console.error("Erro de JSON.parse:", e);
                // Se o parse falhar, tenta limpar a string
                const jsonText = response.text().trim();
                const start = jsonText.indexOf('{');
                const end = jsonText.lastIndexOf('}');

                if (start !== -1 && end !== -1 && end > start) {
                    const cleanedJson = jsonText.substring(start, end + 1);
                    try {
                        const extractedData = JSON.parse(cleanedJson);
                        console.log("JSON corrigido com sucesso.");
                        return extractedData as ExtractedClientData;
                    } catch (e2) {
                        throw new Error(`A resposta da IA não é um JSON válido.Erro: ${e instanceof Error ? e.message : 'JSON malformado'} `);
                    }
                }

                throw new Error(`A resposta da IA não é um JSON válido.Erro: ${e instanceof Error ? e.message : 'JSON malformado'} `);
            }

        } catch (error) {
            console.error("Erro ao processar dados do cliente com Gemini:", error);
            throw error;
        }
    };

    // Processa dados de cliente (handler principal)
    const processClientWithAI = useCallback(async (
        input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }
    ): Promise<ExtractedClientData | null> => {
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            showError("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return null;
        }

        setIsProcessingAI(true);
        let extractedData: ExtractedClientData | null = null;

        try {
            if (userInfo.aiConfig.provider === 'gemini') {
                extractedData = await processClientDataWithGemini(input);
            } else if (userInfo.aiConfig.provider === 'openai') {
                if (input.type === 'audio') {
                    showError("O provedor OpenAI não suporta entrada de áudio para esta funcionalidade.");
                    return null;
                }
                showError("O preenchimento de dados do cliente com OpenAI ainda não está totalmente implementado. Por favor, use o Gemini ou preencha manualmente.");
                return null;
            }

            return extractedData;

        } catch (error) {
            console.error("Erro ao processar dados do cliente com IA:", error);
            showError(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)} `);
            return null;
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, showError]);

    // Processa dados de película com IA
    const processFilmWithAI = useCallback(async (
        input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }
    ): Promise<Partial<Film> | null> => {
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            showError("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return null;
        }

        setIsProcessingAI(true);

        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const prompt = `Você é um assistente especialista em extração de dados de películas automotivas (insulfilm). Sua tarefa é extrair o máximo de informações técnicas de películas a partir da entrada fornecida (texto ou imagem). Retorne APENAS um objeto JSON válido, sem markdown. Campos: nome, preco (apenas números), uv (%), ir (%), vtl (%), tser (%), espessura (micras), garantiaFabricante (anos), precoMetroLinear. Se algum campo não for encontrado, NÃO inclua no JSON.`;

            const parts: any[] = [prompt];

            if (input.type === 'text') {
                parts.push(input.data as string);
            } else if (input.type === 'image') {
                for (const file of input.data as File[]) {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve) => {
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    const base64Data = await base64Promise;
                    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
                }
            } else {
                showError("Entrada de áudio ainda não é suportada para películas.");
                return null;
            }

            const result = await model.generateContent(parts);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const filmData = JSON.parse(jsonMatch[0]);
                return filmData as Partial<Film>;
            } else {
                showError("Não foi possível extrair dados da película. Tente reformular a entrada.");
                return null;
            }
        } catch (error) {
            console.error("Erro ao processar dados da película com IA:", error);
            showError(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, showError]);

    return {
        processClientWithAI,
        processFilmWithAI,
        isProcessingAI
    };
};

export type { ExtractedClientData };
