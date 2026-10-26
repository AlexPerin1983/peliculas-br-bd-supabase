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

// Desenhos vistos de cima (viewBox 240×440, frente para cima), só linhas e sombra.
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
    sem: '#ffffff',
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
const NO_FILM_FILL = '#ffffff';


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
    `M${sideX} ${y - 6} Q${sideX - 14 * direction} ${y - 8} ${sideX - 14 * direction} ${y} Q${sideX - 12 * direction} ${y + 6} ${sideX} ${y + 4} Z`
);

// Carro visto de cima com um círculo por vidro: tocar coloca ou tira a película daquele vidro.
const VehicleTopView: React.FC<VehicleTopViewProps> = ({ categoria, parts, vidros, applied, onTogglePart, width = 216 }) => {
    const scale = width / 240;
    const pinSize = width < 180 ? 32 : 42;
    const isCompact = pinSize < 42;
    const drawing = DRAWINGS[categoria] || DRAWINGS.sedan;
    const { body, cabin, bed } = drawing;

    return (
        <div className="relative mx-auto" style={{ width, height: Math.round(440 * scale) }}>
            <svg viewBox="0 0 240 440" className="absolute inset-0 h-full w-full" aria-hidden="true">
                <path d={bodyPath(body)} transform="translate(4 7)" className="fill-slate-200 dark:fill-slate-800" />
                {([[body.x + 2, 1], [body.x + body.w - 2, -1]] as const).map(([sideX, direction]) => (
                    <path key={sideX} d={mirrorPath(sideX, drawing.mirrorY, direction)} className="fill-white stroke-gray-800 dark:fill-slate-900 dark:stroke-slate-300" strokeWidth={2.5} strokeLinejoin="round" />
                ))}
                <path d={bodyPath(body)} className="fill-white stroke-gray-800 dark:fill-slate-900 dark:stroke-slate-300" strokeWidth={3} />
                {!bed && (
                    <path d={`M${body.x + 34} ${body.y + body.h - 14} Q${body.x + body.w / 2} ${body.y + body.h - 8} ${body.x + body.w - 34} ${body.y + body.h - 14}`} fill="none" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={2} strokeLinecap="round" />
                )}
                {drawing.lines.map(d => (
                    <path key={d} d={d} fill="none" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={2} strokeLinecap="round" />
                ))}
                <rect x={cabin.x} y={cabin.y} width={cabin.w} height={cabin.h} rx={cabin.rx} className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600" strokeWidth={2} />
                {bed && (
                    <>
                        <rect x={bed.x} y={bed.y} width={bed.w} height={bed.h} rx={bed.rx} className="fill-gray-50 stroke-gray-500 dark:fill-slate-800 dark:stroke-slate-500" strokeWidth={2} />
                        <path d={drawing.bedLines} className="stroke-gray-200 dark:stroke-slate-700" strokeWidth={2} />
                    </>
                )}
                {parts.map(part => {
                    const shape = drawing.glass[part];
                    if (!shape) return null;
                    const shade = vidros?.[part];
                    const fill = !applied.includes(part) ? NO_FILM_FILL : shade ? SHADE_FILL[shade] : UNSET_FILL;
                    return (
                        <g key={part}>
                            {renderShape(shape, {
                                fill,
                                stroke: '#374151',
                                strokeWidth: 'd' in shape ? 2 : 1.5,
                                className: 'transition-[fill] duration-300',
                            })}
                        </g>
                    );
                })}
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
                        className={`absolute flex flex-col items-center justify-center rounded-full transition-colors active:scale-95 ${isApplied
                            ? 'border-2 border-white bg-blue-600 text-white shadow-[0_2px_6px_rgba(37,99,235,0.35)] dark:border-slate-900'
                            : 'border-[1.5px] border-slate-300 bg-white text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500'}`}
                        style={{
                            width: pinSize,
                            height: pinSize,
                            left: Math.round(pin[0] * scale - pinSize / 2),
                            top: Math.round(pin[1] * scale - pinSize / 2),
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
