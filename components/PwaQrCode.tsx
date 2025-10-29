import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';

interface PwaQrCodeProps {
    appUrl: string;
}

const PwaQrCode: React.FC<PwaQrCodeProps> = ({ appUrl }) => {
    const [isClient, setIsClient] = useState(false);
    
    // Garante que o QRCode só seja renderizado no cliente, onde window.location está disponível
    useEffect(() => {
        setIsClient(true);
    }, []);

    const urlToEncode = appUrl.startsWith('http') ? appUrl : window.location.origin;

    if (!isClient) {
        return <div className="text-center text-slate-500 p-4">Carregando QR Code...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg shadow-inner border border-slate-200">
                <QRCode
                    value={urlToEncode}
                    size={180}
                    level="H"
                    includeMargin={true}
                    renderAs="svg"
                    className="rounded-lg"
                />
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <i className="fas fa-info-circle"></i>
                    Como Instalar
                </h4>
                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                    <li>Escaneie o QR Code acima com a câmera do seu celular.</li>
                    <li>O navegador abrirá o aplicativo.</li>
                    <li>
                        **No Android/Chrome:** Clique no botão "Instalar" ou use o menu (⋮) e selecione "Instalar aplicativo".
                    </li>
                    <li>
                        **No iOS/Safari:** Clique no ícone de "Compartilhar" (<i className="fas fa-share-square"></i>) e selecione "Adicionar à Tela de Início".
                    </li>
                </ol>
            </div>
        </div>
    );
};

export default PwaQrCode;