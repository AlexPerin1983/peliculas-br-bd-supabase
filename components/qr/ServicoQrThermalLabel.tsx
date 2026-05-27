import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ServicoPrestado, gerarUrlServico } from '../../services/servicosService';

export const NIMBOT_LABEL_FORMATS = {
    '40x60': {
        label: '40 x 60 mm',
        widthMm: 40,
        heightMm: 60,
        qrSizePx: 104,
        recommended: true,
        layout: 'vertical' as const,
        helper: 'Mais seguro para QR de servico'
    },
    '50x50': {
        label: '50 x 50 mm',
        widthMm: 50,
        heightMm: 50,
        qrSizePx: 110,
        recommended: false,
        layout: 'vertical' as const,
        helper: 'Formato quadrado com mais area'
    },
    '50x30': {
        label: '50 x 30 mm',
        widthMm: 50,
        heightMm: 30,
        qrSizePx: 70,
        recommended: false,
        layout: 'horizontal' as const,
        helper: 'Formato compacto horizontal'
    }
};

export type NimbotLabelFormat = keyof typeof NIMBOT_LABEL_FORMATS;

interface ServicoQrThermalLabelProps {
    servico: ServicoPrestado | null;
    format: NimbotLabelFormat;
    className?: string;
}

const multiLineClamp = (lines: number): React.CSSProperties => ({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden'
});

const getTypeLabel = (tipo?: ServicoPrestado['tipo_local']) => {
    switch (tipo) {
        case 'residencial':
            return 'Residencial';
        case 'comercial':
            return 'Comercial';
        case 'condominio':
            return 'Condominio';
        case 'empresa':
            return 'Empresa';
        case 'outros':
            return 'Outros';
        default:
            return 'Aplicacao';
    }
};

const getFilmText = (servico: ServicoPrestado | null) =>
    servico?.filme_aplicado?.trim() || 'Pelicula aplicada';

const getPrimaryReference = (servico: ServicoPrestado | null) =>
    servico?.cliente_nome?.trim() || 'Aplicacao registrada';

const getSecondaryReference = (servico: ServicoPrestado | null) => {
    const location = [servico?.cidade?.trim(), servico?.uf?.trim()].filter(Boolean).join(' / ');
    return location || getTypeLabel(servico?.tipo_local);
};

