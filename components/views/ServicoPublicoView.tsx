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

const hexToRgba = (hex: string, alpha: number): string => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;
    const r = parseInt(full.substr(0, 2), 16);
    const g = parseInt(full.substr(2, 2), 16);
    const b = parseInt(full.substr(4, 2), 16);
    if ([r, g, b].some(Number.isNaN)) return `rgba(15, 23, 42, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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

    const getTipoLocalLabel = (tipo?: string) => {
        const t = tipo?.toLowerCase() || '';
        switch (t) {
            case 'residencial': return 'Residência';
            case 'comercial': return 'Estabelecimento comercial';
            case 'condominio': return 'Condomínio';
            case 'empresa': return 'Empresa';
            default: return tipo || 'Local';
        }
    };

    const handleWhatsApp = () => {
        if (data?.empresa_telefone) {
            const phone = data.empresa_telefone.replace(/\D/g, '');

            // Montar endereço completo
            const enderecoCompleto = [
                data.endereco,
                data.cidade,
                data.uf
            ].filter(Boolean).join(', ');

            // Formatar data do serviço
            const dataServico = data.data_servico
                ? new Date(data.data_servico).toLocaleDateString('pt-BR')
                : 'N/A';

            // Área aplicada
            const area = data.metros_aplicados
                ? `${data.metros_aplicados.toFixed(2)} m²`
                : 'N/A';

            const message = encodeURIComponent(
                `Olá! Escaneei o QR Code de um serviço anterior e gostaria de um novo orçamento.

📋 *DADOS DO SERVIÇO ANTERIOR:*
━━━━━━━━━━━━━━━━━━━━
🏠 *Local:* ${data.cliente_nome}
📍 *Endereço:* ${enderecoCompleto || 'Não informado'}
🎞️ *Película:* ${data.filme_aplicado}
📐 *Área aplicada:* ${area}
📅 *Data:* ${dataServico}
🔖 *Código:* ${qrCode}
━━━━━━━━━━━━━━━━━━━━

Gostaria de manter o mesmo padrão ou expandir a aplicação. Aguardo retorno!`
            );
            window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
        }
    };

    const handleEmail = () => {
        if (data?.empresa_email) {
            // Montar endereço completo
            const enderecoCompleto = [
                data.endereco,
                data.cidade,
                data.uf
            ].filter(Boolean).join(', ');

            // Formatar data do serviço
            const dataServico = data.data_servico
                ? new Date(data.data_servico).toLocaleDateString('pt-BR')
                : 'N/A';

            // Área aplicada
            const area = data.metros_aplicados
                ? `${data.metros_aplicados.toFixed(2)} m²`
                : 'N/A';

            const subject = encodeURIComponent(`Orçamento - Referente ao serviço em ${data.cliente_nome}`);
            const body = encodeURIComponent(
                `Olá!

Escaneei o QR Code de um serviço anterior e gostaria de solicitar um novo orçamento.

═══════════════════════════════════
DADOS DO SERVIÇO ANTERIOR
═══════════════════════════════════

Local: ${data.cliente_nome}
Tipo: ${getTipoLocalLabel(data.tipo_local)}
Endereço: ${enderecoCompleto || 'Não informado'}

Película Aplicada: ${data.filme_aplicado}
Área Aplicada: ${area}
Data do Serviço: ${dataServico}

Código de Rastreamento: ${qrCode}

═══════════════════════════════════

Gostaria de manter o mesmo padrão de película ou expandir a aplicação para novas áreas.

Aguardo retorno com orçamento.

