import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Copy,
    FileImage,
    Loader2,
    Plus,
    Printer,
    QrCode,
    RotateCcw,
    Search,
    X,
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
import { MobileActionsDrawer } from '../MobileActionsDrawer';
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

const buildHistoryChips = (servico: ServicoPrestado): string[] => {
    const chips = [formatDateLabel(servico.data_servico)];

    const local = [servico.cidade, servico.uf?.toUpperCase()].filter(Boolean).join(' · ');
    if (local) chips.push(local);

    if (typeof servico.metros_aplicados === 'number' && !Number.isNaN(servico.metros_aplicados)) {
        chips.push(formatAreaLabel(servico.metros_aplicados));
    }

    return chips;
};

const LABEL_FORMAT_ENTRIES = Object.entries(NIMBOT_LABEL_FORMATS) as [
    NimbotLabelFormat,
    typeof NIMBOT_LABEL_FORMATS[NimbotLabelFormat]
][];

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        const sync = () => setIsMobile(mediaQuery.matches);
        sync();
        mediaQuery.addEventListener('change', sync);
        return () => mediaQuery.removeEventListener('change', sync);
    }, []);

    return isMobile;
};

const FooterActionButton: React.FC<{
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    disabled?: boolean;
}> = ({ onClick, label, icon, disabled = false }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="group flex h-14 w-16 flex-col items-center justify-center rounded-xl text-slate-500 transition-all duration-300 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
        <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

const ServicoSearchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    servicos: ServicoPrestado[];
    onSelect: (servico: ServicoPrestado) => void;
}> = ({ isOpen, onClose, servicos, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) setSearchTerm('');
    }, [isOpen]);

    if (!isOpen) return null;

    const term = searchTerm.trim().toLowerCase();
    const filtered = term
        ? servicos.filter(servico =>
            [servico.cliente_nome, servico.filme_aplicado, servico.cidade, servico.uf, servico.codigo_qr]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term))
        : servicos;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/94 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md animate-fade-in dark:bg-slate-900/95">
            <div className="sticky top-0 z-10 flex-shrink-0 border-b border-slate-200/80 bg-white/94 p-3.5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/94">
                <div className="mx-auto max-w-3xl">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Voltar"
                            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Histórico
                            </p>
                            <h2 className="truncate text-[1.15rem] font-semibold tracking-[-0.03em] text-slate-800 dark:text-slate-100">
                                Buscar etiqueta
                            </h2>
                        </div>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {filtered.length}
                        </span>
                    </div>

                    <div className="relative mt-3">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Buscar por local, película ou cidade..."
                            className="h-11 w-full rounded-[16px] border border-slate-200 bg-slate-50/90 pl-10 pr-10 text-[14px] text-slate-800 shadow-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-800"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); inputRef.current?.focus(); }}
                                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                                aria-label="Limpar busca"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl space-y-2.5">
                    {filtered.map(servico => (
                        <button
                            key={servico.codigo_qr}
                            type="button"
                            onClick={() => onSelect(servico)}
                            className="group w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:border-slate-300 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                        >
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400">
                                    <QrCode className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                                        {servico.cliente_nome}
                                    </p>
                                    <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                                        {servico.filme_aplicado}
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                            </div>
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {buildHistoryChips(servico).map(chip => (
                                    <span
                                        key={chip}
                                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                    >
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        </button>
                    ))}

                    {filtered.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-14 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                                <Search className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
                                {term ? 'Nenhuma etiqueta encontrada' : 'Nenhuma etiqueta gerada ainda'}
                            </p>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400">
                                {term ? 'Tente outro local, película ou cidade.' : 'Quando você salvar a primeira, ela aparece aqui.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SECTION_CARD_CLASSNAME = 'rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)] sm:p-5';
const FIELD_CLASSNAME = 'ui-field w-full px-3.5 py-3 text-[14px] outline-none';
const FIELD_GROUP_CLASSNAME = 'text-sm font-medium text-[var(--text-strong)]';
const FIELD_LABEL_CLASSNAME = 'mb-1.5 block text-xs font-medium text-[var(--text-muted)]';

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
    const [allServicos, setAllServicos] = useState<ServicoPrestado[]>([]);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [labelFormat, setLabelFormat] = useState<NimbotLabelFormat>('40x60');
    const isMobile = useIsMobile();

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
    const formSectionRef = useRef<HTMLElement>(null);
    const previewSectionRef = useRef<HTMLElement>(null);

    const scrollToSection = useCallback((ref: React.RefObject<HTMLElement>) => {
        if (typeof window === 'undefined') return;
        if (window.matchMedia('(min-width: 1280px)').matches) return;
        window.setTimeout(() => {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
    }, []);

    const qrUrl = useMemo(
        () => (savedServico ? gerarUrlServico(savedServico.codigo_qr) : ''),
        [savedServico]
    );
    const formatConfig = NIMBOT_LABEL_FORMATS[labelFormat];
    const activeStepMeta = STEP_META[step];
    const companyDisplayName = userInfo?.empresa || userInfo?.nome || 'Empresa não configurada';
    const selectedFilmLabel = filmeAplicado || 'Sem película';
    const previewStatusLabel = savedServico ? 'Pronta para imprimir' : 'Prévia';
    // Enquanto não gera, a etiqueta da direita mostra o que está sendo preenchido.
    const draftServico = useMemo(() => ({
        codigo_qr: '',
        cliente_nome: clienteNome,
        cidade,
        uf: uf.toUpperCase(),
        tipo_local: tipoLocal,
        filme_aplicado: filmeAplicado,
        data_servico: dataServico ? new Date(`${dataServico}T12:00:00`).toISOString() : undefined
    }) as ServicoPrestado, [cidade, clienteNome, dataServico, filmeAplicado, tipoLocal, uf]);

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
            setAllServicos(servicos);
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
        if (!successMessage) return;
        const timer = window.setTimeout(() => setSuccessMessage(null), 4000);
        return () => window.clearTimeout(timer);
    }, [successMessage]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!window.matchMedia('(min-width: 768px)').matches) return;
        inputRef.current?.focus();
    }, []);

    const handleOpenClientModal = useCallback(() => {
        if (isMobile) setIsFormDrawerOpen(false);
        setIsClientModalOpen(true);
    }, [isMobile]);

    const handleClientModalClose = useCallback(() => {
        setIsClientModalOpen(false);
        if (isMobile) setIsFormDrawerOpen(true);
    }, [isMobile]);

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
        if (isMobile) setIsFormDrawerOpen(true);
    }, [clients, isMobile]);

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
                data_servico: new Date(`${dataServico}T12:00:00`).toISOString(),
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
            setIsFormDrawerOpen(false);
            scrollToSection(previewSectionRef);
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
        scrollToSection,
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
        scrollToSection(previewSectionRef);
    }, [formatConfig.label, scrollToSection]);

    const buscarClienteButton = (
        <button
            type="button"
            onClick={handleOpenClientModal}
            className="-mr-2 inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)]"
        >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium">Buscar nos clientes</span>
        </button>
    );

    // Dois grupos, na ordem em que a informação chega: quem é o cliente, depois o que foi aplicado.
    const etiquetaForm = (
        <form id="servicoForm" onSubmit={handleSubmit}>
            <fieldset disabled={isSubmitting} className="space-y-6">
                <div className="space-y-3">
                    <p className={FIELD_GROUP_CLASSNAME}>Cliente</p>
                    <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                            <label htmlFor="servico-cliente" className="block text-xs font-medium text-[var(--text-muted)]">
                                Nome do local ou cliente <span className="text-[var(--text-soft)]">*</span>
                            </label>
                            {buscarClienteButton}
                        </div>
                        <input
                            id="servico-cliente"
                            ref={inputRef}
                            type="text"
                            value={clienteNome}
                            onChange={(event) => setClienteNome(event.target.value)}
                            placeholder="Ex.: Condomínio Solar"
                            autoComplete="off"
                            className={FIELD_CLASSNAME}
                        />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <div>
                            <label htmlFor="servico-tipo" className={FIELD_LABEL_CLASSNAME}>Tipo de local</label>
                            <select
                                id="servico-tipo"
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
                        <div>
                            <label htmlFor="servico-endereco" className={FIELD_LABEL_CLASSNAME}>Endereço</label>
                            <input
                                id="servico-endereco"
                                type="text"
                                value={endereco}
                                onChange={(event) => setEndereco(event.target.value)}
                                placeholder="Rua e número"
                                className={FIELD_CLASSNAME}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                        <div>
                            <label htmlFor="servico-cidade" className={FIELD_LABEL_CLASSNAME}>Cidade</label>
                            <input
                                id="servico-cidade"
                                type="text"
                                value={cidade}
                                onChange={(event) => setCidade(event.target.value)}
                                placeholder="Cidade"
                                className={FIELD_CLASSNAME}
                            />
                        </div>
                        <div>
                            <label htmlFor="servico-uf" className={FIELD_LABEL_CLASSNAME}>UF</label>
                            <input
                                id="servico-uf"
                                type="text"
                                value={uf}
                                onChange={(event) => setUf(event.target.value.toUpperCase())}
                                maxLength={2}
                                placeholder="UF"
                                className={`${FIELD_CLASSNAME} text-center uppercase`}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
                    <p className={FIELD_GROUP_CLASSNAME}>Serviço</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label htmlFor="servico-filme" className={FIELD_LABEL_CLASSNAME}>
                                Película aplicada <span className="text-[var(--text-soft)]">*</span>
                            </label>
                            <select
                                id="servico-filme"
                                value={filmeAplicado}
                                onChange={(event) => setFilmeAplicado(event.target.value)}
                                className={FIELD_CLASSNAME}
                            >
                                <option value="">Selecione</option>
                                {films.map((film) => (
                                    <option key={film.nome} value={film.nome}>
                                        {film.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="servico-area" className={FIELD_LABEL_CLASSNAME}>Área aplicada</label>
                            <div className="relative">
                                <input
                                    id="servico-area"
                                    type="text"
                                    inputMode="decimal"
                                    value={metrosAplicados}
                                    onChange={(event) => setMetrosAplicados(event.target.value.replace(/[^\d.,]/g, ''))}
                                    placeholder="0,00"
                                    className={`${FIELD_CLASSNAME} pr-11 tabular-nums`}
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-[var(--text-muted)]">m²</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="servico-data" className={FIELD_LABEL_CLASSNAME}>Data</label>
                            <input
                                id="servico-data"
                                type="date"
                                value={dataServico}
                                onChange={(event) => setDataServico(event.target.value)}
                                className={`${FIELD_CLASSNAME} px-3`}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                            <label htmlFor="servico-obs" className="block text-xs font-medium text-[var(--text-muted)]">Observações</label>
                            <span className="text-xs text-[var(--text-soft)]">Só para você, não saem na etiqueta</span>
                        </div>
                        <textarea
                            id="servico-obs"
                            value={observacoes}
                            onChange={(event) => setObservacoes(event.target.value)}
                            rows={3}
                            placeholder="Ex.: garantia de 5 anos, retorno em 30 dias"
                            className={`${FIELD_CLASSNAME} resize-none`}
                        />
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="hidden text-xs text-[var(--text-soft)] sm:inline">* obrigatório</span>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <ActionButton type="button" variant="ghost" size="md" onClick={resetForm} icon={<RotateCcw className="h-4 w-4" />}>
                            Limpar
                        </ActionButton>
                        <ActionButton type="submit" form="servicoForm" size="md" loading={isSubmitting} loadingText="Gerando etiqueta..." icon={<QrCode className="h-4 w-4" />}>
                            Gerar etiqueta
                        </ActionButton>
                    </div>
                </div>
            </fieldset>
        </form>
    );

    const historySection = (
    <section className={`${SECTION_CARD_CLASSNAME} scroll-mt-24 overflow-hidden`}>
        <h3 className="text-base font-semibold text-[var(--text-strong)]">
            Etiquetas recentes <span className="font-normal tabular-nums text-[var(--text-muted)]">{recentServicos.length}</span>
        </h3>

        {isHistoryLoading ? (
            <div className="mt-3 space-y-2">
                {[1, 2, 3].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-muted)]" />
                ))}
            </div>
        ) : recentServicos.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
                Nenhuma etiqueta gerada ainda. A primeira aparece aqui
            </p>
        ) : (
            <>
                <div className="-mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:hidden">
                    {recentServicos.map((servico) => (
                        <button
                            key={servico.codigo_qr}
                            type="button"
                            onClick={() => handleLoadRecentServico(servico)}
                            className="w-[80%] min-w-[80%] snap-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-3 text-left transition-colors active:bg-[var(--surface-muted)]"
                        >
                            <span className="block truncate text-sm font-medium text-[var(--text-strong)]">{servico.cliente_nome}</span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{servico.filme_aplicado}</span>
                            <span className="mt-1 block truncate text-xs tabular-nums text-[var(--text-muted)]">{buildHistoryChips(servico).join(' · ')}</span>
                        </button>
                    ))}
                </div>

                <ul className="-mx-5 -mb-5 mt-3 hidden divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] sm:block">
                    {recentServicos.map((servico) => (
                        <li key={servico.codigo_qr}>
                            <button
                                type="button"
                                onClick={() => handleLoadRecentServico(servico)}
                                aria-current={savedServico?.codigo_qr === servico.codigo_qr ? 'true' : undefined}
                                className={`group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] ${savedServico?.codigo_qr === servico.codigo_qr ? 'bg-[var(--surface-muted)] shadow-[inset_2px_0_0_var(--brand-primary)]' : ''}`}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-[var(--text-strong)]">{servico.cliente_nome}</span>
                                    <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--text-muted)]">
                                        {[servico.filme_aplicado, ...buildHistoryChips(servico)].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-strong)]" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            </>
        )}
    </section>
    );

    return (
        <div className="max-w-full space-y-4 overflow-x-clip bg-[var(--app-bg)] pb-28 sm:-m-6 sm:p-6">
            {successMessage && (
                <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{successMessage}</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                    <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-[var(--text-strong)] sm:text-2xl">Etiquetas de serviço</h2>
                    <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
                        Etiqueta térmica com QR Code para atendimento, garantia e consulta do cliente
                    </p>
                </div>
                <p className="truncate text-xs tabular-nums text-[var(--text-muted)]">
                    {companyDisplayName} · {recentServicos.length} {recentServicos.length === 1 ? 'etiqueta recente' : 'etiquetas recentes'}
                </p>
            </header>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] xl:items-start">
                {!isMobile && (
                    <div className="min-w-0 space-y-4">
                        <section ref={formSectionRef} className={`${SECTION_CARD_CLASSNAME} scroll-mt-24`}>
                            <div className="mb-5">
                                <h3 className="text-base font-semibold text-[var(--text-strong)]">
                                    Nova etiqueta
                                </h3>
                            </div>
                            {etiquetaForm}
                        </section>
                        {historySection}
                    </div>
                )}

                <div className="space-y-4 xl:sticky xl:top-24">
                    <section ref={previewSectionRef} className={`${SECTION_CARD_CLASSNAME} scroll-mt-24`}>
                        <div className="fixed left-[-10000px] top-0 pointer-events-none opacity-0">
                            <ServicoQrThermalLabel ref={printRef} servico={savedServico} format={labelFormat} />
                        </div>

                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-[var(--text-strong)]">Etiqueta</h3>
                                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                    {savedServico ? `${savedServico.cliente_nome} · ${savedServico.filme_aplicado}` : 'Atualiza enquanto você preenche os dados'}
                                </p>
                            </div>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                <span className={`h-1.5 w-1.5 rounded-full ${savedServico ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                                {previewStatusLabel}
                            </span>
                        </div>

                        <div role="radiogroup" aria-label="Formato da etiqueta" className="mt-4 grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-1">
                            {LABEL_FORMAT_ENTRIES.map(([key, value]) => {
                                const isActive = labelFormat === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="radio"
                                        aria-checked={isActive}
                                        onClick={() => setLabelFormat(key)}
                                        className={`h-9 rounded-[calc(var(--radius-control)-2px)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] ${isActive
                                            ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-[var(--shadow-hairline)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                                    >
                                        <span className="text-xs font-medium tabular-nums">{value.label.replace(' x ', ' × ')}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                            {formatConfig.helper}{formatConfig.recommended ? ' · formato padrão' : ''}
                        </p>

                        {/* A etiqueta em papel, do jeito que sai na impressora térmica. */}
                        <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-6 sm:min-h-[300px]">
                            <div className="origin-center scale-[0.9] shadow-[0_8px_24px_rgba(15,23,42,0.18)] sm:scale-[1.08] lg:scale-[1.22]">
                                <ServicoQrThermalLabel servico={savedServico ?? draftServico} draft={!savedServico} format={labelFormat} />
                            </div>
                        </div>

                        {savedServico && (
                            <div className="mt-4 space-y-3">
                                {!isMobile && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <ActionButton size="md" className="w-full" onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
                                            Imprimir
                                        </ActionButton>
                                        <ActionButton variant="secondary" size="md" className="w-full" onClick={handleSaveImage} loading={isExportingImage} loadingText="Gerando PNG..." icon={<FileImage className="h-4 w-4" />}>
                                            Salvar PNG
                                        </ActionButton>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-[var(--text-muted)]">Link que o QR abre</p>
                                    <div className="mt-1 flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--surface-muted)] py-1 pl-3 pr-1">
                                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-body)]">{qrUrl}</code>
                                        <button
                                            type="button"
                                            onClick={handleCopyUrl}
                                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-strong)]"
                                        >
                                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                            <span className="text-xs font-medium">Copiar</span>
                                        </button>
                                    </div>
                                </div>
                                {!isMobile && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                    >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        <span className="text-sm font-medium">Nova etiqueta</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </section>

                    {isMobile && historySection}
                </div>
            </div>

            {isMobile && (
                <div className="fixed left-4 right-4 z-40" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                    <div className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                        <div className="relative flex items-center justify-between">
                            <div className="flex gap-1">
                                <FooterActionButton
                                    onClick={handlePrint}
                                    label="Imprimir"
                                    disabled={!savedServico}
                                    icon={<Printer className="h-5 w-5" aria-hidden="true" />}
                                />
                                <FooterActionButton
                                    onClick={handleSaveImage}
                                    label="PNG"
                                    disabled={!savedServico || isExportingImage}
                                    icon={isExportingImage
                                        ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                        : <FileImage className="h-5 w-5" aria-hidden="true" />}
                                />
                            </div>

                            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                                <button
                                    type="button"
                                    onClick={() => setIsFormDrawerOpen(true)}
                                    aria-label="Nova etiqueta"
                                    className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] active:scale-95 dark:border-slate-900 dark:from-slate-700 dark:to-slate-900"
                                >
                                    <Plus className="h-7 w-7" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="flex gap-1">
                                <FooterActionButton
                                    onClick={handleCopyUrl}
                                    label="Copiar"
                                    disabled={!qrUrl}
                                    icon={<Copy className="h-5 w-5" aria-hidden="true" />}
                                />
                                <FooterActionButton
                                    onClick={() => setIsHistoryModalOpen(true)}
                                    label="Recentes"
                                    icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isMobile && (
                <MobileActionsDrawer
                    open={isFormDrawerOpen}
                    onOpenChange={setIsFormDrawerOpen}
                    title="Dados da etiqueta"
                    description="A etiqueta é gerada com os dados abaixo"
                >
                    <div className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        )}
                        {etiquetaForm}
                    </div>
                </MobileActionsDrawer>
            )}

            <ServicoSearchModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                servicos={allServicos}
                onSelect={(servico) => {
                    setIsHistoryModalOpen(false);
                    handleLoadRecentServico(servico);
                }}
            />

            <ClientSelectionModal
                isOpen={isClientModalOpen}
                onClose={handleClientModalClose}
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
