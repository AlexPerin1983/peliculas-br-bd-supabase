import React from 'react';
import type { VehicleCategory, VehicleGlassPart, VehicleGlassShade } from '../../types';
import { getVehicleGlassPartInfo } from '../../src/lib/automotive';

interface VehicleTopViewProps {
    categoria: VehicleCategory;
    parts: VehicleGlassPart[];
    vidros?: Partial<Record<VehicleGlassPart, VehicleGlassShade>>;
    // Vidros que levam película (azul); os outros ficam brancos com contorno tracejado.
    applied: VehicleGlassPart[];
    onTogglePart: (part: VehicleGlassPart) => void;
    // Largura do desenho em px (a altura acompanha); os círculos diminuem no desenho pequeno.
    width?: number;
}

type Rect = { x: number; y: number; w: number; h: number; rx: number };
type GlassShape = { d: string } | Rect;

interface Drawing {
    body: Rect;
    mirrorY: number;
    // Detalhes em linha fina (capô, porta-malas, frisos).
    lines: string[];
    cabin: Rect;
    bed?: Rect;
    bedLines?: string;
    glass: Partial<Record<VehicleGlassPart, GlassShape>>;
    pins: Partial<Record<VehicleGlassPart, [number, number]>>;
}

const side = (x: number, y: number, h: number): Rect => ({ x, y, w: 14, h, rx: 5 });

// Geometria própria por categoria (viewBox 240×440, frente para cima).
const DRAWINGS: Record<VehicleCategory, Drawing> = {
    sedan: {
        body: { x: 50, y: 20, w: 140, h: 400, rx: 48 },
        mirrorY: 152,
        lines: ['M72 62 Q120 46 168 62', 'M70 372 Q120 382 170 372'],
        cabin: { x: 76, y: 182, w: 88, h: 120, rx: 10 },
        glass: {
            pb: { d: 'M64 128 Q120 112 176 128 L166 176 Q120 168 74 176 Z' },
            ts: { x: 92, y: 198, w: 56, h: 46, rx: 6 },
            de: side(56, 180, 60), dd: side(170, 180, 60),
            te: side(56, 246, 52), td: side(170, 246, 52),
            vt: { d: 'M74 308 Q120 316 166 308 L174 344 Q120 356 66 344 Z' },
        },
        pins: { pb: [120, 150], ts: [120, 221], de: [24, 210], dd: [216, 210], te: [24, 272], td: [216, 272], vt: [120, 328] },
    },
    hatch: {
        body: { x: 50, y: 40, w: 140, h: 360, rx: 48 },
        mirrorY: 152,
        lines: ['M72 78 Q120 62 168 78'],
        cabin: { x: 76, y: 182, w: 88, h: 120, rx: 10 },
        glass: {
            pb: { d: 'M64 128 Q120 112 176 128 L166 176 Q120 168 74 176 Z' },
            ts: { x: 92, y: 198, w: 56, h: 46, rx: 6 },
            de: side(56, 180, 60), dd: side(170, 180, 60),
            te: side(56, 246, 52), td: side(170, 246, 52),
            vt: { d: 'M72 308 Q120 316 168 308 L176 352 Q120 364 64 352 Z' },
        },
        pins: { pb: [120, 150], ts: [120, 221], de: [24, 210], dd: [216, 210], te: [24, 272], td: [216, 272], vt: [120, 332] },
    },
    suv: {
        body: { x: 46, y: 20, w: 148, h: 400, rx: 36 },
        mirrorY: 146,
        lines: ['M70 58 Q120 44 170 58', 'M80 300 L160 300', 'M80 316 L160 316'],
        cabin: { x: 74, y: 174, w: 92, h: 168, rx: 8 },
        glass: {
            pb: { d: 'M60 120 Q120 104 180 120 L170 168 Q120 160 70 168 Z' },
            ts: { x: 90, y: 190, w: 60, h: 46, rx: 6 },
            de: side(52, 172, 58), dd: side(174, 172, 58),
            te: side(52, 236, 52), td: side(174, 236, 52),
            ve: side(52, 294, 40), vd: side(174, 294, 40),
            vt: { d: 'M70 350 Q120 358 170 350 L176 384 Q120 394 64 384 Z' },
        },
        pins: { pb: [120, 144], ts: [120, 213], de: [24, 201], dd: [216, 201], te: [24, 262], td: [216, 262], ve: [24, 314], vd: [216, 314], vt: [120, 368] },
    },
    picape_simples: {
        body: { x: 50, y: 20, w: 140, h: 400, rx: 34 },
        mirrorY: 146,
        lines: ['M72 58 Q120 44 168 58'],
        cabin: { x: 76, y: 164, w: 88, h: 60, rx: 8 },
        bed: { x: 62, y: 258, w: 116, h: 148, rx: 6 },
        bedLines: 'M91 266 L91 398 M120 266 L120 398 M149 266 L149 398',
        glass: {
            pb: { d: 'M64 110 Q120 94 176 110 L166 158 Q120 150 74 158 Z' },
            de: side(56, 162, 60), dd: side(170, 162, 60),
            vt: { x: 78, y: 230, w: 84, h: 14, rx: 4 },
        },
        pins: { pb: [120, 134], de: [24, 192], dd: [216, 192], vt: [120, 237] },
    },
    picape_dupla: {
        body: { x: 50, y: 20, w: 140, h: 400, rx: 34 },
        mirrorY: 134,
        lines: ['M72 54 Q120 40 168 54'],
        cabin: { x: 76, y: 154, w: 88, h: 118, rx: 8 },
        bed: { x: 62, y: 304, w: 116, h: 104, rx: 6 },
        bedLines: 'M91 312 L91 400 M120 312 L120 400 M149 312 L149 400',
        glass: {
            pb: { d: 'M64 100 Q120 84 176 100 L166 148 Q120 140 74 148 Z' },
            ts: { x: 92, y: 168, w: 56, h: 42, rx: 6 },
            de: side(56, 150, 56), dd: side(170, 150, 56),
            te: side(56, 212, 52), td: side(170, 212, 52),
            vt: { x: 78, y: 278, w: 84, h: 14, rx: 4 },
        },
        pins: { pb: [120, 124], ts: [120, 189], de: [24, 178], dd: [216, 178], te: [24, 238], td: [216, 238], vt: [120, 285] },
    },
    van: {
        body: { x: 46, y: 16, w: 148, h: 410, rx: 22 },
        mirrorY: 96,
        lines: ['M80 180 L160 180', 'M80 250 L160 250', 'M80 320 L160 320'],
        cabin: { x: 72, y: 116, w: 96, h: 284, rx: 6 },
        glass: {
            pb: { d: 'M58 64 Q120 50 182 64 L174 110 Q120 104 66 110 Z' },
            de: side(52, 118, 50), dd: side(174, 118, 50),
            te: side(52, 180, 90), td: side(174, 180, 90),
            ve: side(52, 280, 90), vd: side(174, 280, 90),
            vt: { x: 78, y: 406, w: 84, h: 12, rx: 4 },
        },
        pins: { pb: [120, 87], de: [24, 143], dd: [216, 143], te: [24, 225], td: [216, 225], ve: [24, 325], vd: [216, 325], vt: [120, 412] },
    },
};