Atenciosamente.`
            );
            window.open(`mailto:${data.empresa_email}?subject=${subject}&body=${body}`, '_blank');
        }
    };

    const handleCall = () => {
        if (data?.empresa_telefone) {
            window.open(`tel:${data.empresa_telefone}`, '_blank');
        }
    };

    // Cor dinâmica da empresa (usada apenas como acento discreto)
    const brandColor = data?.empresa_cores?.primaria || '#1d4ed8';

    const especificacoes = [
        { label: 'Proteção UV', value: data?.filme_detalhes?.uv },
        { label: 'Rejeição de infravermelho', value: data?.filme_detalhes?.ir },
        { label: 'Transmissão de luz visível', value: data?.filme_detalhes?.vtl }
    ].filter(spec => typeof spec.value === 'number' && !Number.isNaN(spec.value)) as { label: string; value: number }[];

    const enderecoLocal = [
        data?.endereco,
        [data?.cidade, data?.uf].filter(Boolean).join(' – ')
    ].filter(Boolean).join(', ');

    return (
        <div
            className="spv-page"
            style={{
                '--brand': brandColor,
                '--brand-soft': hexToRgba(brandColor, 0.07),
                '--brand-border': hexToRgba(brandColor, 0.22)
            } as React.CSSProperties}
        >
            {/* Loading State */}
            {loading && (
                <div className="spv-state">
                    <div className="spv-spinner" aria-hidden="true"></div>
                    <p>Consultando registro…</p>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="spv-state">
                    <div className="spv-state-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="26" height="26">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v4M12 15.5v.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <h2>Registro não encontrado</h2>
                    <p>{error}</p>
                    {qrCode && <code className="spv-state-code">{qrCode}</code>}
                </div>
            )}

            {/* Main Content */}
            {data && (
                <main className="spv-document">
                    {/* Filete superior com a cor da marca */}
                    <div className="spv-accent" aria-hidden="true"></div>

                    {/* ===== Cabeçalho do documento ===== */}
                    <header className="spv-header">
                        {data.empresa_logo ? (
                            <img src={data.empresa_logo} alt={data.empresa_nome} className="spv-logo" />
                        ) : (
                            <div className="spv-logo spv-logo-fallback">{data.empresa_nome?.charAt(0) || 'P'}</div>
                        )}
                        <p className="spv-issuer">{data.empresa_nome}</p>

                        <h1 className="spv-title">Registro de Aplicação<br />de Película</h1>

                        <div className="spv-verified">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="13" height="13" aria-hidden="true">
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Aplicação verificada e rastreável</span>
                        </div>
                    </header>

                    {/* ===== Identificação do local ===== */}
                    <section className="spv-section">
                        <h2 className="spv-kicker">Identificação do local</h2>
                        <dl className="spv-rows">
                            <div className="spv-row">
                                <dt>Local</dt>
                                <dd>{data.cliente_nome}</dd>
                            </div>
                            {enderecoLocal && (
                                <div className="spv-row">
                                    <dt>Endereço</dt>
                                    <dd>{enderecoLocal}</dd>
                                </div>
                            )}
                            <div className="spv-row">
                                <dt>Tipo</dt>
                                <dd>{getTipoLocalLabel(data.tipo_local)}</dd>
                            </div>
                            <div className="spv-row">
                                <dt>Data da aplicação</dt>
                                <dd>{formatDate(data.data_servico)}</dd>
                            </div>
                            {typeof data.metros_aplicados === 'number' && (
                                <div className="spv-row">
                                    <dt>Área aplicada</dt>
                                    <dd>{data.metros_aplicados.toFixed(2).replace('.', ',')} m²</dd>
                                </div>
                            )}
                        </dl>
                    </section>

                    {/* ===== Película aplicada ===== */}
                    <section className="spv-section">
                        <div className="spv-film">
                            <p className="spv-film-kicker">Película aplicada</p>
                            <h3 className="spv-film-name">{data.filme_aplicado?.trim()}</h3>
                            <p className="spv-film-sub">Película profissional de controle solar</p>
                            <span className="spv-film-chip">Padrão definido para este local</span>
                        </div>
                    </section>

                    {/* ===== Especificações técnicas ===== */}
                    {(especificacoes.length > 0 || data.filme_detalhes?.garantiaFabricante) && (
                        <section className="spv-section">
                            <h2 className="spv-kicker">Especificações técnicas</h2>

                            <div className="spv-specs">
                                {especificacoes.map(spec => (
                                    <div className="spv-spec" key={spec.label}>
                                        <div className="spv-spec-line">
                                            <span className="spv-spec-label">{spec.label}</span>
                                            <span className="spv-spec-value">{spec.value}%</span>
                                        </div>
                                        <div className="spv-spec-track" aria-hidden="true">
                                            <div className="spv-spec-fill" style={{ width: `${Math.min(spec.value, 100)}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {data.filme_detalhes?.garantiaFabricante && (
                                <div className="spv-warranty">
                                    <span className="spv-warranty-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
                                            <path d="M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z" strokeLinejoin="round" />
                                            <path d="M9.5 12l1.8 1.8 3.2-3.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    <span className="spv-warranty-label">Garantia de fábrica</span>
                                    <span className="spv-warranty-value">{data.filme_detalhes.garantiaFabricante} anos</span>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ===== Nota de padronização ===== */}
                    <section className="spv-section">
                        <div className="spv-note">
                            <h2 className="spv-note-title">Nota de padronização visual</h2>
                            <p>
                                Para preservar a uniformidade estética da fachada e evitar variações de
                                tonalidade entre os vidros, novas aplicações neste local devem utilizar a
                                película <strong>{data.filme_aplicado?.trim()}</strong>, conforme especificada
                                neste registro.
                            </p>
                        </div>
                    </section>

                    {/* ===== Contato ===== */}
                    <section className="spv-section">
                        <h2 className="spv-kicker">Manutenção e novas aplicações</h2>
                        <p className="spv-contact-text">
                            Atendimento técnico realizado por <strong>{data.empresa_nome}</strong>.
                            Solicite um orçamento para manter o padrão ou ampliar a aplicação.
                        </p>

                        {data.empresa_telefone && (
                            <button className="spv-btn-primary" onClick={handleWhatsApp}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                <span>Solicitar orçamento no WhatsApp</span>
                            </button>
                        )}

                        <div className="spv-btn-row">
                            {data.empresa_telefone && (
                                <button className="spv-btn-secondary" onClick={handleCall}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                                    <span>Ligar</span>
                                </button>
                            )}
                            {data.empresa_email && (
                                <button className="spv-btn-secondary" onClick={handleEmail}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
                                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                    </svg>
                                    <span>E-mail</span>
                                </button>
                            )}
                        </div>
                    </section>

                    {/* ===== Rodapé do documento ===== */}
                    <footer className="spv-footer">
                        <p className="spv-footer-company">{data.empresa_nome}</p>
                        {data.empresa_endereco && <p className="spv-footer-line">{data.empresa_endereco}</p>}
                        {data.empresa_site && (
                            <a
                                href={data.empresa_site.startsWith('http') ? data.empresa_site : `https://${data.empresa_site}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="spv-footer-site"
                            >
                                {data.empresa_site.replace(/^https?:\/\//, '')}
                            </a>
                        )}

                        <div className="spv-trace">
                            <span className="spv-trace-label">Documento eletrônico de rastreabilidade</span>
                            <code className="spv-trace-code">{qrCode}</code>
                        </div>
                    </footer>
                </main>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');

                /* ========== BASE ========== */
                .spv-page {
                    --ink: #131c2b;
                    --body: #3d4a5c;
                    --muted: #69788c;
                    --soft: #93a1b3;
                    --line: #e6e9ef;
                    --paper: #f3f4f7;
                    --card: #ffffff;
                    --ok: #0d8a5f;
                    --ok-soft: #e7f6ef;

                    min-height: 100vh;
                    background: var(--paper);
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: var(--body);
                    -webkit-font-smoothing: antialiased;
                    padding: 1.25rem 1rem 2.5rem;
                }

                /* ========== LOADING / ERROR ========== */
                .spv-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 80vh;
                    text-align: center;
                    gap: 0.85rem;
                    color: var(--muted);
                    font-size: 0.9rem;
                }

                .spv-spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid var(--line);
                    border-top-color: var(--brand);
                    border-radius: 50%;
                    animation: spv-spin 0.9s linear infinite;
                }

                @keyframes spv-spin {
                    to { transform: rotate(360deg); }
                }

                .spv-state-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: var(--card);
                    border: 1px solid var(--line);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--soft);
                }

                .spv-state h2 {
                    margin: 0;
                    font-family: 'Fraunces', Georgia, serif;
                    font-weight: 600;
                    font-size: 1.3rem;
                    color: var(--ink);
                }

                .spv-state p { margin: 0; max-width: 300px; }

                .spv-state-code {
                    padding: 0.4rem 0.85rem;
                    background: var(--card);
                    border: 1px solid var(--line);
                    border-radius: 8px;
                    font-size: 0.78rem;
                    color: var(--soft);
                }

                /* ========== DOCUMENTO ========== */
                .spv-document {
                    max-width: 520px;
                    margin: 0 auto;
                    background: var(--card);
                    border: 1px solid var(--line);
                    border-radius: 18px;
                    overflow: hidden;
                    box-shadow:
                        0 1px 2px rgba(19, 28, 43, 0.04),
                        0 12px 40px -16px rgba(19, 28, 43, 0.12);
                    animation: spv-rise 0.5s ease-out both;
                }

                @keyframes spv-rise {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .spv-accent {
                    height: 4px;
                    background: var(--brand);
                }

                /* ========== CABEÇALHO ========== */
                .spv-header {
                    text-align: center;
                    padding: 2.25rem 1.5rem 1.9rem;
                    border-bottom: 1px solid var(--line);
                }

                .spv-logo {
                    width: 58px;
                    height: 58px;
                    object-fit: contain;
                    border-radius: 14px;
                    border: 1px solid var(--line);
                    background: #fff;
                    padding: 4px;
                    margin: 0 auto;
                    display: block;
                }

                .spv-logo-fallback {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Fraunces', Georgia, serif;
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--brand);
                    background: var(--brand-soft);
                    border-color: var(--brand-border);
                    padding: 0;
                }

                .spv-issuer {
                    margin: 0.9rem 0 0;
                    font-size: 0.78rem;
                    font-weight: 600;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: var(--muted);
                }

                .spv-title {
                    margin: 0.55rem 0 0;
                    font-family: 'Fraunces', Georgia, serif;
                    font-weight: 600;
                    font-size: 1.7rem;
                    line-height: 1.18;
                    color: var(--ink);
                    letter-spacing: -0.01em;
                }

                .spv-verified {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    margin-top: 1.05rem;
                    padding: 0.38rem 0.85rem;
                    border-radius: 999px;
                    background: var(--ok-soft);
                    border: 1px solid #cdebdc;
                    color: var(--ok);
                    font-size: 0.76rem;
                    font-weight: 600;
                }

                /* ========== SEÇÕES ========== */
                .spv-section {
                    padding: 1.5rem 1.5rem 0;
                }

                .spv-section:last-of-type {
                    padding-bottom: 1.6rem;
                }

                .spv-kicker {
                    margin: 0 0 0.6rem;
                    font-size: 0.69rem;
                    font-weight: 700;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: var(--soft);
                }

                /* Linhas de identificação */
                .spv-rows {
                    margin: 0;
                    border-top: 1px solid var(--line);
                }

                .spv-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 1.25rem;
                    padding: 0.72rem 0;
                    border-bottom: 1px solid var(--line);
                }

                .spv-row dt {
                    font-size: 0.82rem;
                    color: var(--muted);
                    white-space: nowrap;
                }

                .spv-row dd {
                    margin: 0;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--ink);
                    text-align: right;
                }

                /* ========== PELÍCULA ========== */
                .spv-film {
                    text-align: center;
                    border: 1px solid var(--brand-border);
                    border-radius: 14px;
                    padding: 1.6rem 1.25rem 1.5rem;
                    background:
                        linear-gradient(180deg, var(--brand-soft), rgba(255, 255, 255, 0) 70%);
                }

                .spv-film-kicker {
                    margin: 0;
                    font-size: 0.69rem;
                    font-weight: 700;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: var(--muted);
                }

                .spv-film-name {
                    margin: 0.5rem 0 0;
                    font-family: 'Fraunces', Georgia, serif;
                    font-weight: 600;
                    font-size: 2rem;
                    line-height: 1.1;
                    color: var(--ink);
                    overflow-wrap: break-word;
                }

                .spv-film-sub {
                    margin: 0.45rem 0 0;
                    font-size: 0.82rem;
                    color: var(--muted);
                }

                .spv-film-chip {
                    display: inline-block;
                    margin-top: 1rem;
                    padding: 0.38rem 0.9rem;
                    border-radius: 999px;
                    background: var(--card);
                    border: 1px solid var(--line);
                    font-size: 0.74rem;
                    font-weight: 600;
                    color: var(--body);
                    box-shadow: 0 1px 2px rgba(19, 28, 43, 0.05);
                }

                /* ========== ESPECIFICAÇÕES ========== */
                .spv-specs {
                    display: flex;
                    flex-direction: column;
                    gap: 1.05rem;
                    padding-top: 0.2rem;
                }

                .spv-spec-line {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 0.45rem;
                }

                .spv-spec-label {
                    font-size: 0.84rem;
                    color: var(--body);
                }

                .spv-spec-value {
                    font-size: 0.92rem;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    color: var(--ink);
                }

                .spv-spec-track {
                    height: 4px;
                    border-radius: 2px;
                    background: #edf0f4;
                    overflow: hidden;
                }

                .spv-spec-fill {
                    height: 100%;
                    border-radius: 2px;
                    background: var(--brand);
                    animation: spv-grow 0.9s ease-out both;
                    transform-origin: left;
                }

                @keyframes spv-grow {
                    from { transform: scaleX(0); }
                    to { transform: scaleX(1); }
                }

                .spv-warranty {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    margin-top: 1.15rem;
                    padding: 0.8rem 1rem;
                    border: 1px solid #cdebdc;
                    border-radius: 12px;
                    background: var(--ok-soft);
                }

                .spv-warranty-icon {
                    display: flex;
                    color: var(--ok);
                }

                .spv-warranty-label {
                    flex: 1;
                    font-size: 0.84rem;
                    color: #14543c;
                }

                .spv-warranty-value {
                    font-size: 0.92rem;
                    font-weight: 700;
                    color: var(--ok);
                }

                /* ========== NOTA DE PADRONIZAÇÃO ========== */
                .spv-note {
                    border: 1px solid var(--line);
                    border-left: 3px solid var(--brand);
                    border-radius: 10px;
                    padding: 1.05rem 1.2rem;
                    background: #fafbfc;
                }

                .spv-note-title {
                    margin: 0 0 0.4rem;
                    font-size: 0.84rem;
                    font-weight: 700;
                    color: var(--ink);
                }

                .spv-note p {
                    margin: 0;
                    font-size: 0.84rem;
                    line-height: 1.65;
                    color: var(--body);
                }

                .spv-note strong {
                    color: var(--ink);
                }

                /* ========== CONTATO ========== */
                .spv-contact-text {
                    margin: 0 0 1rem;
                    font-size: 0.86rem;
                    line-height: 1.6;
                    color: var(--body);
                }

                .spv-contact-text strong {
                    color: var(--ink);
                }

                .spv-btn-primary {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.55rem;
                    padding: 0.95rem 1rem;
                    border: none;
                    border-radius: 12px;
                    background: var(--ink);
                    color: #fff;
                    font-family: inherit;
                    font-size: 0.92rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.15s;
                }

                .spv-btn-primary:active {
                    transform: scale(0.985);
                    opacity: 0.92;
                }

                .spv-btn-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.6rem;
                    margin-top: 0.6rem;
                }

                .spv-btn-row:has(.spv-btn-secondary:only-child) {
                    grid-template-columns: 1fr;
                }

                .spv-btn-secondary {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.45rem;
                    padding: 0.8rem 1rem;
                    border: 1px solid var(--line);
                    border-radius: 12px;
                    background: var(--card);
                    color: var(--body);
                    font-family: inherit;
                    font-size: 0.86rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s, transform 0.15s;
                }

                .spv-btn-secondary:active {
                    transform: scale(0.985);
                    background: #f6f7f9;
                }

                /* ========== RODAPÉ ========== */
                .spv-footer {
                    margin-top: 1.6rem;
                    padding: 1.4rem 1.5rem 1.6rem;
                    border-top: 1px solid var(--line);
                    background: #fafbfc;
                    text-align: center;
                }

                .spv-footer-company {
                    margin: 0;
                    font-size: 0.86rem;
                    font-weight: 700;
                    color: var(--ink);
                }

                .spv-footer-line {
                    margin: 0.25rem 0 0;
                    font-size: 0.78rem;
                    color: var(--muted);
                }

                .spv-footer-site {
                    display: inline-block;
                    margin-top: 0.3rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--brand);
                    text-decoration: none;
                }

                .spv-trace {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.3rem;
                    margin-top: 1.1rem;
                    padding-top: 1.1rem;
                    border-top: 1px dashed var(--line);
                }

                .spv-trace-label {
                    font-size: 0.68rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--soft);
                }

                .spv-trace-code {
                    font-family: 'SF Mono', Monaco, Consolas, monospace;
                    font-size: 0.78rem;
                    color: var(--muted);
                    padding: 0.3rem 0.7rem;
                    background: var(--card);
                    border: 1px solid var(--line);
                    border-radius: 7px;
                }

                @media (min-width: 480px) {
                    .spv-page { padding-top: 2.5rem; }
                    .spv-title { font-size: 1.85rem; }
                }
            `}</style>
        </div>
    );
};

export default ServicoPublicoView;
