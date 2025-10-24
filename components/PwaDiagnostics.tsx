import React, { useState, useEffect } from 'react';

const PwaDiagnostics: React.FC = () => {
    const [diagnostics, setDiagnostics] = useState<{
        hasServiceWorker: boolean;
        swState: string;
        hasManifest: boolean;
        isHttps: boolean;
        isStandalone: boolean;
        canInstall: boolean;
        browser: string;
    } | null>(null);

    useEffect(() => {
        const runDiagnostics = async () => {
            const results = {
                hasServiceWorker: 'serviceWorker' in navigator,
                swState: 'unknown',
                hasManifest: false,
                isHttps: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
                isStandalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
                canInstall: false,
                browser: getBrowserName()
            };

            // Check Service Worker state
            if (results.hasServiceWorker) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    results.swState = registration.active?.state || 'no active worker';
                } catch (e) {
                    results.swState = 'error';
                }
            }

            // Check for manifest
            try {
                const response = await fetch('/manifest.json');
                results.hasManifest = response.ok;
            } catch (e) {
                results.hasManifest = false;
            }

            setDiagnostics(results);
        };

        runDiagnostics();

        // Listen for install prompt
        const handler = () => {
            setDiagnostics(prev => prev ? { ...prev, canInstall: true } : null);
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const getBrowserName = () => {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        return 'Desconhecido';
    };

    if (!diagnostics) {
        return <div className="text-sm text-slate-500">Carregando diagnóstico...</div>;
    }

    const DiagnosticItem: React.FC<{ label: string; value: boolean | string; isGood?: boolean }> = ({ label, value, isGood }) => {
        const displayValue = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : value;
        const color = typeof value === 'boolean' 
            ? (value === isGood ? 'text-green-600' : 'text-red-600')
            : 'text-slate-700';
        
        return (
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">{label}:</span>
                <span className={`text-sm font-semibold ${color}`}>{displayValue}</span>
            </div>
        );
    };

    return (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <i className="fas fa-stethoscope"></i>
                Diagnóstico PWA
            </h4>
            <div className="space-y-1">
                <DiagnosticItem label="Navegador" value={diagnostics.browser} />
                <DiagnosticItem label="HTTPS/Localhost" value={diagnostics.isHttps} isGood={true} />
                <DiagnosticItem label="Service Worker" value={diagnostics.hasServiceWorker} isGood={true} />
                <DiagnosticItem label="SW Status" value={diagnostics.swState} />
                <DiagnosticItem label="Manifest" value={diagnostics.hasManifest} isGood={true} />
                <DiagnosticItem label="Já Instalado" value={diagnostics.isStandalone} isGood={true} />
                <DiagnosticItem label="Pode Instalar" value={diagnostics.canInstall} isGood={true} />
            </div>
            
            {!diagnostics.isHttps && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    ⚠️ PWA requer HTTPS ou localhost
                </div>
            )}
            
            {!diagnostics.hasServiceWorker && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    ⚠️ Service Workers não suportados neste navegador
                </div>
            )}
            
            {diagnostics.browser === 'Safari' && !diagnostics.isStandalone && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    ℹ️ Safari não suporta prompt automático. Use: Compartilhar → Adicionar à Tela de Início
                </div>
            )}
        </div>
    );
};

export default PwaDiagnostics;