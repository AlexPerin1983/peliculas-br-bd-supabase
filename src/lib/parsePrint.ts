"use client";

import { ExtractedClientData, Measurement } from "../../types";

/**
 * Dados extraídos de um print/imagem
 */
export interface ParsedPrintData {
    client?: Partial<ExtractedClientData>;
    measurements?: Array<{
        largura: string;
        altura: string;
        quantidade: number;
        ambiente?: string;
    }>;
    film?: {
        nome?: string;
        uv?: number;
        ir?: number;
        vtl?: number;
        tser?: number;
        espessura?: number;
        preco?: number;
    };
    uncertainFields: string[];
    rawText: string;
    normalizedText: string;
}

interface Candidate {
    value: string;
    score: number;
    source: string;
}

// ============================================================================
// NORMALIZA??O DO TEXTO OCR
// ============================================================================

function normalizeOCRText(text: string): string {
    let normalized = text;

    // Converter símbolos especiais
    normalized = normalized
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[˜∼～]/g, '~')
        .replace(/[×✕✖]/g, 'x')
        .replace(/[–—]/g, '-')
        .replace(/\u00A0/g, ' ');

    // Normalizar espaços e quebras
    normalized = normalized
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/gm, '');

    return normalized.trim();
}

function getCleanLines(text: string): string[] {
    return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

// ============================================================================
// EXTRATORES COM SCORE
// ============================================================================

function extractPhoneCandidates(text: string): Candidate[] {
    const candidates: Candidate[] = [];

    const patterns: Array<{ regex: RegExp; baseScore: number; source: string }> = [
        { regex: /\+55\s*\(?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g, baseScore: 95, source: 'BR +55' },
        { regex: /\(?(\d{2})\)?\s*9\d{4}[-.\s]?(\d{4})/g, baseScore: 90, source: 'Celular 9' },
        { regex: /\(?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g, baseScore: 80, source: 'DDD+Tel' },
    ];

    for (const { regex, baseScore, source } of patterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const digits = match[0].replace(/\D/g, '');
            let score = baseScore;

            if (digits.length === 10 || digits.length === 11) score += 5;
            else if (digits.length > 13 || digits.length < 8) score -= 30;

            if (digits.length >= 10 && digits[2] === '9') score += 5;

            let cleanDigits = digits;
            if (digits.startsWith('55') && digits.length > 11) {
                cleanDigits = digits.slice(2);
            }

            if (score > 50) {
                candidates.push({ value: cleanDigits, score, source });
            }
        }
    }

    const unique = new Map<string, Candidate>();
    for (const c of candidates) {
        const existing = unique.get(c.value);
        if (!existing || existing.score < c.score) {
            unique.set(c.value, c);
        }
    }

    return Array.from(unique.values()).sort((a, b) => b.score - a.score);
}

function isValidName(str: string): boolean {
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*$/.test(str)) return false;
    if (str.length < 3 || str.length > 40) return false;

    const words = str.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 1 || words.length > 4) return false;

    return true;
}

