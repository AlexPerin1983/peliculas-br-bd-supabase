import React, { useEffect, useState } from 'react';
import { useFeedback } from '../src/contexts/FeedbackContext';

const PwaDiagnostics: React.FC = () => {
    const { confirm, showAlert } = useFeedback();
    const [diagnostics, setDiagnostics] = useState<{
        hasServiceWorker: boolean;
        swState: string;
        swScope: string;
        hasManifest: boolean;
        manifestUrl: string;
        isHttps: boolean;
        isStandalone: boolean;
        canInstall: boolean;
        browser: string;
        isInIframe: boolean;
        hasIcons: boolean;
    } | null>(null);

    useEffect(() => {
        const runDiagnostics = async () => {
            const results = {
                hasServiceWorker: 'serviceWorker' in navigator,
                swState: 'unknown',
                swScope: 'unknown',
                hasManifest: false,
                manifestUrl: '',
                isHttps: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
                isStandalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
                canInstall: false,
                browser: getBrowserName(),
                isInIframe: window.self !== window.top,
                hasIcons: false
            };

            if (results.hasServiceWorker) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                        results.swState = registration.active?.state || 'installing';
                        results.swScope = registration.scope;
                    } else {
                        results.swState = 'not registered';
                    }
                } catch (error) {
                    results.swState = 'error';
                }
            }

            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) {
                results.manifestUrl = manifestLink.getAttribute('href') || '';
                try {
                    const response = await fetch(results.manifestUrl);
                    results.hasManifest = response.ok;

                    if (response.ok) {
                        const manifest = await response.json();
                        results.hasIcons = manifest.icons && manifest.icons.length > 0;
                    }
                } catch (error) {
                    results.hasManifest = false;
                }
            }

            setDiagnostics(results);
        };

        runDiagnostics();

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
        return <div className="text-sm text-slate-500">Carregando diagnostico...</div>;
    }

    const DiagnosticItem: React.FC<{ label: string; value: boolean | string; isGood?: boolean }> = ({ label, value, isGood }) => {
        const displayValue = typeof value === 'boolean' ? (value ? 'Sim' : 'Nao') : value;
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

    const issues: string[] = [];

    if (!diagnostics.isHttps) issues.push('Requer HTTPS ou localhost');
    if (!diagnostics.hasServiceWorker) issues.push('Service Worker nao suportado');
    if (diagnostics.swState !== 'activated') issues.push('Service Worker nao esta ativo');
    if (!diagnostics.hasManifest) issues.push('Manifest.json nao encontrado');
    if (!diagnostics.hasIcons) issues.push('Icones nao configurados no manifest');
    if (diagnostics.isInIframe) issues.push('Rodando em iframe (nao pode instalar)');

    const handleForceUpdate = async () => {
        const shouldForceUpdate = await confirm({
            title: 'Forcar atualizacao',
            message: 'Isso vai atualizar os arquivos do app sem apagar os dados salvos. Deseja continuar?',
            confirmButtonText: 'Atualizar agora',
            presentation: 'auto'
        });

        if (!shouldForceUpdate) {
            return;
        }

        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }

            window.location.reload();
        } catch (error) {
            console.error('Erro ao forcar atualizacao:', error);
            showAlert({
                title: 'Atualizacao nao concluida',
                message: 'Nao foi possivel atualizar agora. Tente limpar o cache do navegador manualmente.',
                tone: 'error'
            });
        }
    };

    return (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <i className="fas fa-stethoscope"></i>
                Diagnostico PWA <span className="text-xs font-normal text-slate-500">(v68)</span>
            </h4>
            <div className="space-y-1">
                <DiagnosticItem label="Navegador" value={diagnostics.browser} />
                <DiagnosticItem label="HTTPS/Localhost" value={diagnostics.isHttps} isGood={true} />
                <DiagnosticItem label="Service Worker" value={diagnostics.hasServiceWorker} isGood={true} />
                <DiagnosticItem label="SW Status" value={diagnostics.swState} />
                <DiagnosticItem label="SW Scope" value={diagnostics.swScope} />
                <DiagnosticItem label="Manifest" value={diagnostics.hasManifest} isGood={true} />
                <DiagnosticItem label="Icones" value={diagnostics.hasIcons} isGood={true} />
                <DiagnosticItem label="Em Iframe" value={diagnostics.isInIframe} isGood={false} />
                <DiagnosticItem label="Ja Instalado" value={diagnostics.isStandalone} isGood={true} />
                <DiagnosticItem label="Pode Instalar" value={diagnostics.canInstall} isGood={true} />
            </div>

            {issues.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800 mb-2">Problemas detectados:</p>
                    <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                        {issues.map((issue, index) => <li key={index}>{issue}</li>)}
                    </ul>
                </div>
            )}

            {diagnostics.browser === 'Safari' && !diagnostics.isStandalone && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    Safari: use Compartilhar e depois Adicionar a Tela de Inicio.
                </div>
            )}

            {diagnostics.isInIframe && (
                <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                    PWAs nao podem ser instalados dentro de iframes. Abra em uma nova janela.
                </div>
            )}

            {!diagnostics.hasIcons && diagnostics.hasManifest && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    Gere os icones em <code className="bg-blue-100 px-1 rounded">/icon-generator.html</code>
                </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                    onClick={handleForceUpdate}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <i className="fas fa-sync-alt"></i>
                    Forcar Atualizacao (Manter Dados)
                </button>
                <p className="mt-2 text-xs text-slate-500 text-center">
                    Use isso se o app estiver preso em uma versao antiga. Seus orcamentos salvos nao serao apagados.
                </p>
            </div>
        </div>
    );
};

export default PwaDiagnostics;
