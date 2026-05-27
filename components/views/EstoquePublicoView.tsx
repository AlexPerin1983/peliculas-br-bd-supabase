import React, { useEffect, useState } from 'react';
import { Package, Scissors, MapPin, Calendar, QrCode, ShieldAlert, LoaderCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

interface PublicRetalhoData {
    id: number;
    codigoQr: string;
    larguraCm: number;
    comprimentoCm: number;
    status: string;
}

interface PublicEstoqueData {
    id?: number;
    tipo: 'bobina' | 'retalho';
    filmId: string;
    codigoQr: string;
    larguraCm: number;
    comprimentoTotalM?: number;
    comprimentoRestanteM?: number;
    comprimentoCm?: number;
    areaM2?: number;
    status: string;
    localizacao?: string;
    dataCadastro: string;
    retalhosAssociados?: PublicRetalhoData[];
}

const EstoquePublicoView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PublicEstoqueData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('qr') || params.get('code') || '';

        if (!code) {
            setLoading(false);
            setError('Código QR não informado');
            return;
        }

        void fetchData(code);
    }, []);

    const fetchData = async (code: string) => {
        setLoading(true);
        setError(null);

        try {
            const { data: result, error: lookupError } = await supabase.functions.invoke('public-estoque-lookup', {
                body: { code }
            });

            if (lookupError) {
                throw lookupError;
            }

            if (!result?.success || !result?.data) {
                setError(result?.error || 'Item não encontrado no sistema.');
                setLoading(false);
                return;
            }

            setData(result.data as PublicEstoqueData);
            setLoading(false);
        } catch (err: any) {
            setError(err?.message || 'Erro ao consultar item');
            setLoading(false);
        }
    };

    const statusInfo = getStatusInfo(data?.status);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8 text-slate-900">
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
                <div className="w-full overflow-hidden rounded-[32px] border border-white/80 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur">
                    <div className="border-b border-slate-100 bg-slate-950 px-6 py-6 text-white sm:px-8">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                            <QrCode className="h-3.5 w-3.5" />
                            Consulta de material
                        </div>
                        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                            Estoque Películas BR
                        </h1>
                        <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
                            Consulta segura de bobinas e retalhos via QR Code.
                        </p>
                    </div>

                    <div className="px-6 py-8 sm:px-8">
                        {loading ? (
                            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-slate-500">
                                <LoaderCircle className="h-8 w-8 animate-spin" />
                                <p className="text-sm font-medium">Consultando material...</p>
                            </div>
                        ) : error ? (
                            <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="h-5 w-5 shrink-0" />
                                    <div>
                                        <p className="font-semibold">Não foi possível concluir a consulta</p>
                                        <p className="mt-1 text-sm text-red-600">{error}</p>
                                    </div>
                                </div>
                            </div>
                        ) : data ? (
                            <div className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-[1.3fr,0.9fr]">
                                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                    {data.tipo === 'bobina' ? <Package className="h-3.5 w-3.5" /> : <Scissors className="h-3.5 w-3.5" />}
                                                    {data.tipo}
                                                </div>
                                                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                                                    {data.filmId}
                                                </h2>
                                            </div>
                                            <div
                                                className="rounded-full px-3 py-1 text-xs font-semibold"
                                                style={{
                                                    color: statusInfo.color,
                                                    backgroundColor: `${statusInfo.color}1A`
                                                }}
                                            >
                                                {statusInfo.label}
                                            </div>
                                        </div>

                                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                            <InfoCard
                                                label="Largura"
                                                value={`${data.larguraCm} cm`}
                                                icon={<Package className="h-4 w-4" />}
                                            />
                                            <InfoCard
                                                label={data.tipo === 'bobina' ? 'Comprimento restante' : 'Comprimento'}
                                                value={
                                                    data.tipo === 'bobina'
                                                        ? `${data.comprimentoRestanteM ?? 0} m`
                                                        : `${data.comprimentoCm ?? 0} cm`
                                                }
                                                icon={<Scissors className="h-4 w-4" />}
                                            />
                                            <InfoCard
                                                label="Localização"
                                                value={data.localizacao || 'Não informada'}
                                                icon={<MapPin className="h-4 w-4" />}
                                            />
                                            <InfoCard
                                                label="Cadastro"
                                                value={formatDate(data.dataCadastro)}
                                                icon={<Calendar className="h-4 w-4" />}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                            Código QR
                                        </p>
                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="break-all text-sm font-medium text-slate-700">
                                                {data.codigoQr}
                                            </p>
                                        </div>

                                        {typeof data.comprimentoTotalM === 'number' && (
                                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                    Comprimento total
                                                </p>
                                                <p className="mt-2 text-xl font-semibold text-slate-950">
                                                    {data.comprimentoTotalM} m
                                                </p>
                                            </div>
                                        )}

                                        {typeof data.areaM2 === 'number' && (
                                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                    Área
                                                </p>
                                                <p className="mt-2 text-xl font-semibold text-slate-950">
                                                    {data.areaM2.toFixed(2)} m²
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {data.tipo === 'bobina' && data.retalhosAssociados && data.retalhosAssociados.length > 0 && (
                                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Scissors className="h-4 w-4 text-slate-500" />
                                            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                                                Retalhos associados
                                            </h3>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            {data.retalhosAssociados.map((retalho) => (
                                                <div
                                                    key={retalho.id}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {retalho.larguraCm} x {retalho.comprimentoCm} cm
                                                        </p>
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                                                            {retalho.status}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 break-all text-xs text-slate-500">
                                                        {retalho.codigoQr}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

function getStatusInfo(status?: string) {
    const normalized = status?.toLowerCase() || '';

    switch (normalized) {
        case 'ativa':
        case 'disponivel':
            return { label: 'Disponível', color: '#16a34a' };
        case 'finalizada':
        case 'usado':
            return { label: 'Finalizado', color: '#d97706' };
        case 'descartada':
        case 'descartado':
            return { label: 'Descartado', color: '#dc2626' };
        case 'reservado':
            return { label: 'Reservado', color: '#2563eb' };
        default:
            return { label: status || 'Status indisponível', color: '#64748b' };
    }
}

function formatDate(value?: string) {
    if (!value) return 'Não informado';

    try {
        return new Date(value).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (_error) {
        return 'Não informado';
    }
}

const InfoCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-slate-400">
            {icon}
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
);

export default EstoquePublicoView;
