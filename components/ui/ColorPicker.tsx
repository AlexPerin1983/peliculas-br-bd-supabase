
import React, { useState, useEffect, useRef, useCallback } from 'react';

// Helper functions for color conversion
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0');
};

const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
};

const hsvToRgb = (h: number, s: number, v: number) => {
    s /= 100; v /= 100;
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

const SaturationValuePicker: React.FC<{
    width: number;
    height: number;
    hue: number;
    saturation: number;
    value: number;
    onChange: (s: number, v: number) => void;
}> = ({ width, height, hue, saturation, value, onChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                ctx.fillRect(0, 0, width, height);

                const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
                whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
                whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = whiteGrad;
                ctx.fillRect(0, 0, width, height);

                const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
                blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
                blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
                ctx.fillStyle = blackGrad;
                ctx.fillRect(0, 0, width, height);
            }
        }
    }, [hue, width, height]);

    const handleInteraction = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const touch = 'touches' in event ? event.touches[0] : event;

        let x = touch.clientX - rect.left;
        let y = touch.clientY - rect.top;

        x = Math.max(0, Math.min(width, x));
        y = Math.max(0, Math.min(height, y));

        const newS = (x / width) * 100;
        const newV = 100 - (y / height) * 100;
        onChange(newS, newV);
    };

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        handleInteraction(e);

        const onMouseMove = (event: MouseEvent) => handleInteraction(event);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        handleInteraction(e);

        const onTouchMove = (event: TouchEvent) => handleInteraction(event);
        const onTouchEnd = () => {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
        document.addEventListener('touchmove', onTouchMove);
        document.addEventListener('touchend', onTouchEnd);
    }


    const handleX = (saturation / 100) * width;
    const handleY = (1 - value / 100) * height;

    return (
        <div className="relative cursor-crosshair" style={{ touchAction: 'none' }}>
            <canvas ref={canvasRef} width={width} height={height} onMouseDown={onMouseDown} onTouchStart={onTouchStart} />
            <div
                style={{
                    position: 'absolute',
                    left: `${handleX - 6}px`,
                    top: `${handleY - 6}px`,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
};

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(250);

    const [hsv, setHsv] = useState(() => {
        const rgb = hexToRgb(color);
        return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : { h: 0, s: 100, v: 100 };
    });

    const [hexInput, setHexInput] = useState(color);

    useEffect(() => {
        const rgb = hexToRgb(color);
        if (rgb) {
            const currentHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            setHsv(currentHsv);
            const { r, g, b } = hsvToRgb(currentHsv.h, currentHsv.s, currentHsv.v)
            setHexInput(rgbToHex(r, g, b));
        }
    }, [color]);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        if (isOpen) {
            updateWidth();
            window.addEventListener('resize', updateWidth);
        }

        return () => {
            window.removeEventListener('resize', updateWidth);
        };
    }, [isOpen]);

    const updateColor = useCallback((newHsv: { h: number; s: number; v: number }) => {
        setHsv(newHsv);
        const { r, g, b } = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
        const newHex = rgbToHex(r, g, b);
        setHexInput(newHex);
        onChange(newHex);
    }, [onChange]);

    const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateColor({ ...hsv, h: Number(e.target.value) });
    };

    const handleSaturationValueChange = (s: number, v: number) => {
        updateColor({ ...hsv, s, v });
    };

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newHex = e.target.value;
        if (!newHex.startsWith('#')) {
            newHex = '#' + newHex;
        }
        setHexInput(newHex);
        if (/^#([0-9A-F]{3}){1,2}$/i.test(newHex)) {
            const rgb = hexToRgb(newHex);
            if (rgb) {
                const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                setHsv(newHsv);
                onChange(newHex);
            }
        }
    };

    return (
        <div className="w-full" ref={containerRef}>
            <div
                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                onClick={() => setIsOpen(prev => !prev)}
            >
                <div
                    className="w-10 h-10 rounded-lg shadow-sm border border-white/20"
                    style={{ backgroundColor: color }}
                />
                <div className="flex-1">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Cor selecionada</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider font-mono">{color}</div>
                </div>
                <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="mt-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <SaturationValuePicker
                        width={containerWidth - 34} // Adjust for padding (p-4 = 16px each side + 2px border)
                        height={160}
                        hue={hsv.h}
                        saturation={hsv.s}
                        value={hsv.v}
                        onChange={handleSaturationValueChange}
                    />

                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-8">Tom</span>
                            <div className="flex-1 relative h-3 flex items-center">
                                <input
                                    type="range"
                                    min="0"
                                    max="359.9"
                                    step="0.1"
                                    value={hsv.h}
                                    onChange={handleHueChange}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                    style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-8">HEX</span>
                            <input
                                type="text"
                                value={hexInput}
                                onChange={handleHexChange}
                                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-center text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-slate-400/20 outline-none transition-all uppercase"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorPicker;