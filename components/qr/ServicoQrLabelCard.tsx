import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ServicoPrestado, gerarUrlServico } from '../../services/servicosService';

interface ServicoQrLabelCardProps {
    servico: ServicoPrestado | null;
    className?: string;
}

const getTipoLocalInfo = (tipo?: string) => {
    const normalized = tipo?.toLowerCase() || '';

    switch (normalized) {
        case 'residencial':
            return { label: 'Residência', icon: '🏠' };
        case 'comercial':
            return { label: 'Comercial', icon: '🏢' };
        case 'condominio':
            return { label: 'Condomínio', icon: '🏘️' };
        case 'empresa':
            return { label: 'Empresa', icon: '🏭' };
        default:
            return { label: tipo || 'Local', icon: '📍' };
    }
};

const getContrastColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#0f172a' : '#ffffff';
};

const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Data não informada';

    return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

const ServicoQrLabelCard = React.forwardRef<HTMLDivElement, ServicoQrLabelCardProps>(
    ({ servico, className = '' }, ref) => {
        const primaryColor = servico?.empresa_cores?.primaria || '#2563eb';
        const secondaryColor = servico?.empresa_cores?.secundaria || '#0f172a';
        const textOnPrimary = getContrastColor(primaryColor);
        const qrUrl = servico ? gerarUrlServico(servico.codigo_qr) : '';
        const tipoLocal = getTipoLocalInfo(servico?.tipo_local);

        return (
            <div
                ref={ref}
                className={[
                    'overflow-hidden rounded-[28px] border border-white/10 shadow-2xl shadow-slate-950/40',
                    'bg-slate-950 text-white',
                    className
                ].join(' ')}
                style={{
                    background: servico
                        ? `linear-gradient(160deg, ${secondaryColor} 0%, #0f172a 54%, ${primaryColor} 100%)`
                        : 'linear-gradient(160deg, #0f172a 0%, #111827 50%, #1e293b 100%)'
                }}
            >
                <div className="relative p-5">
                    <div className="absolute inset-0 opacity-30" style={{
                        background:
                            'radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 32%), radial-gradient(circle at bottom left, rgba(59,130,246,0.25), transparent 30%)'
                    }} />

                    <div className="relative">
                        {servico ? (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <span
                                        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.12)',
                                            color: textOnPrimary
                                        }}
                                    >
                                        <span>{tipoLocal.icon}</span>
                                        <span>{tipoLocal.label}</span>
                                    </span>

                                    <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/80">
                                        Etiqueta rastreável
                                    </span>
                                </div>

                                <div className="mt-5">
                                    <div className="text-center">
                                        <p className="text-lg font-bold tracking-tight text-white">
                                            {servico.empresa_nome}
                                        </p>
                                        <p className="mt-1 text-sm text-white/65">
                                            Aplicação de Película
                                        </p>
                                    </div>

                                    <div className="mt-5 rounded-3xl border border-white/10 bg-white/96 p-4 text-slate-900 shadow-2xl shadow-black/20">
                                        <div className="flex justify-center">
                                            <div className="rounded-2xl bg-white p-2 shadow-lg shadow-slate-900/10">
                                                <QRCodeSVG value={qrUrl} size={176} level="H" includeMargin />
                                            </div>
                                        </div>

                                        <div className="mt-4 text-center">
                                            <p className="text-xl font-bold text-slate-900">
                                                {servico.cliente_nome}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Película: {servico.filme_aplicado}
                                            </p>
                                            <p className="mt-2 text-sm text-slate-400">
                                                {servico.endereco || 'Endereço não informado'}
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                {[
                                                    servico.cidade,
                                                    servico.uf
                                                ].filter(Boolean).join(' - ') || 'Cidade não informada'}
                                            </p>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                            <div>
                                                <p className="font-semibold text-slate-700">Serviço realizado em</p>
                                                <p className="text-slate-500">{formatDate(servico.data_servico)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-slate-700">Área aplicada</p>
                                                <p className="text-slate-500">
                                                    {servico.metros_aplicados ? `${servico.metros_aplicados.toFixed(2)} m²` : 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        {servico.empresa_telefone && (
                                            <div className="mt-4 border-t border-slate-200 pt-3 text-center text-sm text-slate-500">
                                                {servico.empresa_telefone}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-center">
                                        <p className="text-xs uppercase tracking-[0.22em] text-white/50">Código QR</p>
                                        <p className="mt-1 text-sm font-medium text-white/85">{servico.codigo_qr}</p>
                                        <p className="mt-2 text-xs text-white/45">
                                            Escaneie para ver detalhes e solicitar orçamento.
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex min-h-[610px] flex-col items-center justify-center text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/8 text-3xl">
                                    <i className="fas fa-qrcode text-white/70" />
                                </div>
                                <h3 className="mt-6 text-2xl font-bold text-white">
                                    Sua etiqueta QR nasce aqui
                                </h3>
                                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
                                    Preencha o formulário ao lado para gerar o serviço, visualizar a etiqueta e imprimir ou salvar a arte.
                                </p>
                                <div className="mt-6 grid gap-2 text-left text-sm text-white/65">
                                    <p>1. Escolha o cliente ou local.</p>
                                    <p>2. Selecione a película aplicada.</p>
                                    <p>3. Gere a etiqueta e compartilhe o QR.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
);

ServicoQrLabelCard.displayName = 'ServicoQrLabelCard';

export default ServicoQrLabelCard;
