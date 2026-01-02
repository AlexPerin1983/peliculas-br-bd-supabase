import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface ServicoData {
    id: number;
    codigo_qr: string;
    cliente_nome: string;
    endereco?: string;
    cidade?: string;
    uf?: string;
    tipo_local?: string;
    filme_aplicado: string;
    filme_detalhes?: {
        uv?: number;
        ir?: number;
        vtl?: number;
        garantiaFabricante?: number;
        garantiaMaoDeObra?: number;
        espessura?: number;
        tser?: number;
    };
    metros_aplicados?: number;
    data_servico: string;
    observacoes?: string;
    empresa_nome: string;
    empresa_telefone?: string;
    empresa_email?: string;
    empresa_site?: string;
    empresa_endereco?: string;
    empresa_logo?: string;
    empresa_cores?: {
        primaria?: string;
        secundaria?: string;
    };
}

const ServicoPublicoView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ServicoData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [qrCode, setQrCode] = useState<string>('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('servico') || params.get('s') || '';
        setQrCode(code);

        if (code) {
            fetchData(code);
        } else {
            setLoading(false);
            setError('Código de serviço não informado');
        }
    }, []);

    const fetchData = async (code: string) => {
        setLoading(true);
        setError(null);

        try {
            const { data: servico, error: servicoError } = await supabase
                .from('servicos_prestados')
                .select('*')
                .eq('codigo_qr', code)
                .limit(1)
                .maybeSingle();

            if (servicoError) {
                console.error('Erro Supabase:', servicoError);
                setError('Erro ao buscar informações do serviço.');
                setLoading(false);
                return;
            }

            if (servico) {
                setData(servico);
            } else {
                setError('Serviço não encontrado no sistema.');
            }

            setLoading(false);
        } catch (err: any) {
            console.error('Erro geral:', err);
            setError(`Erro interno: ${err.message}`);
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    const getTipoLocalInfo = (tipo?: string) => {
        const t = tipo?.toLowerCase() || '';
        switch (t) {
            case 'residencial': return { label: 'Residência', icon: '🏠' };
            case 'comercial': return { label: 'Comercial', icon: '🏢' };
            case 'condominio': return { label: 'Condomínio', icon: '🏘️' };
            case 'empresa': return { label: 'Empresa', icon: '🏭' };
            default: return { label: tipo || 'Local', icon: '📍' };
        }
    };

    const handleWhatsApp = () => {
        if (data?.empresa_telefone) {
            const phone = data.empresa_telefone.replace(/\D/g, '');
            const message = encodeURIComponent(
                `Olá! Escaneei o QR Code do serviço realizado em ${data.cliente_nome} e gostaria de solicitar um orçamento para nova aplicação.`
            );
            window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
        }
    };

    const handleEmail = () => {
        if (data?.empresa_email) {
            const subject = encodeURIComponent('Solicitação de Orçamento - Película');
            const body = encodeURIComponent(
                `Olá!\n\nEscaneei o QR Code do serviço realizado em ${data.cliente_nome}.\nPelícula aplicada: ${data.filme_aplicado}\n\nGostaria de solicitar um orçamento para nova aplicação.\n\nAguardo retorno.`
            );
            window.open(`mailto:${data.empresa_email}?subject=${subject}&body=${body}`, '_blank');
        }
    };

    const handleCall = () => {
        if (data?.empresa_telefone) {
            window.open(`tel:${data.empresa_telefone}`, '_blank');
        }
    };

    // Cores dinâmicas da empresa
    const primaryColor = data?.empresa_cores?.primaria || '#3b82f6';
    const secondaryColor = data?.empresa_cores?.secundaria || '#1e40af';

    // Função para determinar cor de texto baseada na cor de fundo
    const getContrastColor = (hexColor: string) => {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#1e293b' : '#ffffff';
    };

    const textOnPrimary = getContrastColor(primaryColor);

    return (
        <div
            className="servico-premium-page"
            style={{
                '--primary-color': primaryColor,
                '--secondary-color': secondaryColor,
                '--text-on-primary': textOnPrimary,
            } as React.CSSProperties}
        >
            {/* Loading State */}
            {loading && (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Carregando informações...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="error-container">
                    <div className="error-icon">❌</div>
                    <h2>Serviço não encontrado</h2>
                    <p>{error}</p>
                    {qrCode && <code className="error-code">{qrCode}</code>}
                </div>
            )}

            {/* Main Content */}
            {data && (
                <>
                    {/* ========== ZONA DE CONFIANÇA (HEADER) ========== */}
                    <header className="trust-zone">
                        <div className="trust-zone-bg"></div>
                        <div className="trust-content">
                            {/* Logo e Nome */}
                            <div className="company-identity">
                                {data.empresa_logo ? (
                                    <img src={data.empresa_logo} alt={data.empresa_nome} className="company-logo" />
                                ) : (
                                    <div className="company-logo-placeholder">
                                        {data.empresa_nome?.charAt(0) || '🎞️'}
                                    </div>
                                )}
                                <h1 className="company-name">{data.empresa_nome}</h1>
                            </div>

                            {/* Badge de Verificação Premium */}
                            <div className="verified-badge">
                                <div className="badge-icon">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                                    </svg>
                                </div>
                                <div className="badge-text">
                                    <span className="badge-title">Aplicação Certificada</span>
                                    <span className="badge-subtitle">Serviço verificado e rastreável</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ========== ZONA HERO - PELÍCULA EM DESTAQUE ========== */}
                    <section className="hero-zone">
                        <div className="hero-card">
                            <div className="hero-glow"></div>

                            {/* Tipo de Local */}
                            <div className="location-tag">
                                <span className="location-icon">{getTipoLocalInfo(data.tipo_local).icon}</span>
                                <span>{getTipoLocalInfo(data.tipo_local).label}</span>
                            </div>

                            {/* Nome do Local */}
                            <h2 className="location-name">{data.cliente_nome}</h2>

                            {/* Endereço */}
                            {(data.endereco || data.cidade) && (
                                <p className="location-address">
                                    {data.endereco}{data.cidade && `, ${data.cidade}`}{data.uf && ` - ${data.uf}`}
                                </p>
                            )}

                            {/* Divider */}
                            <div className="hero-divider"></div>

                            {/* PELÍCULA - ELEMENTO DOMINANTE */}
                            <div className="film-hero">
                                <span className="film-label">Película Aplicada</span>
                                <h3 className="film-name">{data.filme_aplicado}</h3>
                                <span className="film-subtitle">Película Profissional de Controle Solar</span>
                            </div>

                            {/* Data do Serviço */}
                            <div className="service-date">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
                                </svg>
                                <span>Aplicado em {formatDate(data.data_servico)}</span>
                            </div>
                        </div>
                    </section>

                    {/* ========== INDICADORES TÉCNICOS ========== */}
                    {data.filme_detalhes && (
                        <section className="tech-zone">
                            <h4 className="tech-title">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                                </svg>
                                Especificações Técnicas
                            </h4>

                            <div className="tech-grid">
                                {data.filme_detalhes.uv && (
                                    <div className="tech-indicator">
                                        <div className="indicator-header">
                                            <span className="indicator-label">Proteção UV</span>
                                            <span className="indicator-value">{data.filme_detalhes.uv}%</span>
                                        </div>
                                        <div className="indicator-bar">
                                            <div
                                                className="indicator-fill uv"
                                                style={{ width: `${data.filme_detalhes.uv}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {data.filme_detalhes.ir && (
                                    <div className="tech-indicator">
                                        <div className="indicator-header">
                                            <span className="indicator-label">Rejeição Infravermelho</span>
                                            <span className="indicator-value">{data.filme_detalhes.ir}%</span>
                                        </div>
                                        <div className="indicator-bar">
                                            <div
                                                className="indicator-fill ir"
                                                style={{ width: `${data.filme_detalhes.ir}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {data.filme_detalhes.vtl && (
                                    <div className="tech-indicator">
                                        <div className="indicator-header">
                                            <span className="indicator-label">Transmissão de Luz</span>
                                            <span className="indicator-value">{data.filme_detalhes.vtl}%</span>
                                        </div>
                                        <div className="indicator-bar">
                                            <div
                                                className="indicator-fill vtl"
                                                style={{ width: `${Math.min(data.filme_detalhes.vtl, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {data.filme_detalhes.garantiaFabricante && (
                                    <div className="tech-indicator warranty">
                                        <div className="warranty-icon">
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                                            </svg>
                                        </div>
                                        <div className="warranty-info">
                                            <span className="warranty-label">Garantia de Fábrica</span>
                                            <span className="warranty-value">{data.filme_detalhes.garantiaFabricante} anos</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {data.metros_aplicados && (
                                <div className="area-applied">
                                    <span className="area-label">Área Total Aplicada</span>
                                    <span className="area-value">{data.metros_aplicados.toFixed(2)} m²</span>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ========== BLOCO DE PADRONIZAÇÃO ========== */}
                    <section className="standardization-zone">
                        <div className="standardization-card">
                            <div className="standardization-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                                </svg>
                            </div>
                            <div className="standardization-content">
                                <h4>Garantia de Padronização Visual</h4>
                                <p>
                                    Para manter a <strong>uniformidade estética</strong> e evitar variações de
                                    tonalidade, futuras aplicações devem utilizar a mesma película.
                                </p>
                                <div className="film-reminder-chip">
                                    <span className="chip-icon">🎞️</span>
                                    <span className="chip-text">{data.filme_aplicado}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ========== CTA - AÇÃO COMERCIAL ========== */}
                    <section className="cta-zone">
                        <div className="cta-header">
                            <h4>Precisa expandir ou manter o padrão?</h4>
                            <p>Solicite um orçamento sem compromisso</p>
                        </div>

                        <div className="cta-buttons">
                            {data.empresa_telefone && (
                                <button className="cta-btn primary" onClick={handleWhatsApp}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                    </svg>
                                    <span>WhatsApp</span>
                                </button>
                            )}

                            {data.empresa_telefone && (
                                <button className="cta-btn secondary" onClick={handleCall}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                                    <span>Ligar</span>
                                </button>
                            )}

                            {data.empresa_email && (
                                <button className="cta-btn secondary" onClick={handleEmail}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                    </svg>
                                    <span>E-mail</span>
                                </button>
                            )}
                        </div>

                        {/* Info da Empresa */}
                        <div className="company-footer">
                            <p className="company-footer-name">{data.empresa_nome}</p>
                            {data.empresa_endereco && (
                                <p className="company-footer-address">{data.empresa_endereco}</p>
                            )}
                            {data.empresa_site && (
                                <a
                                    href={data.empresa_site.startsWith('http') ? data.empresa_site : `https://${data.empresa_site}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="company-footer-site"
                                >
                                    🌐 {data.empresa_site}
                                </a>
                            )}
                        </div>
                    </section>

                    {/* ========== RASTREABILIDADE ========== */}
                    <footer className="traceability-zone">
                        <div className="trace-content">
                            <div className="trace-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 0h-2v2h2v-2zm0-8h-2v2h2V7zm2 2h-2v2h2V9zm-4 8h-2v2h2v-2zm2 0h-2v2h2v-2zm2-4h-2v2h2v-2zm0 4h-2v2h2v-2zm0-8h-2v2h2V9z" />
                                </svg>
                            </div>
                            <div className="trace-text">
                                <p className="trace-label">Aplicação registrada e rastreável</p>
                                <code className="trace-code">{qrCode}</code>
                            </div>
                        </div>
                    </footer>
                </>
            )}

            <style>{`
                /* ========== VARIÁVEIS E RESET ========== */
                .servico-premium-page {
                    --primary-color: #3b82f6;
                    --secondary-color: #1e40af;
                    --text-on-primary: #ffffff;
                    
                    min-height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
                    background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
                    color: #e2e8f0;
                    padding-bottom: 2rem;
                }

                /* ========== LOADING ========== */
                .loading-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    gap: 1rem;
                }

                .loading-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid rgba(255,255,255,0.1);
                    border-top-color: var(--primary-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* ========== ERROR ========== */
                .error-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                    padding: 2rem;
                }

                .error-icon { font-size: 4rem; margin-bottom: 1rem; }
                .error-container h2 { margin: 0 0 0.5rem; }
                .error-container p { color: #94a3b8; margin: 0; }
                .error-code { 
                    margin-top: 1rem; 
                    padding: 0.5rem 1rem;
                    background: #1e293b;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    color: #64748b;
                }

                /* ========== TRUST ZONE (HEADER) ========== */
                .trust-zone {
                    position: relative;
                    padding: 2rem 1.5rem 3rem;
                    overflow: hidden;
                }

                .trust-zone-bg {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                }

                .trust-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                    max-width: 500px;
                    margin: 0 auto;
                }

                .company-identity {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                }

                .company-logo {
                    width: 80px;
                    height: 80px;
                    object-fit: contain;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                }

                .company-logo-placeholder {
                    width: 72px;
                    height: 72px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    color: var(--text-on-primary);
                    font-weight: 700;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                }

                .company-name {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: white;
                    text-align: center;
                }

                /* Badge Premium */
                .verified-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(255, 255, 255, 0.95);
                    border: none;
                    border-radius: 50px;
                    padding: 0.5rem 1rem 0.5rem 0.75rem;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }

                .badge-icon {
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .badge-text {
                    display: flex;
                    flex-direction: column;
                }

                .badge-title {
                    font-weight: 600;
                    color: #059669;
                    font-size: 0.9rem;
                }

                .badge-subtitle {
                    font-size: 0.75rem;
                    color: #64748b;
                }

                /* ========== HERO ZONE ========== */
                .hero-zone {
                    padding: 0 1rem;
                    margin-top: -1rem;
                }

                .hero-card {
                    position: relative;
                    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 24px;
                    padding: 2rem 1.5rem;
                    max-width: 500px;
                    margin: 0 auto;
                    overflow: hidden;
                }

                .hero-glow {
                    position: absolute;
                    top: -50%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(ellipse at center, var(--primary-color) 0%, transparent 70%);
                    opacity: 0.08;
                    pointer-events: none;
                }

                .location-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 50px;
                    padding: 0.4rem 0.85rem;
                    font-size: 0.85rem;
                    color: #94a3b8;
                    margin-bottom: 0.75rem;
                }

                .location-icon { font-size: 1rem; }

                .location-name {
                    margin: 0 0 0.25rem;
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: white;
                }

                .location-address {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #64748b;
                }

                .hero-divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
                    margin: 1.5rem 0;
                }

                /* Film Hero - Elemento Dominante */
                .film-hero {
                    text-align: center;
                    position: relative;
                    padding: 1.5rem;
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                    border-radius: 16px;
                    margin-bottom: 1rem;
                }

                .film-label {
                    display: block;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: var(--text-on-primary);
                    opacity: 0.8;
                    margin-bottom: 0.5rem;
                }

                .film-name {
                    margin: 0;
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: var(--text-on-primary);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .film-subtitle {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-on-primary);
                    opacity: 0.8;
                    margin-top: 0.5rem;
                }

                .service-date {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: #64748b;
                }

                /* ========== TECH ZONE ========== */
                .tech-zone {
                    padding: 2rem 1rem;
                    max-width: 500px;
                    margin: 0 auto;
                }

                .tech-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0 0 1.25rem;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .tech-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .tech-indicator {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    padding: 1rem;
                }

                .indicator-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .indicator-label {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }

                .indicator-value {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: white;
                }

                .indicator-bar {
                    height: 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .indicator-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 1s ease-out;
                }

                .indicator-fill.uv {
                    background: linear-gradient(90deg, #a855f7, #7c3aed);
                }

                .indicator-fill.ir {
                    background: linear-gradient(90deg, #f97316, #ea580c);
                }

                .indicator-fill.vtl {
                    background: linear-gradient(90deg, #3b82f6, #2563eb);
                }

                /* Warranty */
                .tech-indicator.warranty {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05));
                    border-color: rgba(16, 185, 129, 0.2);
                }

                .warranty-icon {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .warranty-info {
                    display: flex;
                    flex-direction: column;
                }

                .warranty-label {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .warranty-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #10b981;
                }

                .area-applied {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 1rem;
                    padding: 1rem;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                }

                .area-label {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }

                .area-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: white;
                }

                /* ========== STANDARDIZATION ZONE ========== */
                .standardization-zone {
                    padding: 0 1rem 2rem;
                    max-width: 500px;
                    margin: 0 auto;
                }

                .standardization-card {
                    display: flex;
                    gap: 1rem;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(30, 64, 175, 0.05));
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 16px;
                    padding: 1.25rem;
                }

                .standardization-icon {
                    flex-shrink: 0;
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-on-primary);
                }

                .standardization-content h4 {
                    margin: 0 0 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: white;
                }

                .standardization-content p {
                    margin: 0 0 0.75rem;
                    font-size: 0.85rem;
                    color: #94a3b8;
                    line-height: 1.5;
                }

                .film-reminder-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(255,255,255,0.08);
                    border-radius: 50px;
                    padding: 0.4rem 0.85rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: white;
                }

                /* ========== CTA ZONE ========== */
                .cta-zone {
                    padding: 0 1rem 2rem;
                    max-width: 500px;
                    margin: 0 auto;
                }

                .cta-header {
                    text-align: center;
                    margin-bottom: 1.25rem;
                }

                .cta-header h4 {
                    margin: 0 0 0.25rem;
                    font-size: 1.1rem;
                    color: white;
                }

                .cta-header p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #64748b;
                }

                .cta-buttons {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    margin-bottom: 1.5rem;
                }

                .cta-btn {
                    flex: 1;
                    min-width: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.875rem 1rem;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 0.95rem;
                    border: none;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .cta-btn:active {
                    transform: scale(0.98);
                }

                .cta-btn.primary {
                    background: linear-gradient(135deg, #25d366, #128c7e);
                    color: white;
                    box-shadow: 0 4px 16px rgba(37, 211, 102, 0.3);
                }

                .cta-btn.secondary {
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.15);
                    color: white;
                }

                .company-footer {
                    text-align: center;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255,255,255,0.08);
                }

                .company-footer-name {
                    margin: 0;
                    font-weight: 600;
                    color: white;
                }

                .company-footer-address {
                    margin: 0.25rem 0 0;
                    font-size: 0.85rem;
                    color: #64748b;
                }

                .company-footer-site {
                    display: inline-block;
                    margin-top: 0.5rem;
                    color: var(--primary-color);
                    text-decoration: none;
                    font-size: 0.9rem;
                }

                /* ========== TRACEABILITY ZONE ========== */
                .traceability-zone {
                    padding: 1rem;
                    max-width: 500px;
                    margin: 0 auto;
                }

                .trace-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 50px;
                }

                .trace-icon {
                    width: 32px;
                    height: 32px;
                    background: rgba(255,255,255,0.08);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                }

                .trace-text {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .trace-label {
                    font-size: 0.7rem;
                    color: #64748b;
                    margin: 0;
                }

                .trace-code {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    font-family: 'SF Mono', Monaco, monospace;
                }
            `}</style>
        </div>
    );
};

export default ServicoPublicoView;
