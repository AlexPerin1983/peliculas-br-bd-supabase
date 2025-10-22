
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
            const { r,g,b } = hsvToRgb(currentHsv.h, currentHsv.s, currentHsv.v)
            setHexInput(rgbToHex(r,g,b));
        }
    }, [color]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (pickerRef.current && !pickerRef.current.contains(target) && !(target.parentElement === pickerRef.current?.previousElementSibling)) {
                 if (!pickerRef.current?.previousElementSibling?.contains(target)) {
                    setIsOpen(false);
                 }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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
        <div className="relative">
            <div 
                className="w-10 h-10 rounded-md border-slate-300 border cursor-pointer" 
                style={{ backgroundColor: color }}
                onClick={() => setIsOpen(prev => !prev)}
            />
            {isOpen && (
                <div ref={pickerRef} className="absolute z-20 top-full mt-2 p-3 bg-white rounded-lg shadow-xl border border-slate-200 w-64 space-y-3">
                    <SaturationValuePicker
                        width={232}
                        height={150}
                        hue={hsv.h}
                        saturation={hsv.s}
                        value={hsv.v}
                        onChange={handleSaturationValueChange}
                    />
                    <input
                        type="range"
                        min="0"
                        max="359.9"
                        step="0.1"
                        value={hsv.h}
                        onChange={handleHueChange}
                        className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 rounded-lg appearance-none cursor-pointer"
                        style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
                    />
                    <input
                        type="text"
                        value={hexInput}
                        onChange={handleHexChange}
                        className="w-full p-2 text-center border border-slate-300 rounded-md"
                    />
                </div>
            )}
        </div>
    );
};

export default ColorPicker;