function extractNameCandidates(text: string, lines: string[]): Candidate[] {
    const candidates: Candidate[] = [];

    // Textos de UI para ignorar (match exato)
    const ignoreWords = new Set([
        'dados', 'pesquisar', 'adicionar', 'midia', 'mídia', 'links', 'docs',
        'recado', 'whatsapp', 'bloquear', 'ferramentas', 'seguranca', 'segurança',
        'mensagens', 'ligacoes', 'ligações', 'ola', 'olá', 'boa', 'bom',
        'orcamento', 'orçamento', 'ajudar', 'precisando', 'contatos', 'contato',
        'conta', 'comercial', 'empresa', 'cadastrada', 'domingo', 'segunda',
        'terca', 'terça', 'quarta', 'quinta', 'sexta', 'sabado', 'sábado',
        'nenhum', 'grupo', 'comum', 'esta', 'está', 'nos', 'seus'
    ]);

    const isIgnored = (name: string): boolean => {
        const lower = name.toLowerCase();
        for (const word of ignoreWords) {
            if (lower === word || lower.includes(word)) return true;
        }
        return false;
    };

    // Padrão 1: Nome após símbolo ~ ou *
    // Regex mais flexível para capturar variações
    const symbolRegex = /[~\*]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,25})/g;
    let match;
    while ((match = symbolRegex.exec(text)) !== null) {
        const name = match[1].trim();
        console.log(`[Parser Debug] Símbolo encontrado: "${name}"`);
        if (isValidName(name) && !isIgnored(name)) {
            candidates.push({ value: name, score: 95, source: 'Símbolo ~/*' });
        }
    }

    // Padrão 2: Busca linhas que parecem nomes próximos a telefone
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Pula se muito curto
        if (line.length < 3) continue;

        // Remove símbolos do início (comum em WhatsApp: ~Nome ou *Nome)
        const originalLine = line;
        if (/^[~*\u007E\u002A\u0060\u00B4\u02DC\u002D\u005F]/.test(line)) {
            line = line.slice(1).trim();
            console.log(`[Parser Debug] Removendo símbolo de "${originalLine}" -> "${line}"`);
        }

        // Pula se for texto de UI
        if (isIgnored(line)) continue;

        // Pula se tiver números
        if (/\d/.test(line)) continue;

        // Pula se tiver muitos caracteres especiais
        if (/[+@#$%&(){}[\]<>|\\\/]/.test(line)) continue;

        // Verifica se parece nome
        if (isValidName(line)) {
            let score = 40;

            // Grande bônus: está logo após um telefone
            if (i > 0 && /\d{8,}/.test(lines[i - 1])) score += 30;

            // Bônus: começa com maiúscula
            if (/^[A-ZÀ-Ý]/.test(line)) score += 15;

            // Bônus: tamanho típico de nome
            const wordCount = line.split(/\s+/).length;
            if (wordCount >= 1 && wordCount <= 3 && line.length >= 4) score += 10;

            // Penalidade: muito no topo (UI)
            if (i < 3) score -= 20;

            // Grande penalidade: palavra curta sozinha (sigla/UI)
            if (wordCount === 1 && line.length <= 3) score -= 40;

            console.log(`[Parser Debug] Heurística linha ${i}: "${line}" score=${score}`);

            if (score > 50) {
                candidates.push({ value: line, score, source: 'Heurística linha' });
            }
        }
    }

    // Remove duplicatas
    const unique = new Map<string, Candidate>();
    for (const c of candidates) {
        const key = c.value.toLowerCase();
        const existing = unique.get(key);
        if (!existing || existing.score < c.score) {
            unique.set(key, c);
        }
    }

    return Array.from(unique.values()).sort((a, b) => b.score - a.score);
}

function extractCEPCandidates(text: string, phonePositions: Array<{ start: number, end: number }>): Candidate[] {
    const candidates: Candidate[] = [];

    const cepKeywordPattern = /cep[:\s]+(\d{5}[-.\s]?\d{3}|\d{8})/gi;
    let match;
    while ((match = cepKeywordPattern.exec(text)) !== null) {
        const cep = match[1].replace(/\D/g, '');
        if (cep.length === 8) {
            candidates.push({ value: cep, score: 95, source: 'Palavra CEP' });
        }
    }

    const hyphenPattern = /(\d{5})-(\d{3})/g;
    while ((match = hyphenPattern.exec(text)) !== null) {
        const position = match.index;
        const isInPhone = phonePositions.some(p => position >= p.start && position < p.end);
        if (isInPhone) continue;

        const cep = match[1] + match[2];
        candidates.push({ value: cep, score: 80, source: 'Formato XXXXX-XXX' });
    }

    const unique = new Map<string, Candidate>();
    for (const c of candidates) {
        const existing = unique.get(c.value);
        if (!existing || existing.score < c.score) {
            unique.set(c.value, c);
        }
    }

    return Array.from(unique.values()).sort((a, b) => b.score - a.score);
}

function extractDigits(str: string): string {
    return str.replace(/\D/g, "");
}

function normalizeMeasurement(value: string, originalText: string): string {
    let num = value.replace(",", ".").replace(/[^\d.]/g, "");
    let parsed = parseFloat(num);
    if (isNaN(parsed)) return value;

    const lowerText = originalText.toLowerCase();
    if (parsed > 100 || lowerText.includes("mm")) {
        parsed = parsed / 1000;
    } else if (parsed > 10 || lowerText.includes("cm")) {
        parsed = parsed / 100;
    }

    return parsed.toFixed(2).replace(".", ",");
}

// ============================================================================
// MAIN PARSER
// ============================================================================

