import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Clipboard,
    Copy,
    FileImage,
    Link2,
    MapPin,
    Printer,
    QrCode,
    RotateCcw,
    Search,
    Tag,
    UserRound,
    XCircle
} from 'lucide-react';
import { Client, Film, UserInfo } from '../../types';
import {
    ServicoPrestado,
    criarDetalhesFilme,
    criarSnapshotEmpresa,
    gerarCodigoServico,
    gerarUrlServico,
    getAllServicosPrestados,
    saveServicoPrestado
} from '../../services/servicosService';
import ClientSelectionModal from '../modals/ClientSelectionModal';
import ActionButton from '../ui/ActionButton';
import ServicoQrThermalLabel, {
    NIMBOT_LABEL_FORMATS,
    NimbotLabelFormat
} from '../qr/ServicoQrThermalLabel';

interface ServicoQrViewProps {
    userInfo: UserInfo | null;
    films: Film[];
    clients: Client[];
    isClientsLoading?: boolean;
    onTogglePin?: (id: number) => void;
    onAddNewClient?: (clientName: string) => void;
}

type Step = 'form' | 'preview';
type TipoLocal = 'residencial' | 'comercial' | 'condominio' | 'empresa' | 'outros';

const STEP_META: Record<Step, { label: string; description: string }> = {
    form: {
        label: 'Registrar servico',
        description: 'Preencha os dados para gerar a etiqueta térmica.'
    },
    preview: {
        label: 'Etiqueta pronta',
        description: 'Revise o layout Nimbot antes de salvar ou imprimir.'
    }
};

const formatDateLabel = (value?: string) => {
    if (!value) return 'Data não informada';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data inválida';

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const formatAreaLabel = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    return `${value.toFixed(2).replace('.', ',')} m²`;
};

const LABEL_FORMAT_ENTRIES = Object.entries(NIMBOT_LABEL_FORMATS) as [
    NimbotLabelFormat,
    typeof NIMBOT_LABEL_FORMATS[NimbotLabelFormat]
][];

const SECTION_CARD_CLASSNAME = 'rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)] sm:p-5';
const FIELD_CLASSNAME = 'ui-field w-full px-3.5 py-3 text-[14px] outline-none';
const FIELD_LABEL_CLASSNAME = 'ui-label mb-1.5 block';
const HISTORY_CHIP_CLASSNAME = 'rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]';
const ICON_FRAME_CLASSNAME = 'ui-icon-frame h-10 w-10 shrink-0';

const MiniMetric: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
}> = ({ icon, label, value }) => (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 shadow-[var(--shadow-hairline)]">
        <div className="flex items-center gap-2 text-[var(--text-soft)]">
            {icon}
            <span className="truncate text-[10px] font-semibold uppercase">{label}</span>
        </div>
        <p className="mt-1 truncate text-[13px] font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
);

