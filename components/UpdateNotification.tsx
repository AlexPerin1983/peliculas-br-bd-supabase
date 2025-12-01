import React, { useEffect } from 'react';

interface UpdateNotificationProps {
    onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
    useEffect(() => {
        console.log('🔔 UpdateNotification component mounted and visible!');
    }, []);

    return (
        <div
            className="fixed top-16 left-4 right-4 z-[99999] animate-fade-in-up"
            style={{
                position: 'fixed',
                top: '4rem',
                left: '1rem',
                right: '1rem',
                zIndex: 99999
            }}
        >
            <div className="bg-green-600 text-white p-4 rounded-xl shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <i className="fas fa-sync-alt text-2xl animate-spin"></i>
                        <div>
                            <p className="font-bold text-base">Nova Versão Disponível!</p>
                            <p className="text-sm opacity-90">Clique para atualizar agora</p>
                        </div>
                    </div>
                    <button
                        onClick={onUpdate}
                        className="flex-shrink-0 px-6 py-3 bg-white text-green-600 text-sm font-bold rounded-lg hover:bg-green-50 transition-colors shadow-lg"
                    >
                        Atualizar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;