// Quanto menor o percentual, mais escuro o vidro. Sem escolha = cinza do desenho.
const SHADE_FILL: Record<VehicleGlassShade, string> = {
    sem: 'var(--car-clear)',
    faixa: '#cbd5e1',
    '5': '#374151',
    '20': '#4b5563',
    '35': '#6b7280',
    '50': '#9ca3af',
    '70': '#b6bcc6',
    '75': '#c3c8d0',
    '80': '#ccd1d8',
};
const UNSET_FILL = '#6b7280';
const NO_FILM_FILL = 'var(--car-clear)';


const renderShape = (shape: GlassShape, props: React.SVGProps<SVGElement>) => (
    'd' in shape
        ? <path d={shape.d} {...(props as React.SVGProps<SVGPathElement>)} />
        : <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} {...(props as React.SVGProps<SVGRectElement>)} />
);

// Carroceria com a frente um pouco mais estreita e as pontas arredondadas (mais cara de carro que um retângulo).
const bodyPath = ({ x, y, w, h, rx }: Rect): string => [
    `M${x + rx} ${y}`,
    `Q${x + w / 2} ${y - 8} ${x + w - rx} ${y}`,
    `Q${x + w - 6} ${y + 8} ${x + w - 2} ${y + rx + 10}`,
    `L${x + w} ${y + h - rx}`,
    `Q${x + w} ${y + h} ${x + w - rx} ${y + h}`,
    `Q${x + w / 2} ${y + h + 6} ${x + rx} ${y + h}`,
    `Q${x} ${y + h} ${x} ${y + h - rx}`,
    `L${x + 2} ${y + rx + 10}`,
    `Q${x + 6} ${y + 8} ${x + rx} ${y}`,
    'Z',
].join(' ');

