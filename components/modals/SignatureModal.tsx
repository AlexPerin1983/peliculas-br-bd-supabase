
import React, { useRef, useEffect, useState, MouseEvent, TouchEvent } from 'react';
import Modal from '../ui/Modal';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureDataUrl: string) => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const getCanvasContext = () => {
        return canvasRef.current?.getContext('2d');
    };

    useEffect(() => {
        if (isOpen) {
            const canvas = canvasRef.current;
            if (canvas) {
                // Adjust for device pixel ratio for sharper lines
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const parentWidth = canvas.offsetWidth;
                const parentHeight = canvas.offsetHeight;
                
                canvas.width = parentWidth * ratio;
                canvas.height = parentHeight * ratio;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(ratio, ratio);
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                }
            }
        }
    }, [isOpen]);

    const getCoords = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const ctx = getCanvasContext();
        if (!ctx) return;
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const ctx = getCanvasContext();
        if (!ctx) return;
        // Prevent scrolling on touch devices while drawing
        if ('touches' in e) {
            e.preventDefault();
        }
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const ctx = getCanvasContext();
        if (ctx) ctx.closePath();
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = getCanvasContext();
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const context = canvas.getContext('2d');
            if (context) {
                const pixelBuffer = new Uint32Array(context.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
                const isEmpty = !pixelBuffer.some(color => color !== 0);
                if (isEmpty) {
                    alert("Por favor, faça uma assinatura antes de salvar.");
                    return;
                }
            }
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    const footer = (
        <>
            <button
                onClick={handleClear}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors mr-auto"
            >
                Limpar
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Cancelar
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                Salvar Assinatura
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Assinatura Digital" footer={footer}>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2" style={{ touchAction: 'none' }}>
                <canvas
                    ref={canvasRef}
                    className="w-full h-48 bg-white rounded-md cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>
            <p className="text-center text-sm text-slate-500 mt-2">
                Desenhe sua assinatura no campo acima.
            </p>
        </Modal>
    );
};

export default SignatureModal;