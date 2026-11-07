import React, { useEffect, useState } from 'react';
import { LoaderCircle, QrCode, SearchX } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { formatStockMeters } from '../../src/lib/estoqueDimensions';
import { ESTOQUE_STATUS_META, type EstoqueStatusTone } from './estoque/estoqueStatus';
import { PieceShape, RollEnd, stockLevelTone } from './estoque/EstoqueVisuals';

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

// A cor do status fica só no ponto, como nos cartões do Estoque no app.
const DOT: Record<EstoqueStatusTone, string> = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    muted: 'bg-slate-400',
    danger: 'bg-rose-500',
};

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const meters = (cm: number) => decimal.format(cm / 100);

/** Página aberta ao ler o QR Code da etiqueta: o que é a peça e quanto resta. */
const EstoquePublicoView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PublicEstoqueData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('qr') || params.get('code') || '';

        if (!code) {
            setLoading(false);
            setError('O endereço não trouxe o código da etiqueta');
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
                setError(result?.error || 'Este código não está no estoque');
                setLoading(false);
                return;
            }

            setData(result.data as PublicEstoqueData);
            setLoading(false);
        } catch (err: any) {
            setError(err?.message || 'Erro ao consultar a etiqueta');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--surface-muted)] px-4 py-8 text-[var(--text-body)] sm:py-16">
            <main className="mx-auto w-full max-w-md">
                <header className="flex items-center gap-2 text-[var(--text-muted)]">
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    <span className="text-sm font-medium text-[var(--text-strong)]">Películas BR</span>
                    <span className="text-sm">· Consulta pela etiqueta</span>
                </header>

                <div className="mt-4">
                    {loading ? (
                        <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]">
                            <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
                            <p className="text-sm">Consultando a etiqueta</p>
                        </section>
                    ) : error ? (
                        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
                            <SearchX className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
                            <h1 className="mt-3 text-base font-semibold text-[var(--text-strong)]">Não foi possível consultar</h1>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{error}</p>
                        </section>
                    ) : data ? (
                        <ItemDetails data={data} />
                    ) : null}
                </div>
            </main>
        </div>
    );
};

const ItemDetails: React.FC<{ data: PublicEstoqueData }> = ({ data }) => {
    const isBobina = data.tipo === 'bobina';
    const meta = ESTOQUE_STATUS_META[data.status?.toLowerCase() || ''];
    const statusLabel = meta?.label ?? (data.status || 'Sem status');
    const dot = DOT[meta?.tone ?? 'muted'];
    const active = data.status === 'ativa' || data.status === 'disponivel';

    const total = data.comprimentoTotalM ?? 0;
    const restante = data.comprimentoRestanteM ?? 0;
    const ratio = total > 0 ? restante / total : 0;
    const comprimentoCm = data.comprimentoCm ?? 0;
    const areaM2 = typeof data.areaM2 === 'number' ? data.areaM2 : (data.larguraCm * comprimentoCm) / 10000;
    const retalhos = isBobina ? data.retalhosAssociados ?? [] : [];

    const rows: Array<{ label: string; value: string; mono?: boolean }> = [
        ...(isBobina
            ? [
                { label: 'Largura', value: `${meters(data.larguraCm)} m` },
                { label: 'Comprimento total', value: `${formatStockMeters(total)} m` },
            ]
            : [{ label: 'Área', value: `${decimal.format(areaM2)} m²` }]),
        { label: 'Local', value: data.localizacao || 'Não informado' },
        { label: 'Cadastrado em', value: formatDate(data.dataCadastro) },
        { label: 'Código da etiqueta', value: data.codigoQr, mono: true },
    ];

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                <div className="flex items-center gap-5 p-5">
                    {isBobina
                        ? <RollEnd ratio={ratio} active={active} size={104} />
                        : <PieceShape larguraCm={data.larguraCm} comprimentoCm={comprimentoCm} status={data.status} size={104} />}
                    <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span>{isBobina ? 'Bobina' : 'Retalho'}{data.id ? ` #${data.id}` : ''}</span>
                            <span aria-hidden="true">·</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
                            <span>{statusLabel}</span>
                        </p>
                        <h1 className="mt-1 text-xl font-semibold leading-tight text-[var(--text-strong)]">{data.filmId}</h1>
                        {isBobina ? (
                            <p className="mt-2 tabular-nums text-[var(--text-muted)]">
                                <span className="text-2xl font-semibold text-[var(--text-strong)]">{formatStockMeters(restante)} m</span>
                                <span className="text-sm"> de {formatStockMeters(total)} m</span>
                            </p>
                        ) : (
                            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-strong)]">
                                {meters(data.larguraCm)} × {meters(comprimentoCm)} m
                            </p>
                        )}
                    </div>
                </div>

                {isBobina ? (
                    <div className="px-5 pb-5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                            <div className={`h-full rounded-full bg-current ${stockLevelTone(ratio, active)}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }} />
                        </div>
                        <p className="mt-2 text-xs tabular-nums text-[var(--text-muted)]">Restam {Math.round(Math.max(0, Math.min(1, ratio)) * 100)}% da bobina</p>
                    </div>
                ) : null}

                <dl className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                    {rows.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
                            <dt className="shrink-0 text-sm text-[var(--text-muted)]">{row.label}</dt>
                            <dd className={`min-w-0 break-all text-right text-sm tabular-nums text-[var(--text-strong)] ${row.mono ? 'font-mono text-xs' : ''}`}>{row.value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            {retalhos.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                    <h2 className="px-5 pb-1 pt-4 text-sm font-semibold text-[var(--text-strong)]">
                        Retalhos desta bobina <span className="font-normal tabular-nums text-[var(--text-muted)]">{retalhos.length}</span>
                    </h2>
                    <ul className="divide-y divide-[var(--border-subtle)]">
                        {retalhos.map((retalho) => {
                            const retalhoMeta = ESTOQUE_STATUS_META[retalho.status];
                            return (
                                <li key={retalho.id} className="flex items-center gap-3 px-5 py-3">
                                    <PieceShape larguraCm={retalho.larguraCm} comprimentoCm={retalho.comprimentoCm} status={retalho.status} size={40} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium tabular-nums text-[var(--text-strong)]">
                                            {meters(retalho.larguraCm)} × {meters(retalho.comprimentoCm)} m
                                        </p>
                                        <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">{retalho.codigoQr}</p>
                                    </div>
                                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                        <span className={`h-1.5 w-1.5 rounded-full ${DOT[retalhoMeta?.tone ?? 'muted']}`} aria-hidden="true" />
                                        {retalhoMeta?.label ?? retalho.status}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ) : null}
        </div>
    );
};

function formatDate(value?: string) {
    if (!value) return 'Não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Não informado';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default EstoquePublicoView;
