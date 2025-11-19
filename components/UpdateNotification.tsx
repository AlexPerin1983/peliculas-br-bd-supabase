import React from 'react';

interface UpdateNotificationProps {
    onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[70] w-full max-w-sm px-4 animate-fade-in-up">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <i className="fas fa-sync-alt text-xl text-green-400"></i>
                    <div>
                        <p className="font-semibold text-sm">Atualização Disponível</p>
                        <p className="text-xs opacity-80">Nova versão do aplicativo pronta para uso.</p>
                    </div>
                </div>
                <button
                    onClick={onUpdate}
                    className="flex-shrink-0 px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition-colors"
                >
                    Atualizar Agora
                </button>
            </div>
            <style jsx>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translate(-50%, 20px);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, 0);
                    }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default UpdateNotification;