export function parsePrintText(text: string, confidence: number = 100): ParsedPrintData {
    const uncertainFields: string[] = [];
    const normalizedText = normalizeOCRText(text);
    const lines = getCleanLines(normalizedText);

    console.log("[Parser] Linhas normalizadas:", lines);

    const result: ParsedPrintData = {
        uncertainFields,
        rawText: text,
        normalizedText,
    };

    const client: Partial<ExtractedClientData> = {};
    const isLowConfidence = confidence < 70;

    // TELEFONE
    const phoneCandidates = extractPhoneCandidates(normalizedText);
    if (phoneCandidates.length > 0) {
        const best = phoneCandidates[0];
        client.telefone = best.value;
        if (best.score < 80 || isLowConfidence) uncertainFields.push("telefone");
        console.log(`[Parser] Telefone: ${best.value} (score: ${best.score}, source: ${best.source})`);
    }

    // NOME
    const nameCandidates = extractNameCandidates(normalizedText, lines);
    if (nameCandidates.length > 0) {
        const best = nameCandidates[0];
        client.nome = best.value;
        uncertainFields.push("nome");
        console.log(`[Parser] Nome: ${best.value} (score: ${best.score}, source: ${best.source})`);
    }

    // EMAIL
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatch = normalizedText.match(emailPattern);
    if (emailMatch) {
        client.email = emailMatch[0];
        if (isLowConfidence) uncertainFields.push("email");
    }

    // CPF/CNPJ
    const cpfPattern = /\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}/g;
    const cnpjPattern = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-.\s]?\d{2}/g;

    const cnpjMatch = normalizedText.match(cnpjPattern);
    const cpfMatch = normalizedText.match(cpfPattern);

    if (cnpjMatch) {
        client.cpfCnpj = extractDigits(cnpjMatch[0]);
        if (isLowConfidence) uncertainFields.push("cpfCnpj");
    } else if (cpfMatch) {
        client.cpfCnpj = extractDigits(cpfMatch[0]);
        if (isLowConfidence) uncertainFields.push("cpfCnpj");
    }

    // CEP
    const phonePositions: Array<{ start: number, end: number }> = [];
    const phoneRegex = /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
    let phoneExec;
    while ((phoneExec = phoneRegex.exec(normalizedText)) !== null) {
        phonePositions.push({ start: phoneExec.index, end: phoneExec.index + phoneExec[0].length });
    }

    const cepCandidates = extractCEPCandidates(normalizedText, phonePositions);
    if (cepCandidates.length > 0) {
        const best = cepCandidates[0];
        client.cep = best.value;
        if (best.score < 80 || isLowConfidence) uncertainFields.push("cep");
        console.log(`[Parser] CEP: ${best.value} (score: ${best.score}, source: ${best.source})`);
    }

    // MEDIDAS
    const measurements: ParsedPrintData["measurements"] = [];
    const measurementPattern = /(\d+[,.]?\d*)\s*(?:mm|cm|m)?\s*[xX×]\s*(\d+[,.]?\d*)\s*(?:mm|cm|m)?/gi;

    let mMatch;
    while ((mMatch = measurementPattern.exec(normalizedText)) !== null && measurements.length < 50) {
        measurements.push({
            largura: normalizeMeasurement(mMatch[1], normalizedText),
            altura: normalizeMeasurement(mMatch[2], normalizedText),
            quantidade: 1,
            ambiente: `Medida ${measurements.length + 1}`,
        });
    }

    if (measurements.length > 0) {
        result.measurements = measurements;
        if (isLowConfidence) uncertainFields.push("measurements");
    }

    if (Object.keys(client).length > 0) {
        result.client = client;
    }

    return result;
}

// ============================================================================
// HIGH-LEVEL FUNCTIONS
// ============================================================================

export function extractClientFromOCR(text: string, confidence: number = 100): Partial<ExtractedClientData> | null {
    const parsed = parsePrintText(text, confidence);
    return parsed.client || null;
}

export function extractMeasurementsFromOCR(text: string, confidence: number = 100): Array<{ local: string; largura: string; altura: string; quantidade: number }> | null {
    const parsed = parsePrintText(text, confidence);
    if (!parsed.measurements || parsed.measurements.length === 0) return null;

    return parsed.measurements.map((m, idx) => ({
        local: m.ambiente || `Medida ${idx + 1}`,
        largura: m.largura,
        altura: m.altura,
        quantidade: m.quantidade,
    }));
}

export function getUncertainFields(parsed: ParsedPrintData): string[] {
    return parsed.uncertainFields;
}
