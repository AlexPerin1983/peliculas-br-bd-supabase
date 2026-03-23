import React, { useState, useEffect, useCallback } from 'react';

interface ImageGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex: number;
}

const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({ isOpen, onClose, images, initialIndex }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
        }
    }, [isOpen, initialIndex]);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % images.length);
    }, [images.length]);

    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
            handleNext();
        } else if (e.key === 'ArrowLeft') {
            handlePrev();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [handleNext, handlePrev, onClose]);

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        } else {
            window.removeEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleKeyDown]);

    if (!isOpen || images.length === 0) return null;

    const currentImage = images[currentIndex];
    const totalImages = images.length;

    return (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
            
            {/* Header/Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-10">
                <button 
                    onClick={onClose} 
                    className="text-white hover:text-slate-300 h-10 w-10 flex items-center justify-center rounded-full transition-colors bg-white/10 hover:bg-white/20"
                    aria-label="Fechar galeria"
                >
                    <i className="fas fa-times text-xl"></i>
                </button>
            </div>

            {/* Image Container */}
            <div className="relative w-full h-full flex items-center justify-center">
                
                {/* Navigation Buttons */}
                {totalImages > 1 && (
                    <>
                        <button 
                            onClick={handlePrev} 
                            className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-4 text-white text-3xl opacity-70 hover:opacity-100 transition-opacity"
                            aria-label="Imagem anterior"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <button 
                            onClick={handleNext} 
                            className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-4 text-white text-3xl opacity-70 hover:opacity-100 transition-opacity"
                            aria-label="Próxima imagem"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </>
                )}

                {/* Image */}
                <img 
                    src={currentImage} 
                    alt={`Amostra ${currentIndex + 1} de ${totalImages}`} 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
            </div>

            {/* Footer/Index */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                <span className="text-white text-sm font-semibold bg-black/50 px-3 py-1 rounded-full">
                    {currentIndex + 1} / {totalImages}
                </span>
            </div>
            
      <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default ImageGalleryModal;