// Retrovisor em gota, colado na lateral.
const mirrorPath = (sideX: number, y: number, direction: 1 | -1): string => (
    `M${sideX} ${y - 5} Q${sideX - 12 * direction} ${y - 3} ${sideX - 16 * direction} ${y + 7} Q${sideX - 9 * direction} ${y + 12} ${sideX} ${y + 5} Z`
);

// Carro visto de cima com um círculo por vidro: tocar coloca ou tira a película daquele vidro.
const VehicleTopView: React.FC<VehicleTopViewProps> = ({ categoria, parts, vidros, applied, onTogglePart, width = 216 }) => {
    const pinSize = width < 180 ? 36 : 42;
    const isCompact = pinSize < 42;
    const drawing = DRAWINGS[categoria] || DRAWINGS.sedan;
    const { body, cabin, bed } = drawing;

    return (
        <div
            className="relative mx-auto [--car-paint:#fff] [--car-edge:#292c31] [--car-trim:#a4a7ab] [--car-metal:#dce0e3] [--car-clear:#ededed] [--car-rubber:#303338] dark:[--car-paint:#dce0e4] dark:[--car-edge:#252a31] dark:[--car-trim:#888e98] dark:[--car-metal:#b4bcc6] dark:[--car-clear:#c9cfd5] dark:[--car-rubber:#22262d]"
            style={{ width, maxWidth: '100%', aspectRatio: '240 / 440' }}
        >
            <svg viewBox="0 0 240 440" className="absolute inset-0 h-full w-full" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {[body.x - 4, body.x + body.w - 5].map(x => (
                    <g key={x} fill="var(--car-rubber)">
                        <rect x={x} y={body.y + 82} width={9} height={49} rx={3} />
                        <rect x={x} y={body.y + body.h - 94} width={9} height={49} rx={3} />
                    </g>
                ))}
                <path d={bodyPath(body)} fill="var(--car-paint)" stroke="var(--car-edge)" strokeWidth={3.4} />
                <path d={bodyPath({ ...body, x: body.x + 4, y: body.y + 4, w: body.w - 8, h: body.h - 8, rx: body.rx - 3 })} fill="none" stroke="var(--car-trim)" strokeWidth={1} />
                <path d={`M${body.x + 30} ${body.y + 8} Q120 ${body.y - 3} ${body.x + body.w - 30} ${body.y + 8} L${body.x + body.w - 36} ${body.y + 16} Q120 ${body.y + 9} ${body.x + 36} ${body.y + 16} Z`} fill="var(--car-rubber)" />
                <path d={`M${body.x + 14} ${body.y + 31} L${body.x + 41} ${body.y + 14} L${body.x + 39} ${body.y + 24} L${body.x + 12} ${body.y + 43} Z`} fill="var(--car-metal)" stroke="var(--car-trim)" strokeWidth={0.8} />
                <path d={`M${body.x + body.w - 14} ${body.y + 31} L${body.x + body.w - 41} ${body.y + 14} L${body.x + body.w - 39} ${body.y + 24} L${body.x + body.w - 12} ${body.y + 43} Z`} fill="var(--car-metal)" stroke="var(--car-trim)" strokeWidth={0.8} />
                <path
                    d={`M${body.x + 18} ${body.y + 47} Q${body.x + 23} ${body.y + 21} 120 ${body.y + 22} Q${body.x + body.w - 23} ${body.y + 21} ${body.x + body.w - 18} ${body.y + 47} L${body.x + body.w - 13} ${drawing.mirrorY - 23} L${body.x + body.w - 22} ${drawing.mirrorY - 11} M${body.x + 18} ${body.y + 47} L${body.x + 13} ${drawing.mirrorY - 23} L${body.x + 22} ${drawing.mirrorY - 11}`}
                    fill="none" stroke="var(--car-trim)" strokeWidth={1}
                />
                <rect x={cabin.x} y={cabin.y} width={cabin.w} height={cabin.h} rx={cabin.rx} fill="var(--car-metal)" stroke="var(--car-trim)" strokeWidth={1} />
                <rect x={cabin.x + 5} y={cabin.y + 4} width={cabin.w - 10} height={cabin.h - 8} rx={Math.max(4, cabin.rx - 1)} fill="var(--car-paint)" stroke="var(--car-trim)" strokeWidth={0.8} />
                {[body.x + 3, body.x + body.w - 5].map(x => (
                    <g key={x} fill="none">
                        <path d={`M${x} ${drawing.mirrorY + 16} L${x} ${bed ? bed.y - 8 : body.y + body.h - 54}`} stroke="var(--car-edge)" strokeWidth={1.1} />
                        {[cabin.y + 40, cabin.y + 101].filter(y => y < cabin.y + cabin.h).map(y => (
                            <path key={y} d={`M${x} ${y} h${x < 120 ? 6 : -6}`} stroke="var(--car-trim)" strokeWidth={2} />
                        ))}
                    </g>
                ))}
                {parts.map(part => {
                    const shape = drawing.glass[part];
                    if (!shape) return null;
                    const shade = vidros?.[part];
                    const fill = !applied.includes(part) ? NO_FILM_FILL : shade ? SHADE_FILL[shade] : UNSET_FILL;
                    return (
                        <g key={part}>
                            {renderShape(shape, {
                                fill,
                                stroke: 'var(--car-edge)',
                                strokeWidth: 1,
                                className: 'transition-[fill] duration-300',
                            })}
                        </g>
                    );
                })}
                {([[body.x + 2, 1], [body.x + body.w - 2, -1]] as const).map(([sideX, direction]) => (
                    <path key={sideX} d={mirrorPath(sideX, drawing.mirrorY, direction)} fill="var(--car-paint)" stroke="var(--car-trim)" strokeWidth={1} />
                ))}
                {bed && (
                    <>
                        <rect x={bed.x} y={bed.y} width={bed.w} height={bed.h} rx={bed.rx} fill="var(--car-metal)" stroke="var(--car-edge)" strokeWidth={1.1} />
                        <path d={drawing.bedLines} fill="none" stroke="var(--car-trim)" strokeWidth={1.2} />
                    </>
                )}
                <path d={`M${body.x + 10} ${body.y + body.h - 29} Q${body.x + 12} ${body.y + body.h - 9} ${body.x + 37} ${body.y + body.h - 8} L${body.x + 38} ${body.y + body.h - 15} Q${body.x + 21} ${body.y + body.h - 17} ${body.x + 18} ${body.y + body.h - 31} Z`} fill="var(--car-metal)" stroke="var(--car-trim)" strokeWidth={0.8} />
                <path d={`M${body.x + body.w - 10} ${body.y + body.h - 29} Q${body.x + body.w - 12} ${body.y + body.h - 9} ${body.x + body.w - 37} ${body.y + body.h - 8} L${body.x + body.w - 38} ${body.y + body.h - 15} Q${body.x + body.w - 21} ${body.y + body.h - 17} ${body.x + body.w - 18} ${body.y + body.h - 31} Z`} fill="var(--car-metal)" stroke="var(--car-trim)" strokeWidth={0.8} />
                <path d={`M${body.x + 39} ${body.y + body.h - 7} Q120 ${body.y + body.h - 1} ${body.x + body.w - 39} ${body.y + body.h - 7}`} fill="none" stroke="var(--car-rubber)" strokeWidth={3} />
            </svg>

            {parts.map(part => {
                const pin = drawing.pins[part];
                if (!pin) return null;
                const isApplied = applied.includes(part);
                const shade = isApplied ? vidros?.[part] : undefined;
                const label = getVehicleGlassPartInfo(part).label;
                return (
                    <button
                        key={part}
                        type="button"
                        aria-pressed={isApplied}
                        aria-label={`${label}${shade ? `, ${shade === 'sem' ? 'sem película' : shade === 'faixa' ? 'só a faixa' : `${shade}%`}` : ''}`}
                        onClick={() => onTogglePart(part)}
                        className={`absolute flex flex-col items-center justify-center rounded-full border transition-colors active:scale-95 ${isCompact ? 'h-9 w-9 max-[380px]:h-8 max-[380px]:w-8' : 'h-[42px] w-[42px]'} ${isApplied
                            ? 'border-[var(--surface)] bg-[#087fff] text-white'
                            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'}`}
                        style={{
                            left: `${pin[0] / 240 * 100}%`,
                            top: `${pin[1] / 440 * 100}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <span className={`${isCompact ? "text-[10px]" : "text-[11px]"} font-extrabold leading-none`}>{part.toUpperCase()}</span>
                        {shade && (
                            <span className={`mt-0.5 ${isCompact ? "text-[8px]" : "text-[9px]"} font-bold leading-none`}>
                                {shade === 'sem' ? 'sem' : shade === 'faixa' ? 'faixa' : `${shade}%`}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default VehicleTopView;