const ServicoQrThermalLabel = React.forwardRef<HTMLDivElement, ServicoQrThermalLabelProps>(
    ({ servico, format, className = '' }, ref) => {
        const config = NIMBOT_LABEL_FORMATS[format];
        const qrUrl = servico ? gerarUrlServico(servico.codigo_qr) : '';
        const isHorizontal = config.layout === 'horizontal';

        const rootStyle: React.CSSProperties = {
            width: `${config.widthMm}mm`,
            minWidth: `${config.widthMm}mm`,
            height: `${config.heightMm}mm`,
            boxSizing: 'border-box',
            overflow: 'hidden',
            borderRadius: 0,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            fontFamily: 'Arial, Helvetica, sans-serif',
            boxShadow: 'none'
        };

        const shellStyle: React.CSSProperties = {
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: isHorizontal ? '2mm' : '2.2mm',
            display: 'flex',
            flexDirection: isHorizontal ? 'row' : 'column',
            gap: isHorizontal ? '1.6mm' : '1.2mm'
        };

        const eyebrowStyle: React.CSSProperties = {
            fontSize: isHorizontal ? 5 : 5.5,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#475569',
            ...multiLineClamp(1)
        };

        const metaStyle: React.CSSProperties = {
            fontSize: isHorizontal ? 4.8 : 5.1,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: '#64748b',
            ...multiLineClamp(1)
        };

        const referenceStyle: React.CSSProperties = {
            fontSize: isHorizontal ? 6.3 : 6.7,
            lineHeight: 1.08,
            color: '#334155',
            fontWeight: 500,
            ...multiLineClamp(2)
        };

        const secondaryReferenceStyle: React.CSSProperties = {
            fontSize: isHorizontal ? 5.7 : 6.1,
            lineHeight: 1.06,
            color: '#64748b',
            ...multiLineClamp(1)
        };

        const filmStyle: React.CSSProperties = {
            fontSize: isHorizontal ? 9 : 10.6,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '0.02em',
            color: '#0f172a',
            textTransform: 'uppercase',
            ...multiLineClamp(2)
        };

        const codeStyle: React.CSSProperties = {
            fontSize: isHorizontal ? 4.9 : 5.1,
            lineHeight: 1.1,
            color: '#64748b',
            ...multiLineClamp(1)
        };

        const qrFrameStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isHorizontal ? '0.7mm' : '0.9mm',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            flexShrink: 0,
            boxSizing: 'border-box'
        };

        const placeholder = (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    justifyContent: 'space-between'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <div style={eyebrowStyle}>Etiqueta termica</div>
                    <div style={metaStyle}>{config.label}</div>
                </div>

                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        border: '1px dashed #cbd5e1',
                        padding: isHorizontal ? '2mm' : '2.6mm',
                        textAlign: 'center'
                    }}
                >
                    <div
                        style={{
                            width: isHorizontal ? '15mm' : '20.5mm',
                            height: isHorizontal ? '15mm' : '20.5mm',
                            border: '1px solid #cbd5e1',
                            background:
                                'linear-gradient(135deg, rgba(241, 245, 249, 1), rgba(255, 255, 255, 1))'
                        }}
                    />
                    <div style={{ ...filmStyle, fontSize: isHorizontal ? 8 : 9.2 }}>Preview da etiqueta</div>
                    <div style={{ ...referenceStyle, maxWidth: '92%' }}>
                        Salve um servico para gerar o QR no tamanho selecionado.
                    </div>
                </div>
            </div>
        );

        if (!servico) {
            return (
                <div ref={ref} className={className} style={rootStyle}>
                    <div style={shellStyle}>{placeholder}</div>
                </div>
            );
        }

        const primaryReferenceText = getPrimaryReference(servico);
        const secondaryReferenceText = getSecondaryReference(servico);
        const filmText = getFilmText(servico);

        if (isHorizontal) {
            return (
                <div ref={ref} className={className} style={rootStyle}>
                    <div style={{ ...shellStyle, alignItems: 'stretch' }}>
                        <div
                            style={{
                                ...qrFrameStyle,
                                width: '17.8mm',
                                minWidth: '17.8mm',
                                height: '100%'
                            }}
                        >
                            <QRCodeSVG value={qrUrl} size={config.qrSizePx} level="H" includeMargin={false} />
                        </div>

                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 1,
                                paddingLeft: '1.2mm',
                                borderLeft: '1px solid #e2e8f0'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <div style={eyebrowStyle}>Padrao da aplicacao</div>
                                <div style={metaStyle}>{getTypeLabel(servico.tipo_local)}</div>
                            </div>
                            <div style={filmStyle}>{filmText}</div>
                            <div style={referenceStyle}>{primaryReferenceText}</div>
                            <div style={secondaryReferenceStyle}>{secondaryReferenceText}</div>
                            <div style={{ ...codeStyle, paddingTop: 1.5, borderTop: '1px solid #e2e8f0' }}>
                                {servico.codigo_qr}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div ref={ref} className={className} style={rootStyle}>
                <div
                    style={{
                        ...shellStyle,
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <div style={eyebrowStyle}>Padrao da aplicacao</div>
                        <div style={metaStyle}>{getTypeLabel(servico.tipo_local)}</div>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '17.4mm minmax(0, 1fr)',
                            gap: '1.2mm',
                            alignItems: 'center',
                            flex: 1,
                            minHeight: 0
                        }}
                    >
                        <div style={qrFrameStyle}>
                            <QRCodeSVG value={qrUrl} size={config.qrSizePx} level="H" includeMargin={false} />
                        </div>

                        <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                            <div style={filmStyle}>{filmText}</div>
                            <div style={referenceStyle}>{primaryReferenceText}</div>
                            <div style={secondaryReferenceStyle}>{secondaryReferenceText}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, borderTop: '1px solid #e2e8f0', paddingTop: '1mm' }}>
                        <div style={{ ...codeStyle, flex: 1, minWidth: 0 }}>{servico.codigo_qr}</div>
                        <div style={{ ...codeStyle, textAlign: 'right', maxWidth: '46%' }}>{secondaryReferenceText}</div>
                    </div>
                </div>
            </div>
        );
    }
);

ServicoQrThermalLabel.displayName = 'ServicoQrThermalLabel';

export default ServicoQrThermalLabel;