const ServicoQrView: React.FC<ServicoQrViewProps> = ({
    userInfo,
    films,
    clients,
    isClientsLoading = false,
    onTogglePin,
    onAddNewClient
}) => {
    const [step, setStep] = useState<Step>('form');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExportingImage, setIsExportingImage] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [savedServico, setSavedServico] = useState<ServicoPrestado | null>(null);
    const [recentServicos, setRecentServicos] = useState<ServicoPrestado[]>([]);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [labelFormat, setLabelFormat] = useState<NimbotLabelFormat>('40x60');

    const [clienteNome, setClienteNome] = useState('');
    const [endereco, setEndereco] = useState('');
    const [cidade, setCidade] = useState('');
    const [uf, setUf] = useState('');
    const [tipoLocal, setTipoLocal] = useState<TipoLocal>('residencial');
    const [filmeAplicado, setFilmeAplicado] = useState('');
    const [metrosAplicados, setMetrosAplicados] = useState('');
    const [dataServico, setDataServico] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const qrUrl = useMemo(
        () => (savedServico ? gerarUrlServico(savedServico.codigo_qr) : ''),
        [savedServico]
    );
    const formatConfig = NIMBOT_LABEL_FORMATS[labelFormat];
    const activeStepMeta = STEP_META[step];
    const companyDisplayName = userInfo?.empresa || userInfo?.nome || 'Empresa não configurada';
    const selectedFilmLabel = filmeAplicado || 'Sem película';
    const previewStatusLabel = savedServico ? 'Pronta' : 'Em preparo';

    const resetForm = useCallback(() => {
        setStep('form');
        setError(null);
        setSuccessMessage(null);
        setSavedServico(null);
        setClienteNome('');
        setEndereco('');
        setCidade('');
        setUf('');
        setTipoLocal('residencial');
        setFilmeAplicado(films[0]?.nome || '');
        setMetrosAplicados('');
        setDataServico(new Date().toISOString().split('T')[0]);
        setObservacoes('');
    }, [films]);

    const loadRecentServicos = useCallback(async () => {
        try {
            setIsHistoryLoading(true);
            const servicos = await getAllServicosPrestados();
            setRecentServicos(servicos.slice(0, 8));
        } catch (loadError) {
            console.error('Erro ao carregar serviços QR:', loadError);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        resetForm();
    }, [resetForm]);

    useEffect(() => {
        loadRecentServicos();
    }, [loadRecentServicos]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!window.matchMedia('(min-width: 768px)').matches) return;
        inputRef.current?.focus();
    }, []);

    const handleClientSelect = useCallback((clientId: number | null) => {
        if (clientId === null) return;

        const selectedClient = clients.find(client => client.id === clientId);
        if (!selectedClient) return;

        const enderecoCompleto = [
            selectedClient.logradouro,
            selectedClient.numero,
            selectedClient.complemento,
            selectedClient.bairro
        ].filter(Boolean).join(', ');

        setClienteNome(selectedClient.nome || '');
        setEndereco(enderecoCompleto || '');
        setCidade(selectedClient.cidade || '');
        setUf(selectedClient.uf || '');
        setIsClientModalOpen(false);
    }, [clients]);

    const handleSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();

        if (!clienteNome.trim()) {
            setError('Nome do cliente ou local é obrigatório.');
            return;
        }

        if (!filmeAplicado) {
            setError('Selecione a película aplicada.');
            return;
        }

        if (!userInfo) {
            setError('Configure os dados da empresa antes de gerar a etiqueta.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const codigoQr = gerarCodigoServico();
            const selectedFilm = films.find(film => film.nome === filmeAplicado);
            const empresaSnapshot = criarSnapshotEmpresa(userInfo);

            const servico: ServicoPrestado = {
                codigo_qr: codigoQr,
                cliente_nome: clienteNome.trim(),
                endereco: endereco.trim() || undefined,
                cidade: cidade.trim() || undefined,
                uf: uf.trim().toUpperCase() || undefined,
                tipo_local: tipoLocal,
                filme_aplicado: filmeAplicado,
                filme_detalhes: selectedFilm ? criarDetalhesFilme(selectedFilm) : undefined,
                metros_aplicados: metrosAplicados ? parseFloat(metrosAplicados.replace(',', '.')) : undefined,
                data_servico: new Date(dataServico).toISOString(),
                observacoes: observacoes.trim() || undefined,
                empresa_nome: empresaSnapshot.empresa_nome || userInfo.empresa || userInfo.nome,
                empresa_telefone: empresaSnapshot.empresa_telefone,
                empresa_email: empresaSnapshot.empresa_email,
                empresa_site: empresaSnapshot.empresa_site,
                empresa_endereco: empresaSnapshot.empresa_endereco,
                empresa_logo: empresaSnapshot.empresa_logo,
                empresa_cores: empresaSnapshot.empresa_cores
            };

            const saved = await saveServicoPrestado(servico);
            if (!saved) {
                setError('Não foi possível salvar o serviço. Tente novamente.');
                return;
            }

            setSavedServico(saved);
            setStep('preview');
            setSuccessMessage(`Etiqueta térmica pronta em ${formatConfig.label}.`);
            await loadRecentServicos();
        } catch (submitError: any) {
            console.error('Erro ao criar serviço QR:', submitError);
            setError(submitError?.message || 'Erro desconhecido ao gerar etiqueta.');
        } finally {
            setIsSubmitting(false);
        }
    }, [
        cidade,
        clienteNome,
        dataServico,
        endereco,
        filmeAplicado,
        films,
        formatConfig.label,
        loadRecentServicos,
        metrosAplicados,
        observacoes,
        tipoLocal,
        uf,
        userInfo
    ]);

    const handlePrint = useCallback(() => {
        if (!savedServico || !printRef.current) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            setError('Permita pop-ups no navegador para imprimir a etiqueta.');
            return;
        }

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Etiqueta QR - ${savedServico.cliente_nome}</title><style>@page{size:${formatConfig.widthMm}mm ${formatConfig.heightMm}mm;margin:0;}*{box-sizing:border-box;}html,body{margin:0;padding:0;width:${formatConfig.widthMm}mm;height:${formatConfig.heightMm}mm;overflow:hidden;}body{display:flex;align-items:center;justify-content:center;background:#ffffff;}body>div{margin:0!important;box-shadow:none!important;}svg{display:block;}</style></head><body>${printRef.current.outerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }, [formatConfig.heightMm, formatConfig.widthMm, savedServico]);

    const handleSaveImage = useCallback(async () => {
        if (!savedServico || !printRef.current) return;

        try {
            setIsExportingImage(true);
            setError(null);

            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(printRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 4,
                cacheBust: true,
                filter: node => node.tagName !== 'LINK'
            });

            const link = document.createElement('a');
            link.download = `etiqueta-nimbot-${labelFormat}-${savedServico.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (imageError) {
            console.error('Erro ao gerar imagem da etiqueta:', imageError);
            setError('Não foi possível salvar a imagem da etiqueta.');
        } finally {
            setIsExportingImage(false);
        }
    }, [labelFormat, savedServico]);

    const handleCopyUrl = useCallback(async () => {
        if (!qrUrl) return;

        try {
            await navigator.clipboard.writeText(qrUrl);
            setSuccessMessage('Link do serviço copiado.');
        } catch (copyError) {
            console.error('Erro ao copiar URL do serviço:', copyError);
            setError('Não foi possível copiar o link da etiqueta.');
        }
    }, [qrUrl]);

    const handleLoadRecentServico = useCallback((servico: ServicoPrestado) => {
        setSavedServico(servico);
        setStep('preview');
        setError(null);
        setSuccessMessage(`Histórico aberto no formato ${formatConfig.label}.`);
    }, [formatConfig.label]);

    return (
        <div className="max-w-full space-y-4 overflow-x-hidden bg-[var(--app-bg)] sm:-m-6 sm:p-6">
            {successMessage && (
                <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-[var(--success)] shadow-[var(--shadow-hairline)]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{successMessage}</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-[var(--danger)] shadow-[var(--shadow-hairline)]">
                    <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
                <div className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" aria-hidden="true" />
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="ui-kicker">QR Code</span>
                            <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
                            <span className="text-[11px] font-semibold text-[var(--text-muted)]">{activeStepMeta.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[1.4rem] font-semibold leading-tight tracking-normal text-[var(--text-strong)] sm:text-[2rem]">
                                Etiquetas de serviço
                            </h2>
                            <span className="inline-flex min-h-5 items-center rounded-full bg-[var(--brand-primary-soft)] px-2 text-[10px] font-semibold text-[var(--brand-primary)]">
                                {previewStatusLabel}
                            </span>
                        </div>
                        <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[var(--text-muted)]">
                            Gera etiquetas térmicas com QR rastreável para atendimento, garantia e consulta pública.
                        </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
                        <MiniMetric icon={<UserRound className="h-3.5 w-3.5" />} label="Empresa" value={companyDisplayName} />
                        <MiniMetric icon={<Tag className="h-3.5 w-3.5" />} label="Formato" value={formatConfig.label} />
                        <MiniMetric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Histórico" value={`${recentServicos.length} recentes`} />
                    </div>
                </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] xl:items-start">
                <section className={SECTION_CARD_CLASSNAME}>
                    <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className={ICON_FRAME_CLASSNAME}>
                                <Clipboard className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="ui-kicker">Atendimento</p>
                                <h3 className="text-[1.25rem] font-semibold leading-tight tracking-normal text-[var(--text-strong)] sm:text-[1.55rem]">
                                    Dados da etiqueta
                                </h3>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsClientModalOpen(true)}
                            className="group inline-flex h-10 w-full items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 text-left text-[13px] font-semibold text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-all duration-200 hover:bg-[var(--surface)] hover:text-[var(--text-strong)] sm:max-w-[220px]"
                        >
                            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">Buscar cliente</span>
                        </button>
                    </div>

                    <form id="servicoForm" onSubmit={handleSubmit} className="space-y-4">
                        <fieldset disabled={isSubmitting} className="space-y-4">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Nome do local / cliente *</label>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={clienteNome}
                                        onChange={(event) => setClienteNome(event.target.value)}
                                        placeholder="Ex: Condomínio Solar"
                                        className={FIELD_CLASSNAME}
                                    />
                                </div>
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Tipo de local</label>
                                    <select
                                        value={tipoLocal}
                                        onChange={(event) => setTipoLocal(event.target.value as TipoLocal)}
                                        className={FIELD_CLASSNAME}
                                    >
                                        <option value="residencial">Residência</option>
                                        <option value="comercial">Comercial</option>
                                        <option value="condominio">Condomínio</option>
                                        <option value="empresa">Empresa</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_168px]">
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Endereço</label>
                                    <input
                                        type="text"
                                        value={endereco}
                                        onChange={(event) => setEndereco(event.target.value)}
                                        placeholder="Rua, número"
                                        className={FIELD_CLASSNAME}
                                    />
                                </div>
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>UF</label>
                                    <input
                                        type="text"
                                        value={uf}
                                        onChange={(event) => setUf(event.target.value)}
                                        maxLength={2}
                                        placeholder="SP"
                                        className={`${FIELD_CLASSNAME} text-center uppercase`}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_160px]">
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Cidade</label>
                                    <input
                                        type="text"
                                        value={cidade}
                                        onChange={(event) => setCidade(event.target.value)}
                                        placeholder="Cidade"
                                        className={FIELD_CLASSNAME}
                                    />
                                </div>
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Data</label>
                                    <input
                                        type="date"
                                        value={dataServico}
                                        onChange={(event) => setDataServico(event.target.value)}
                                        className={`${FIELD_CLASSNAME} px-3`}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Película aplicada *</label>
                                    <select
                                        value={filmeAplicado}
                                        onChange={(event) => setFilmeAplicado(event.target.value)}
                                        className={FIELD_CLASSNAME}
                                    >
                                        <option value="">Selecione...</option>
                                        {films.map((film) => (
                                            <option key={film.nome} value={film.nome}>
                                                {film.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={FIELD_LABEL_CLASSNAME}>Área aplicada (m²)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={metrosAplicados}
                                        onChange={(event) => setMetrosAplicados(event.target.value)}
                                        placeholder="12,50"
                                        className={FIELD_CLASSNAME}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={FIELD_LABEL_CLASSNAME}>Observações</label>
                                <textarea
                                    value={observacoes}
                                    onChange={(event) => setObservacoes(event.target.value)}
                                    rows={4}
                                    placeholder="Observações internas do atendimento..."
                                    className={`${FIELD_CLASSNAME} resize-none`}
                                />
                            </div>

                            <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 py-3 text-[12px] leading-5 text-[var(--text-muted)]">
                                <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                                <span>O QR abre a página pública e a impressão segue o formato térmico escolhido.</span>
                            </div>

                            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:justify-end">
                                <ActionButton type="button" variant="secondary" size="md" onClick={resetForm} icon={<RotateCcw className="h-4 w-4" />}>
                                    Limpar
                                </ActionButton>
                                <ActionButton type="submit" form="servicoForm" size="md" loading={isSubmitting} loadingText="Gerando etiqueta..." icon={<CheckCircle2 className="h-4 w-4" />}>
                                    Gerar etiqueta
                                </ActionButton>
                            </div>
                        </fieldset>
                    </form>
                </section>

                <div className="space-y-4 xl:sticky xl:top-6">
                    <section className={SECTION_CARD_CLASSNAME}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={ICON_FRAME_CLASSNAME}>
                                    <QrCode className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <p className="ui-kicker">Preview Nimbot</p>
                                    <h3 className="text-[1.2rem] font-semibold leading-tight tracking-normal text-[var(--text-strong)] sm:text-[1.45rem]">
                                        Etiqueta para revisar
                                    </h3>
                                    <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                                        {savedServico ? savedServico.cliente_nome : activeStepMeta.description}
                                    </p>
                                </div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                savedServico
                                    ? 'border-emerald-200 bg-emerald-50 text-[var(--success)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]'
                            }`}>
                                {previewStatusLabel}
                            </span>
                        </div>

                        <div className="mt-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase text-[var(--text-soft)]">Formato da etiqueta</p>
                                    <p className="mt-1 truncate text-[13px] font-semibold text-[var(--text-strong)]">{formatConfig.label}</p>
                                </div>
                                <span className="hidden text-[11px] font-medium text-[var(--text-muted)] sm:inline">
                                    PNG e impressão sincronizados
                                </span>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {LABEL_FORMAT_ENTRIES.map(([key, value]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setLabelFormat(key)}
                                        className={`w-full min-w-0 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-all duration-200 ${
                                            labelFormat === key
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[var(--shadow-hairline)]'
                                                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-[var(--surface)]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-[12px] font-semibold">{value.label}</span>
                                            {value.recommended && (
                                                <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--brand-primary)]">
                                                    Padrão
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 overflow-hidden text-[10px] leading-4 text-[var(--text-muted)]">{value.helper}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className={SECTION_CARD_CLASSNAME}>
                        <div className="fixed left-[-10000px] top-0 pointer-events-none opacity-0">
                            <ServicoQrThermalLabel ref={printRef} servico={savedServico} format={labelFormat} />
                        </div>

                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                            <div className="min-w-0">
                                <p className="ui-kicker">Etiqueta</p>
                                <p className="mt-1 truncate text-[13px] font-semibold text-[var(--text-strong)]">{selectedFilmLabel}</p>
                            </div>
                            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                                {formatConfig.label}
                            </span>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 sm:p-4">
                            <div className="flex min-h-[190px] items-center justify-center sm:min-h-[240px]">
                                <div className="origin-center scale-[0.9] sm:scale-[1.08] lg:scale-[1.22]">
                                    <ServicoQrThermalLabel servico={savedServico} format={labelFormat} />
                                </div>
                            </div>
                        </div>

                        {savedServico && (
                            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <Link2 className="h-4 w-4" aria-hidden="true" />
                                    <span className="text-[11px] font-semibold uppercase">Link do serviço</span>
                                </div>
                                <code className="mt-2 block truncate rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-[11px] text-[var(--text-body)]">
                                    {qrUrl}
                                </code>
                            </div>
                        )}
                    </section>

                    {savedServico && (
                        <section className={`${SECTION_CARD_CLASSNAME} grid grid-cols-1 gap-2.5 sm:grid-cols-2`}>
                            <ActionButton variant="secondary" size="md" className="w-full" onClick={() => setStep('form')} icon={<RotateCcw className="h-4 w-4" />}>
                                Voltar
                            </ActionButton>
                            <ActionButton variant="secondary" size="md" className="w-full" onClick={handleSaveImage} loading={isExportingImage} loadingText="Gerando PNG..." icon={<FileImage className="h-4 w-4" />}>
                                Salvar PNG
                            </ActionButton>
                            <ActionButton size="md" className="w-full" onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
                                Imprimir
                            </ActionButton>
                            <ActionButton variant="ghost" size="md" className="w-full" onClick={handleCopyUrl} disabled={!qrUrl} icon={<Copy className="h-4 w-4" />}>
                                Copiar URL
                            </ActionButton>
                        </section>
                    )}

                    <section className={SECTION_CARD_CLASSNAME}>
                        <div className="mb-4 flex items-end justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={ICON_FRAME_CLASSNAME}>
                                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <p className="ui-kicker">Histórico recente</p>
                                    <h3 className="mt-1 text-[1.1rem] font-semibold leading-tight tracking-normal text-[var(--text-strong)] sm:text-[1.35rem]">
                                        Etiquetas recentes
                                    </h3>
                                </div>
                            </div>
                            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                                {recentServicos.length}
                            </span>
                        </div>

                        {isHistoryLoading ? (
                            <div className="space-y-2.5">
                                {[1, 2, 3].map((item) => (
                                    <div key={item} className="h-[72px] animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-muted)]" />
                                ))}
                            </div>
                        ) : recentServicos.length === 0 ? (
                            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-[13px] leading-6 text-[var(--text-muted)]">
                                Nenhum serviço QR gerado ainda. Quando você salvar o primeiro, ele aparece aqui.
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                                {recentServicos.map((servico, index) => (
                                    <button
                                        key={servico.codigo_qr}
                                        type="button"
                                        onClick={() => handleLoadRecentServico(servico)}
                                        className={`group w-full px-3.5 py-3.5 text-left transition-all duration-200 hover:bg-[var(--surface)] sm:px-4 ${
                                            index > 0 ? 'border-t border-[var(--border-subtle)]' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] sm:flex">
                                                <QrCode className="h-4 w-4" aria-hidden="true" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="break-words text-[14px] font-semibold leading-[1.25] tracking-normal text-[var(--text-strong)] sm:truncate">
                                                            {servico.cliente_nome}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                                                            {servico.filme_aplicado}
                                                        </p>
                                                    </div>
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface)] text-[var(--text-muted)] transition-all duration-200 group-hover:bg-[var(--surface-inverse)] group-hover:text-[var(--surface)]">
                                                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <span className={HISTORY_CHIP_CLASSNAME}>
                                                        {formatDateLabel(servico.data_servico)}
                                                    </span>
                                                    <span className={HISTORY_CHIP_CLASSNAME}>
                                                        <MapPin className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                                                        {servico.cidade || 'Cidade não informada'}
                                                    </span>
                                                    <span className={HISTORY_CHIP_CLASSNAME}>
                                                        {servico.uf || 'UF não informada'}
                                                    </span>
                                                    <span className={HISTORY_CHIP_CLASSNAME}>
                                                        {formatAreaLabel(servico.metros_aplicados)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <ClientSelectionModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                clients={clients}
                onClientSelect={handleClientSelect}
                isLoading={isClientsLoading}
                onAddNewClient={onAddNewClient || (() => undefined)}
                onTogglePin={onTogglePin || (() => undefined)}
            />
        </div>
    );
};

export default ServicoQrView;
