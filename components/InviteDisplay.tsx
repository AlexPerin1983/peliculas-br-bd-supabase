import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { getInviteUrl } from '../services/inviteService';

interface InviteDisplayProps {
    inviteCode: string;
    onRegenerate: () => void;
}

const InviteDisplay: React.FC<InviteDisplayProps> = ({ inviteCode, onRegenerate }) => {
    const [copied, setCopied] = useState(false);
    const inviteUrl = getInviteUrl(inviteCode);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Erro ao copiar link:', error);
        }
    };

    const handleShareWhatsApp = () => {
        const text = `Olá! Você foi convidado para se cadastrar em nossa empresa.\n\nUse este link para criar sua conta:\n${inviteUrl}\n\nOu utilize o código: ${inviteCode}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleShareEmail = () => {
        const subject = 'Convite para Cadastro';
        const body = `Olá!\n\nVocê foi convidado para se cadastrar em nossa empresa.\n\nPara criar sua conta, acesse o link abaixo:\n${inviteUrl}\n\nOu utilize o código de convite: ${inviteCode}\n\nAtenciosamente`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <div className="space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-3">
                <div className="p-4 bg-white rounded-xl shadow-md border-2 border-gray-200">
                    <QRCodeCanvas
                        value={inviteUrl}
                        size={200}
                        level="H"
                        includeMargin={true}
                    />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    <i className="fas fa-camera mr-2"></i>
                    Escaneie com a câmera do celular
                </p>
            </div>

            {/* Código de Convite */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                    Código de Convite
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 text-center font-mono tracking-wider">
                    {inviteCode}
                </p>
            </div>

            {/* Link de Compartilhamento */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Link de Compartilhamento
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inviteUrl}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-mono"
                        onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                        onClick={handleCopyLink}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${copied
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        title="Copiar link"
                    >
                        <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                    </button>
                </div>
                {copied && (
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                        <i className="fas fa-check-circle"></i>
                        Link copiado!
                    </p>
                )}
            </div>

            {/* Botões de Compartilhamento */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleShareWhatsApp}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-md"
                >
                    <i className="fab fa-whatsapp text-xl"></i>
                    <span>WhatsApp</span>
                </button>
                <button
                    onClick={handleShareEmail}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors shadow-md"
                >
                    <i className="fas fa-envelope text-xl"></i>
                    <span>Email</span>
                </button>
            </div>

            {/* Botão de Regenerar */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={onRegenerate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
                >
                    <i className="fas fa-sync-alt"></i>
                    <span> Gerar Novo Código</span>
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    Atenção: Ao gerar um novo código, o código antigo será desativado
                </p>
            </div>
        </div>
    );
};

export default InviteDisplay;
