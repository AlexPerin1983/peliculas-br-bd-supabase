// Emenda de topo: peça maior que a bobina (em todas as posições permitidas)
// é dividida em faixas que cabem na largura, encostadas sem sobreposição.
//
// - vertical: faixas em pé; a bobina corre na altura da peça e a largura é dividida.
// - horizontal: faixas deitadas; a bobina corre na largura da peça e a altura é dividida.
//
// Medidas em cm, como no otimizador: w = largura da peça, h = altura.

export type SeamDirection = 'vertical' | 'horizontal';
// full: faixas inteiras + um complemento (sobra maior e aproveitável).
// equal: faixas iguais (emenda centralizada).
export type SeamStyle = 'full' | 'equal';

export interface SeamOption {
    direction: SeamDirection;
    // Larguras das faixas (cm), na ordem: da esquerda (vertical) ou do topo (horizontal).
    strips: number[];
    // Comprimento de cada faixa na bobina (cm).
    stripLength: number;
    // Bobina gasta só com as faixas (cm).
    linearCm: number;
}

export interface SeamPlan {
    chosen: SeamOption;
    // A outra direção, quando a rotação é permitida.
    alternative: SeamOption | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// complementFirst: a faixa do complemento vai primeiro (em cima / à esquerda).
export const splitSeamLength = (length: number, max: number, style: SeamStyle = 'full', complementFirst = false): number[] => {
    const count = Math.max(1, Math.ceil(length / max - 1e-9));
    if (count === 1) return [length];
    const each = style === 'equal' ? round2(length / count) : max;
    const strips = Array.from({ length: count - 1 }, () => each);
    strips.push(round2(length - each * (count - 1)));
    return complementFirst && style === 'full' ? strips.reverse() : strips;
};

// Há um complemento (faixa mais estreita) para escolher o lado.
export const hasSeamComplement = (strips: number[]): boolean =>
    strips.length > 1 && Math.abs(strips[0] - strips[strips.length - 1]) >= 0.5;

// Mesma regra de "cabe" do otimizador (sem tolerância).
export const needsSeam = (w: number, h: number, rollWidth: number, allowRotation: boolean): boolean =>
    w > rollWidth && (!allowRotation || h > rollWidth);

const buildOption = (
    w: number,
    h: number,
    rollWidth: number,
    direction: SeamDirection,
    style: SeamStyle,
    complementFirst: boolean,
): SeamOption => {
    const strips = splitSeamLength(direction === 'vertical' ? w : h, rollWidth, style, complementFirst);
    const stripLength = round2(direction === 'vertical' ? h : w);
    return { direction, strips, stripLength, linearCm: round2(strips.length * stripLength) };
};

/**
 * Plano de emenda da peça, ou null quando ela cabe inteira.
 * Sem rotação ("respeitar veio") a peça não gira: só faixas em pé.
 * Com rotação, usa a direção pedida ou a que gasta menos bobina (empate: em pé).
 */
export const planSeam = (
    w: number,
    h: number,
    rollWidth: number,
    options: { allowRotation: boolean; style?: SeamStyle; direction?: SeamDirection; complementFirst?: boolean },
): SeamPlan | null => {
    if (!(rollWidth > 0) || !needsSeam(w, h, rollWidth, options.allowRotation)) return null;
    const style = options.style ?? 'full';
    const complementFirst = options.complementFirst === true;
    const vertical = buildOption(w, h, rollWidth, 'vertical', style, complementFirst);
    if (!options.allowRotation) return { chosen: vertical, alternative: null };

    const horizontal = buildOption(w, h, rollWidth, 'horizontal', style, complementFirst);
    const preferred = options.direction
        ?? (horizontal.linearCm < vertical.linearCm ? 'horizontal' : 'vertical');
    return preferred === 'horizontal'
        ? { chosen: horizontal, alternative: vertical }
        : { chosen: vertical, alternative: horizontal };
};
