import React, { useState, useEffect, useCallback } from 'react';
import { Bobina, Retalho, Film } from '../../types';
import { Skeleton } from '../ui/Skeleton';
import {
    getAllBobinas,
    saveBobina,
    deleteBobina,
    getAllRetalhos,
    saveRetalho,
    deleteRetalho,
    getEstoqueStats,
    generateQRCode,
    saveConsumo,
    EstoqueStats
} from '../../services/estoqueDb';
import { getAllCustomFilms, saveCustomFilm } from '../../services/db';
import QRCode from 'qrcode';
import QRScannerModal from '../modals/QRScannerModal';
import { StatusDrawer } from '../ui/StatusDrawer';
import { StatusFilterDropdown } from '../ui/StatusFilterDropdown';
import FilmSelectionModal from '../modals/FilmSelectionModal';
import FilmModal from '../modals/FilmModal';

// Ícones
const PackageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
    </svg>
);

const ScissorsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const QrCodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="5" height="5" x="3" y="3" rx="1" />
        <rect width="5" height="5" x="16" y="3" rx="1" />
        <rect width="5" height="5" x="3" y="16" rx="1" />
        <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
        <path d="M21 21v.01" />
        <path d="M12 7v3a2 2 0 0 1-2 2H7" />
        <path d="M3 12h.01" />
        <path d="M12 3h.01" />
        <path d="M12 16v.01" />
        <path d="M16 12h1" />
        <path d="M21 12v.01" />
        <path d="M12 21v-1" />
    </svg>
);

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const FilterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

interface EstoqueViewProps {
    films: Film[];
    initialAction?: { action: 'scan', code: string } | null;
}

const EstoqueView: React.FC<EstoqueViewProps> = ({ films: initialFilms, initialAction }) => {
    const [activeTab, setActiveTab] = useState<'bobinas' | 'retalhos'>('bobinas');
    const [bobinas, setBobinas] = useState<Bobina[]>([]);
    const [retalhos, setRetalhos] = useState<Retalho[]>([]);
    const [stats, setStats] = useState<EstoqueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [films, setFilms] = useState<Film[]>(initialFilms);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState<{ type: 'bobina' | 'retalho', item: Bobina | Retalho } | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [showFilmSelectionModal, setShowFilmSelectionModal] = useState(false);
    const [showFilmModal, setShowFilmModal] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [filmNameToAdd, setFilmNameToAdd] = useState<string>('');

    // Form states
    const [formFilmId, setFormFilmId] = useState('');
    const [formLargura, setFormLargura] = useState('');
    const [formComprimento, setFormComprimento] = useState('');
    const [formFornecedor, setFormFornecedor] = useState('');
    const [formLote, setFormLote] = useState('');
    const [formCusto, setFormCusto] = useState('');
    const [formLocalizacao, setFormLocalizacao] = useState('');
    const [formObservacao, setFormObservacao] = useState('');

    // Novos estados para retalhos
    const [formBobinaId, setFormBobinaId] = useState<number | ''>('');
    const [formDeduzirDaBobina, setFormDeduzirDaBobina] = useState(false);

    // Estado para modal de status
    const [showStatusModal, setShowStatusModal] = useState<{ type: 'bobina' | 'retalho', item: Bobina | Retalho } | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'bobina' | 'retalho', id: number } | null>(null);

    // Estados de Gestão (Busca e Filtros)
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isGenerating, setIsGenerating] = useState(false);

    // Lógica de Filtragem
    const filteredBobinas = bobinas.filter(b => {
        const matchesSearch = searchTerm === '' ||
            b.id?.toString().includes(searchTerm) ||
            b.filmId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.localizacao && b.localizacao.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (b.lote && b.lote.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'todos' || b.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const filteredRetalhos = retalhos.filter(r => {
        const matchesSearch = searchTerm === '' ||
            r.id?.toString().includes(searchTerm) ||
            r.filmId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.localizacao && r.localizacao.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'todos' || r.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Sincronizar films com props quando mudarem
    useEffect(() => {
        setFilms(initialFilms);
    }, [initialFilms]);

    const loadData = useCallback(async (isInitial = false) => {
        try {
            if (!isInitial) setLoading(true);

            // Se já temos filmes iniciais, não precisamos buscar novamente no carregamento inicial
            const shouldFetchFilms = isInitial ? (films.length === 0) : true;

            const [bobinasData, retalhosData, statsData, filmsData] = await Promise.all([
                getAllBobinas(),
                getAllRetalhos(),
                getEstoqueStats(),
                shouldFetchFilms ? getAllCustomFilms() : Promise.resolve(films)
            ]);

            setBobinas(bobinasData);
            setRetalhos(retalhosData);
            setStats(statsData);
            if (shouldFetchFilms) setFilms(filmsData);
        } catch (error) {
            console.error('Erro ao carregar dados do estoque:', error);
        } finally {
            setLoading(false);
        }
    }, [films]);

    useEffect(() => {
        loadData(true);
    }, []); // Executa apenas uma vez no mount

    // Handle deep linking action
    useEffect(() => {
        if (initialAction?.action === 'scan' && initialAction.code) {
            setShowScannerModal(true);
        }
    }, [initialAction]);

    const generateQRCodeImage = async (code: string) => {
        try {
            // Gerar URL completa para consulta pública
            const baseUrl = window.location.origin;
            const publicUrl = `${baseUrl}?qr=${encodeURIComponent(code)}`;

            const url = await QRCode.toDataURL(publicUrl, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            setQrCodeDataUrl(url);
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
        }
    };

    const handleShowQR = async (type: 'bobina' | 'retalho', item: Bobina | Retalho) => {
        setShowQRModal({ type, item });
        await generateQRCodeImage(item.codigoQr);
    };

    const handlePrintQR = () => {
        if (!showQRModal || !qrCodeDataUrl) return;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const item = showQRModal.item;
            const type = showQRModal.type === 'bobina' ? 'Bobina' : 'Retalho';

            printWindow.document.write(`
                <html>
                <head>
                    <title>QR Code - ${item.codigoQr}</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                        .qr-container { margin: 20px auto; }
                        .code { font-size: 14px; font-weight: bold; margin-top: 10px; }
                        .info { font-size: 12px; color: #666; margin-top: 5px; }
                        @media print {
                            body { margin: 0; padding: 10mm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="qr-container">
                        <img src="${qrCodeDataUrl}" alt="QR Code" width="200" />
                        <div class="code">${item.codigoQr}</div>
                        <div class="info">${type}: ${item.filmId}</div>
                        <div class="info">${item.larguraCm}cm x ${'comprimentoTotalM' in item ? item.comprimentoTotalM + 'm' : (item as Retalho).comprimentoCm + 'cm'}</div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const generateCleanLabelElement = (item: Bobina | Retalho, type: 'bobina' | 'retalho', qrUrl: string) => {
        const card = document.createElement('div');
        card.style.width = '320px';
        card.style.padding = '30px 20px';
        card.style.backgroundColor = '#ffffff';
        card.style.color = '#000000';
        card.style.fontFamily = 'sans-serif';
        card.style.textAlign = 'center';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.border = '1px solid #e2e8f0';
        card.style.borderRadius = '12px';

        // Título
        const titulo = document.createElement('h2');
        titulo.textContent = type === 'bobina' ? 'Bobina' : 'Retalho';
        titulo.style.fontSize = '18px';
        titulo.style.fontWeight = 'bold';
        titulo.style.margin = '0 0 5px 0';
        titulo.style.color = '#1e293b';
        card.appendChild(titulo);

        // Filme
        const filme = document.createElement('p');
        filme.textContent = item.filmId;
        filme.style.fontSize = '16px';
        filme.style.fontWeight = '600';
        filme.style.color = '#334155';
        filme.style.margin = '0 0 20px 0';
        card.appendChild(filme);

        // QR Code Image
        const qrImg = document.createElement('img');
        qrImg.src = qrUrl;
        qrImg.style.width = '160px';
        qrImg.style.height = '160px';
        qrImg.style.margin = '0 auto 15px auto';
        qrImg.style.display = 'block';
        card.appendChild(qrImg);

        // Código
        const codigo = document.createElement('p');
        codigo.textContent = item.codigoQr;
        codigo.style.fontSize = '14px';
        codigo.style.fontFamily = 'monospace';
        codigo.style.color = '#64748b';
        codigo.style.margin = '0 0 5px 0';
        card.appendChild(codigo);

        // Dimensões
        const dimensoes = document.createElement('p');
        const medidas = 'comprimentoTotalM' in item
            ? `${item.larguraCm}cm x ${item.comprimentoTotalM}m`
            : `${item.larguraCm}cm x ${(item as Retalho).comprimentoCm}cm`;
        dimensoes.textContent = medidas;
        dimensoes.style.fontSize = '14px';
        dimensoes.style.color = '#64748b';
        dimensoes.style.margin = '0';
        card.appendChild(dimensoes);

        return card;
    };

    const handleSaveImage = async () => {
        if (!showQRModal || !qrCodeDataUrl) return;

        try {
            setIsGenerating(true);
            const { toPng } = await import('html-to-image');

            // Container invisível
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '-10000px';
            container.style.left = '-10000px';
            document.body.appendChild(container);

            const card = generateCleanLabelElement(showQRModal.item, showQRModal.type, qrCodeDataUrl);
            container.appendChild(card);

            // Delay para renderização
            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = await toPng(card, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
            });

            document.body.removeChild(container);

            const link = document.createElement('a');
            link.download = `qr-${showQRModal.type}-${showQRModal.item.codigoQr}.png`;
            link.href = dataUrl;
            link.click();

        } catch (err) {
            console.error('Erro ao gerar imagem:', err);
            alert('Erro ao gerar imagem. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSavePDF = async () => {
        if (!showQRModal || !qrCodeDataUrl) return;

        try {
            setIsGenerating(true);
            const { toPng } = await import('html-to-image');
            const { jsPDF } = await import('jspdf');

            // Container invisível
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '-10000px';
            container.style.left = '-10000px';
            document.body.appendChild(container);

            const card = generateCleanLabelElement(showQRModal.item, showQRModal.type, qrCodeDataUrl);
            container.appendChild(card);

            // Delay para renderização
            await new Promise(resolve => setTimeout(resolve, 100));

            const imgData = await toPng(card, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
            });

            document.body.removeChild(container);

            // Criar PDF (A6 é um bom tamanho para etiquetas, ou customizado)
            // Vamos usar um tamanho customizado próximo ao da imagem (80mm x 100mm aprox)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 100]
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`qr-${showQRModal.type}-${showQRModal.item.codigoQr}.pdf`);

        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            alert('Erro ao gerar PDF. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddBobina = async () => {
        if (!formFilmId || !formLargura || !formComprimento) {
            alert('Preencha os campos obrigatórios');
            return;
        }

        try {
            const novaBobina: Omit<Bobina, 'id'> = {
                filmId: formFilmId,
                codigoQr: generateQRCode(),
                larguraCm: parseFloat(formLargura),
                comprimentoTotalM: parseFloat(formComprimento),
                comprimentoRestanteM: parseFloat(formComprimento),
                custoTotal: formCusto ? parseFloat(formCusto) : undefined,
                fornecedor: formFornecedor || undefined,
                lote: formLote || undefined,
                status: 'ativa',
                localizacao: formLocalizacao || undefined,
                observacao: formObservacao || undefined
            };

            await saveBobina(novaBobina);
            await loadData();
            resetForm();
            setShowAddModal(false);
        } catch (error) {
            console.error('Erro ao salvar bobina:', error);
            alert('Erro ao salvar bobina');
        }
    };

    const handleAddRetalho = async () => {
        if (!formFilmId || !formLargura || !formComprimento) {
            alert('Preencha os campos obrigatórios');
            return;
        }

        try {
            const novoRetalho: Omit<Retalho, 'id'> = {
                filmId: formFilmId,
                codigoQr: generateQRCode(),
                larguraCm: parseFloat(formLargura),
                comprimentoCm: parseFloat(formComprimento),
                bobinaId: formBobinaId || undefined,
                status: 'disponivel',
                localizacao: formLocalizacao || undefined,
                observacao: formObservacao || undefined
            };

            await saveRetalho(novoRetalho);

            // Se marcou para deduzir da bobina, registra o consumo
            if (formDeduzirDaBobina && formBobinaId) {
                const metrosRetalho = parseFloat(formComprimento) / 100; // cm para metros
                await saveConsumo({
                    bobinaId: formBobinaId,
                    metrosConsumidos: metrosRetalho,
                    larguraCorteCm: parseFloat(formLargura),
                    comprimentoCorteCm: parseFloat(formComprimento),
                    areaM2: (parseFloat(formLargura) * parseFloat(formComprimento)) / 10000,
                    tipo: 'corte',
                    observacao: `Retalho criado: ${formFilmId}`
                });
            }

            await loadData();
            resetForm();
            setShowAddModal(false);
        } catch (error) {
            console.error('Erro ao salvar retalho:', error);
            alert('Erro ao salvar retalho');
        }
    };

    const handleDelete = (type: 'bobina' | 'retalho', id: number) => {
        if (!id) {
            alert('Erro: ID do item não encontrado');
            return;
        }
        setShowDeleteConfirm({ type, id });
    };

    const handleConfirmDelete = async () => {
        if (!showDeleteConfirm) return;

        const { type, id } = showDeleteConfirm;

        try {
            if (type === 'bobina') {
                await deleteBobina(id);
            } else {
                await deleteRetalho(id);
            }
            await loadData();
            setShowDeleteConfirm(null);
        } catch (error: any) {
            console.error(`Erro ao excluir ${type}:`, error);
            const errorMessage = error?.message || 'Erro desconhecido';
            alert(`Erro ao excluir ${type}:\n${errorMessage}`);
        }
    };

    const handleChangeStatus = (type: 'bobina' | 'retalho', item: Bobina | Retalho) => {
        setShowStatusModal({ type, item });
    };

    const handleConfirmStatusChange = async (newStatus: string) => {
        if (!showStatusModal) return;

        const { type, item } = showStatusModal;

        try {
            if (type === 'bobina') {
                await saveBobina({ ...item as Bobina, status: newStatus as Bobina['status'] });
            } else {
                await saveRetalho({ ...item as Retalho, status: newStatus as Retalho['status'] });
            }
            await loadData();
            setShowStatusModal(null);
        } catch (error: any) {
            console.error('Erro ao alterar status:', error);
            alert('Erro ao alterar status');
        }
    };

    const getStatusOptions = (type: 'bobina' | 'retalho') => {
        return type === 'bobina'
            ? [
                { value: 'ativa', label: 'Ativa', emoji: '🟢', color: '#22c55e' },
                { value: 'finalizada', label: 'Finalizada', emoji: '🟡', color: '#f59e0b' },
                { value: 'descartada', label: 'Descartada', emoji: '🔴', color: '#ef4444' }
            ]
            : [
                { value: 'disponivel', label: 'Disponível', emoji: '🟢', color: '#22c55e' },
                { value: 'reservado', label: 'Reservado', emoji: '🟡', color: '#f59e0b' },
                { value: 'usado', label: 'Usado', emoji: '🟠', color: '#f97316' },
                { value: 'descartado', label: 'Descartado', emoji: '🔴', color: '#ef4444' }
            ];
    };

    const resetForm = () => {
        setFormFilmId('');
        setFormLargura('');
        setFormComprimento('');
        setFormFornecedor('');
        setFormLote('');
        setFormCusto('');
        setFormObservacao('');
        setFormLocalizacao('');
        setFormBobinaId('');
        setFormDeduzirDaBobina(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ativa':
            case 'disponivel':
                return 'var(--success)';
            case 'finalizada':
            case 'usado':
                return 'var(--warning)';
            case 'descartada':
            case 'descartado':
                return 'var(--danger)';
            default:
                return 'var(--text-secondary)';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'ativa': 'Ativa',
            'finalizada': 'Finalizada',
            'descartada': 'Descartada',
            'disponivel': 'Disponível',
            'reservado': 'Reservado',
            'usado': 'Usado',
            'descartado': 'Descartado'
        };
        return labels[status] || status;
    };

    const EstoqueSkeleton = () => (
        <div className="estoque-view space-y-6">
            {/* Stats Bar Skeleton */}
            <div className="stats-bar">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="stat-pill bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <Skeleton variant="circular" width={40} height={40} className="flex-shrink-0" />
                        <div className="stat-pill-content space-y-2 flex-grow">
                            <Skeleton variant="text" height={20} width="40%" />
                            <Skeleton variant="text" height={12} width="60%" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Header Skeleton */}
            <div className="estoque-header">
                <Skeleton variant="rounded" height={48} width={240} />
                <Skeleton variant="rounded" height={48} width={160} />
            </div>

            {/* Toolbar Skeleton */}
            <div className="management-toolbar">
                <div className="flex-grow">
                    <Skeleton variant="rounded" height={48} width="100%" />
                </div>
                <div className="flex gap-2">
                    <Skeleton variant="rounded" height={48} width={120} />
                    <Skeleton variant="rounded" height={48} width={80} />
                </div>
            </div>

            {/* List Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center">
                            <Skeleton variant="text" height={24} width="50%" />
                            <div className="flex gap-2">
                                <Skeleton variant="rounded" height={24} width={60} />
                                <Skeleton variant="circular" width={24} height={24} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Skeleton variant="text" height={16} width="100%" />
                            <Skeleton variant="text" height={16} width="80%" />
                        </div>
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-end">
                            <div className="space-y-2">
                                <Skeleton variant="text" height={32} width={80} />
                                <Skeleton variant="text" height={12} width={100} />
                            </div>
                            <Skeleton variant="text" height={24} width={60} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (loading) {
        return <EstoqueSkeleton />;
    }

    return (
        <div className="estoque-view">
            {/* Stats Bar - Layout Horizontal Profissional */}
            {stats && (
                <div className="stats-bar">
                    <div className="stat-pill">
                        <div className="stat-pill-icon">
                            <PackageIcon />
                        </div>
                        <div className="stat-pill-content">
                            <span className="stat-pill-value">{stats.totalBobinasAtivas}</span>
                            <span className="stat-pill-label">Bobinas</span>
                        </div>
                    </div>
                    <div className="stat-pill">
                        <div className="stat-pill-icon primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                        </div>
                        <div className="stat-pill-content">
                            <span className="stat-pill-value">{stats.totalMetrosDisponiveis.toFixed(1)}m</span>
                            <span className="stat-pill-label">Estoque</span>
                        </div>
                    </div>
                    <div className="stat-pill">
                        <div className="stat-pill-icon success">
                            <ScissorsIcon />
                        </div>
                        <div className="stat-pill-content">
                            <span className="stat-pill-value">{stats.totalRetalhoDisponivel}</span>
                            <span className="stat-pill-label">Retalhos</span>
                        </div>
                    </div>
                    <div className="stat-pill">
                        <div className="stat-pill-icon warning">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20V10" />
                                <path d="M18 20V4" />
                                <path d="M6 20v-4" />
                            </svg>
                        </div>
                        <div className="stat-pill-content">
                            <span className="stat-pill-value">{stats.consumoUltimos30Dias.toFixed(1)}m</span>
                            <span className="stat-pill-label">30 dias</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Header com Tabs e Botão Principal */}
            <div className="estoque-header">
                <div className="segmented-tabs">
                    <button
                        className={`segment ${activeTab === 'bobinas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bobinas')}
                    >
                        <PackageIcon />
                        <span>Bobinas</span>
                        <span className="segment-count">{bobinas.length}</span>
                    </button>
                    <button
                        className={`segment ${activeTab === 'retalhos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('retalhos')}
                    >
                        <ScissorsIcon />
                        <span>Retalhos</span>
                        <span className="segment-count">{retalhos.length}</span>
                    </button>
                </div>
                <button
                    className="btn-add-primary"
                    onClick={() => setShowAddModal(true)}
                >
                    <PlusIcon />
                    <span className="btn-text">Nova {activeTab === 'bobinas' ? 'Bobina' : 'Retalho'}</span>
                </button>
            </div>

            {/* Toolbar de Gestão (Fase 2) */}
            <div className="management-toolbar">
                <div className="search-container">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'bobinas' ? 'bobina' : 'retalho'} por ID, filme ou localização...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filters-container">
                    <StatusFilterDropdown
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={
                            activeTab === 'bobinas' ? [
                                { value: 'todos', label: 'Status', emoji: '📦' },
                                { value: 'ativa', label: 'Ativa', emoji: '🟢' },
                                { value: 'finalizada', label: 'Finalizada', emoji: '🔵' },
                                { value: 'descartada', label: 'Descartada', emoji: '🔴' }
                            ] : [
                                { value: 'todos', label: 'Status', emoji: '✂️' },
                                { value: 'disponivel', label: 'Disponível', emoji: '🟢' },
                                { value: 'reservado', label: 'Reservado', emoji: '🟡' },
                                { value: 'usado', label: 'Usado', emoji: '🟠' },
                                { value: 'descartado', label: 'Descartado', emoji: '🔴' }
                            ]
                        }
                    />

                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Visualização em Grade"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="Visualização em Lista"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* FAB - Floating Action Button para Scan QR */}
            <button
                className="fab-scan"
                onClick={() => setShowScannerModal(true)}
                title="Escanear QR Code"
            >
                <QrCodeIcon />
            </button>

            {/* Lista de Bobinas */}
            {/* Lista de Bobinas */}
            {activeTab === 'bobinas' && (
                <>
                    {viewMode === 'grid' ? (
                        <div className="estoque-list">
                            {filteredBobinas.length === 0 ? (
                                <div className="empty-state">
                                    <PackageIcon />
                                    <p>Nenhuma bobina encontrada</p>
                                    <p className="empty-hint">Tente ajustar os filtros ou busca</p>
                                </div>
                            ) : (
                                filteredBobinas.map(bobina => {
                                    const usagePercent = ((1 - bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100);
                                    const remaining = bobina.comprimentoRestanteM / bobina.comprimentoTotalM;
                                    return (
                                        <div key={bobina.id} className="estoque-card">
                                            {/* Header: Linha única com nome, status e QR */}
                                            <div className="card-header-row">
                                                <h3 className="card-title">{bobina.filmId}</h3>
                                                <div className="card-header-right">
                                                    <span
                                                        className="status-pill"
                                                        style={{ backgroundColor: getStatusColor(bobina.status) }}
                                                    >
                                                        {getStatusLabel(bobina.status)}
                                                    </span>
                                                    <button
                                                        className="qr-icon-btn"
                                                        onClick={() => handleShowQR('bobina', bobina)}
                                                        title="QR Code"
                                                    >
                                                        <QrCodeIcon />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Localizacao como linha separada se existir */}
                                            {bobina.localizacao && (
                                                <div className="card-location-row">
                                                    📍 {bobina.localizacao}
                                                </div>
                                            )}

                                            {/* Corpo: Métrica principal */}
                                            <div className="card-body">
                                                <div className="main-metric">
                                                    <div className="metric-value-group">
                                                        <span className="metric-value">{bobina.comprimentoRestanteM.toFixed(1)}</span>
                                                        <span className="metric-unit">m</span>
                                                    </div>
                                                    <span className="metric-label">restantes de {bobina.comprimentoTotalM}m</span>
                                                </div>

                                                {/* Barra de progresso fina sem texto interno */}
                                                <div className="progress-section">
                                                    <div className="progress-bar-thin">
                                                        <div
                                                            className="progress-fill"
                                                            style={{
                                                                width: `${(bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100}%`,
                                                                background: (bobina.comprimentoRestanteM / bobina.comprimentoTotalM) > 0.5
                                                                    ? '#22c55e'
                                                                    : (bobina.comprimentoRestanteM / bobina.comprimentoTotalM) > 0.2
                                                                        ? '#f59e0b'
                                                                        : '#ef4444'
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="usage-text">
                                                        {((1 - bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100).toFixed(0)}% usado
                                                    </span>
                                                </div>

                                                {/* Chips de informações secundárias */}
                                                <div className="info-chips">
                                                    <div className="info-chip">
                                                        <span className="chip-value">{bobina.larguraCm}</span>
                                                        <span className="chip-label">cm largura</span>
                                                    </div>
                                                    {bobina.fornecedor && (
                                                        <div className="info-chip">
                                                            <span className="chip-value">{bobina.fornecedor}</span>
                                                            <span className="chip-label">fornecedor</span>
                                                        </div>
                                                    )}
                                                    {bobina.lote && (
                                                        <div className="info-chip">
                                                            <span className="chip-value">{bobina.lote}</span>
                                                            <span className="chip-label">lote</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer: Um botão primário */}
                                            <div className="card-footer">
                                                <button
                                                    className="primary-action-btn"
                                                    onClick={() => handleChangeStatus('bobina', bobina)}
                                                >
                                                    ⚙️ Gerenciar
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    ) : (
                        <div className="estoque-table-container">
                            <table className="estoque-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Filme</th>
                                        <th>Medidas</th>
                                        <th>Restante</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBobinas.map(bobina => (
                                        <tr key={bobina.id}>
                                            <td>#{bobina.id}</td>
                                            <td>
                                                <div className="table-film-info">
                                                    <span className="film-id">{bobina.filmId}</span>
                                                    {bobina.localizacao && <span className="film-loc">📍 {bobina.localizacao}</span>}
                                                </div>
                                            </td>
                                            <td>{bobina.larguraCm}cm x {bobina.comprimentoTotalM}m</td>
                                            <td>
                                                <div className="table-progress">
                                                    <div className="table-progress-bar">
                                                        <div
                                                            className="table-progress-fill"
                                                            style={{
                                                                width: `${(bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100}%`,
                                                                backgroundColor: getStatusColor(bobina.status)
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{bobina.comprimentoRestanteM.toFixed(1)}m</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span
                                                    className="status-badge small"
                                                    style={{ backgroundColor: getStatusColor(bobina.status) }}
                                                >
                                                    {getStatusLabel(bobina.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button onClick={() => handleShowQR('bobina', bobina)} title="QR Code">
                                                        <QrCodeIcon />
                                                    </button>
                                                    <button onClick={() => handleChangeStatus('bobina', bobina)} title="Status">
                                                        ⚙️
                                                    </button>
                                                    <button onClick={() => handleDelete('bobina', bobina.id!)} title="Excluir" className="text-red-500">
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Lista de Retalhos */}
            {activeTab === 'retalhos' && (
                <>
                    {viewMode === 'grid' ? (
                        <div className="estoque-list">
                            {filteredRetalhos.length === 0 ? (
                                <div className="empty-state">
                                    <ScissorsIcon />
                                    <p>Nenhum retalho encontrado</p>
                                    <p className="empty-hint">Tente ajustar os filtros ou busca</p>
                                </div>
                            ) : (
                                filteredRetalhos.map(retalho => (
                                    <div key={retalho.id} className="estoque-card">
                                        {/* Header: Linha única com nome, status e QR */}
                                        <div className="card-header-row">
                                            <h3 className="card-title">{retalho.filmId}</h3>
                                            <div className="card-header-right">
                                                <span
                                                    className="status-pill"
                                                    style={{ backgroundColor: getStatusColor(retalho.status) }}
                                                >
                                                    {getStatusLabel(retalho.status)}
                                                </span>
                                                <button
                                                    className="qr-icon-btn"
                                                    onClick={() => handleShowQR('retalho', retalho)}
                                                    title="QR Code"
                                                >
                                                    <QrCodeIcon />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Localização como linha separada se existir */}
                                        {retalho.localizacao && (
                                            <div className="card-location-row">
                                                📍 {retalho.localizacao}
                                            </div>
                                        )}

                                        {/* Corpo: Métrica principal */}
                                        <div className="card-body">
                                            <div className="main-metric">
                                                <div className="metric-value-group">
                                                    <span className="metric-value">{retalho.areaM2?.toFixed(2) || ((retalho.larguraCm * retalho.comprimentoCm) / 10000).toFixed(2)}</span>
                                                    <span className="metric-unit">m²</span>
                                                </div>
                                                <span className="metric-label">área total do retalho</span>
                                            </div>

                                            {/* Chips de informações secundárias */}
                                            <div className="info-chips">
                                                <div className="info-chip">
                                                    <span className="chip-value">{retalho.larguraCm}</span>
                                                    <span className="chip-label">cm largura</span>
                                                </div>
                                                <div className="info-chip">
                                                    <span className="chip-value">{retalho.comprimentoCm}</span>
                                                    <span className="chip-label">cm comprimento</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer: Um botão primário */}
                                        <div className="card-footer">
                                            <button
                                                className="primary-action-btn"
                                                onClick={() => handleChangeStatus('retalho', retalho)}
                                            >
                                                ⚙️ Gerenciar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="estoque-table-container">
                            <table className="estoque-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Filme</th>
                                        <th>Medidas</th>
                                        <th>Área</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRetalhos.map(retalho => (
                                        <tr key={retalho.id}>
                                            <td>#{retalho.id}</td>
                                            <td>
                                                <div className="table-film-info">
                                                    <span className="film-id">{retalho.filmId}</span>
                                                    {retalho.localizacao && <span className="film-loc">📍 {retalho.localizacao}</span>}
                                                </div>
                                            </td>
                                            <td>{retalho.larguraCm}cm x {retalho.comprimentoCm}cm</td>
                                            <td>{retalho.areaM2?.toFixed(2) || ((retalho.larguraCm * retalho.comprimentoCm) / 10000).toFixed(2)} m²</td>
                                            <td>
                                                <span
                                                    className="status-badge small"
                                                    style={{ backgroundColor: getStatusColor(retalho.status) }}
                                                >
                                                    {getStatusLabel(retalho.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button onClick={() => handleShowQR('retalho', retalho)} title="QR Code">
                                                        <QrCodeIcon />
                                                    </button>
                                                    <button onClick={() => handleChangeStatus('retalho', retalho)} title="Status">
                                                        ⚙️
                                                    </button>
                                                    <button onClick={() => handleDelete('retalho', retalho.id!)} title="Excluir" className="text-red-500">
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Modal Adicionar - Padrão Visual Consistente */}
            {showAddModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setShowAddModal(false)}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header Fixo */}
                        <div className="flex-shrink-0 p-4 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-100">
                                    {activeTab === 'bobinas' ? 'Nova Bobina' : 'Novo Retalho'}
                                </h2>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-700"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Body Scrollável */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Película */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Película *
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowFilmSelectionModal(true)}
                                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-left hover:bg-slate-600 hover:border-slate-500 transition-all flex items-center justify-between"
                                >
                                    <span className={formFilmId ? 'text-slate-100' : 'text-slate-400'}>
                                        {formFilmId || 'Selecione uma película'}
                                    </span>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-slate-400">
                                        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* Largura e Comprimento */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Largura (cm) *
                                    </label>
                                    <input
                                        type="number"
                                        value={formLargura}
                                        onChange={e => setFormLargura(e.target.value)}
                                        placeholder="Ex: 152"
                                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        {activeTab === 'bobinas' ? 'Comprimento (m) *' : 'Comprimento (cm) *'}
                                    </label>
                                    <input
                                        type="number"
                                        value={formComprimento}
                                        onChange={e => setFormComprimento(e.target.value)}
                                        placeholder={activeTab === 'bobinas' ? 'Ex: 30' : 'Ex: 150'}
                                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Campos específicos de Bobina */}
                            {activeTab === 'bobinas' ? (
                                <>
                                    {/* Fornecedor e Lote */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Fornecedor
                                            </label>
                                            <input
                                                type="text"
                                                value={formFornecedor}
                                                onChange={e => setFormFornecedor(e.target.value)}
                                                placeholder="Ex: 3M, Solar Gard"
                                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Lote
                                            </label>
                                            <input
                                                type="text"
                                                value={formLote}
                                                onChange={e => setFormLote(e.target.value)}
                                                placeholder="Ex: ABC123"
                                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Custo Total */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Custo Total (R$)
                                        </label>
                                        <input
                                            type="number"
                                            value={formCusto}
                                            onChange={e => setFormCusto(e.target.value)}
                                            placeholder="Ex: 1500.00"
                                            step="0.01"
                                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Origem do Retalho */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Origem do Retalho
                                        </label>
                                        <select
                                            value={formBobinaId}
                                            onChange={e => {
                                                const val = e.target.value ? parseInt(e.target.value) : '';
                                                setFormBobinaId(val);
                                                if (val) {
                                                    const bobina = bobinas.find(b => b.id === val);
                                                    if (bobina) {
                                                        setFormFilmId(bobina.filmId);
                                                        setFormLargura(bobina.larguraCm.toString());
                                                    }
                                                }
                                            }}
                                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        >
                                            <option value="">Retalho avulso (sem bobina)</option>
                                            {bobinas.filter(b => b.status === 'ativa').map(bobina => (
                                                <option key={bobina.id} value={bobina.id}>
                                                    {bobina.filmId} - {bobina.larguraCm}cm ({bobina.comprimentoRestanteM.toFixed(1)}m restantes)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Checkbox Deduzir da Bobina */}
                                    {formBobinaId && (
                                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formDeduzirDaBobina}
                                                    onChange={e => setFormDeduzirDaBobina(e.target.checked)}
                                                    className="mt-1 w-4 h-4 rounded border-slate-500 text-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                />
                                                <div className="flex-1">
                                                    <span className="text-slate-200 font-medium">
                                                        Deduzir do estoque da bobina
                                                    </span>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Ao marcar, o comprimento do retalho será descontado da bobina automaticamente
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Localização */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Localização
                                </label>
                                <input
                                    type="text"
                                    value={formLocalizacao}
                                    onChange={e => setFormLocalizacao(e.target.value)}
                                    placeholder="Ex: Prateleira A, Gaveta 3"
                                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                />
                            </div>

                            {/* Observação */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observação
                                </label>
                                <textarea
                                    value={formObservacao}
                                    onChange={e => setFormObservacao(e.target.value)}
                                    placeholder="Observações adicionais..."
                                    rows={3}
                                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        {/* Footer Fixo com Botões */}
                        <div className="flex-shrink-0 p-4 border-t border-slate-700 flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-700 text-slate-200 font-semibold rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={activeTab === 'bobinas' ? handleAddBobina : handleAddRetalho}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {activeTab === 'bobinas' ? 'Adicionar Bobina' : 'Adicionar Retalho'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal QR Code - Design Moderno */}
            {showQRModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setShowQRModal(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header com X no canto */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <QrCodeIcon />
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                    {showQRModal.type === 'bobina' ? 'Bobina' : 'Retalho'}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowQRModal(null)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Corpo - QR Code e Info */}
                        <div className="p-6 flex flex-col items-center">
                            {/* QR Code com borda sutil */}
                            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-4">
                                {qrCodeDataUrl && (
                                    <img src={qrCodeDataUrl} alt="QR Code" className="w-40 h-40" />
                                )}
                            </div>

                            {/* Código */}
                            <p className="font-mono text-sm text-slate-500 dark:text-slate-400 mb-2">
                                {showQRModal.item.codigoQr}
                            </p>

                            {/* Nome do Filme */}
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 text-center">
                                {showQRModal.item.filmId}
                            </h3>

                            {/* Dimensões */}
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                {showQRModal.item.larguraCm}cm x {
                                    'comprimentoTotalM' in showQRModal.item
                                        ? `${showQRModal.item.comprimentoTotalM}m`
                                        : `${(showQRModal.item as Retalho).comprimentoCm}cm`
                                }
                            </p>
                        </div>

                        {/* Footer - Apenas botões de download */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                            <button
                                onClick={handleSaveImage}
                                disabled={isGenerating}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        PNG
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleSavePDF}
                                disabled={isGenerating}
                                className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                        PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner QR Code Modal */}
            <QRScannerModal
                isOpen={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                onDataUpdated={loadData}
            />

            {/* Film Selection Modal - Reutilizado do seletor de medidas */}
            <FilmSelectionModal
                isOpen={showFilmSelectionModal}
                onClose={() => setShowFilmSelectionModal(false)}
                films={films}
                onSelect={(filmName) => {
                    setFormFilmId(filmName);
                    setShowFilmSelectionModal(false);
                }}
                onAddNewFilm={(filmName) => {
                    setFilmNameToAdd(filmName);
                    setEditingFilm(null);
                    setShowFilmModal(true);
                }}
                onEditFilm={(film) => {
                    setEditingFilm(film);
                    setShowFilmModal(true);
                }}
                onDeleteFilm={(filmName) => {
                    // Handler de deletar seria implementado aqui se necessário
                    console.log('Deletar película:', filmName);
                }}
                onTogglePin={(filmName) => {
                    // Handler de fixar seria implementado aqui se necessário
                    console.log('Toggle pin:', filmName);
                }}
            />

            {/* Film Modal - Para adicionar/editar películas */}
            {showFilmModal && (
                <FilmModal
                    isOpen={showFilmModal}
                    onClose={() => {
                        setShowFilmModal(false);
                        setEditingFilm(null);
                        setFilmNameToAdd('');
                    }}
                    onSave={async (film) => {
                        try {
                            // Salvar a película no banco de dados
                            await saveCustomFilm(film);
                            // Selecionar automaticamente a película recém-criada no formulário
                            setFormFilmId(film.nome);
                            // Recarregar dados para atualizar a lista de films
                            await loadData();
                            // Fechar modais
                            setShowFilmModal(false);
                            setEditingFilm(null);
                            setFilmNameToAdd('');
                        } catch (error) {
                            console.error('Erro ao salvar película:', error);
                        }
                    }}
                    onDelete={async (filmName) => {
                        // Handler de deletar se necessário
                        setShowFilmModal(false);
                        setEditingFilm(null);
                        await loadData();
                    }}
                    film={editingFilm}
                    initialName={filmNameToAdd}
                    films={films}
                />
            )}


            {/* Status Drawer - Estilo iOS */}
            {showStatusModal && (
                <StatusDrawer
                    isOpen={true}
                    onClose={() => setShowStatusModal(null)}
                    type={showStatusModal.type}
                    item={showStatusModal.item}
                    currentStatus={showStatusModal.item.status}
                    statusOptions={getStatusOptions(showStatusModal.type)}
                    onStatusChange={handleConfirmStatusChange}
                    onDelete={handleDelete}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                />
            )}

            {/* Modal Confirmação de Exclusão */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content status-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 style={{ color: 'var(--danger)' }}>Confirmar Exclusão</h2>
                            <button className="close-btn" onClick={() => setShowDeleteConfirm(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                                Tem certeza que deseja excluir este <strong>{showDeleteConfirm.type}</strong>?
                            </p>
                            {showDeleteConfirm.type === 'bobina' ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Todos os consumos associados a ela permanecerão no histórico.
                                </p>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Dica: Se o retalho foi usado, considere mudar o status para "usado" ao invés de excluir.
                                </p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(null)}>
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                style={{ flex: 1, backgroundColor: 'var(--danger)' }}
                                onClick={handleConfirmDelete}
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .estoque-view {
                    padding: 1rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding-bottom: 80px; /* Espaço para FAB */
                }

                /* Stats Bar - Layout Horizontal Moderno */
                .stats-bar {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.05) 100%);
                    border-radius: 16px;
                    margin-bottom: 1.25rem;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                }

                .stats-bar::-webkit-scrollbar {
                    display: none;
                }

                .stat-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: var(--card-bg);
                    padding: 0.875rem 1rem;
                    border-radius: 12px;
                    min-width: 140px;
                    flex: 1;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .stat-pill:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                }

                .stat-pill-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: rgba(100, 116, 139, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    flex-shrink: 0;
                }

                .stat-pill-icon.primary {
                    background: rgba(59, 130, 246, 0.12);
                    color: #3b82f6;
                }

                .stat-pill-icon.success {
                    background: rgba(34, 197, 94, 0.12);
                    color: #22c55e;
                }

                .stat-pill-icon.warning {
                    background: rgba(245, 158, 11, 0.12);
                    color: #f59e0b;
                }

                .stat-pill-icon svg {
                    width: 18px;
                    height: 18px;
                }

                .stat-pill-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .stat-pill-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1.2;
                }

                .stat-pill-label {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 500;
                }

                /* Header com Tabs e Botão */
                .estoque-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1.25rem;
                    flex-wrap: wrap;
                }

                /* Segmented Tabs - Estilo iOS/Material */
                .segmented-tabs {
                    display: flex;
                    background: var(--card-bg);
                    padding: 4px;
                    border-radius: 12px;
                    gap: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }

                .segment {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-weight: 500;
                    font-size: 0.875rem;
                }

                .segment svg {
                    width: 18px;
                    height: 18px;
                }

                .segment-count {
                    background: rgba(100, 116, 139, 0.15);
                    padding: 0.125rem 0.5rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                }

                .segment.active {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                }

                .segment.active .segment-count {
                    background: rgba(255,255,255,0.25);
                    color: white;
                }

                .segment:hover:not(.active) {
                    background: var(--bg-secondary);
                }

                /* Botão Principal Add */
                .btn-add-primary {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1.25rem;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
                }

                .btn-add-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
                }

                .btn-add-primary svg {
                    width: 18px;
                    height: 18px;
                }

                /* FAB - Floating Action Button */
                .fab-scan {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    border: none;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
                    z-index: 100;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .fab-scan:hover {
                    transform: scale(1.08);
                    box-shadow: 0 6px 28px rgba(139, 92, 246, 0.5);
                }

                .fab-scan:active {
                    transform: scale(0.95);
                }

                .fab-scan svg {
                    width: 24px;
                    height: 24px;
                }

                .estoque-list {
                    display: grid;
                    gap: 1rem;
                }

                .estoque-card {
                    background: var(--card-bg);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                    transition: all 0.2s;
                }

                .estoque-card:hover {
                    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
                    border-color: rgba(59, 130, 246, 0.2);
                }

                /* === Novo Design: Header em Linha Única === */
                .card-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--border-color);
                    gap: 0.75rem;
                }

                .card-title {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                    min-width: 0;
                }

                .card-header-right {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }

                .status-pill {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: white;
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .qr-icon-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: none;
                    background: rgba(59, 130, 246, 0.1);
                    color: #3b82f6;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .qr-icon-btn:hover {
                    background: rgba(59, 130, 246, 0.2);
                    transform: scale(1.05);
                }

                .qr-icon-btn svg {
                    width: 16px;
                    height: 16px;
                }

                /* Localização como linha separada */
                .card-location-row {
                    padding: 0.5rem 1.25rem;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    background: rgba(59, 130, 246, 0.03);
                    border-bottom: 1px solid var(--border-color);
                }

                /* === Corpo do Card === */
                .card-body {
                    padding: 1.25rem;
                }

                /* Métrica Principal */
                .main-metric {
                    text-align: center;
                    margin-bottom: 1rem;
                }

                .metric-value-group {
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 0.25rem;
                    margin-bottom: 0.25rem;
                }

                .metric-value {
                    font-size: 2.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1;
                }

                .metric-unit {
                    font-size: 1.25rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .metric-label {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    font-weight: 400;
                }

                /* Barra de Progresso Fina */
                .progress-section {
                    margin-bottom: 1rem;
                }

                .progress-bar-thin {
                    height: 6px;
                    background: rgba(148, 163, 184, 0.15);
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                }

                .progress-fill {
                    height: 100%;
                    border-radius: 10px;
                    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .usage-text {
                    display: block;
                    text-align: center;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                }

                /* Chips de Informações */
                .info-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    justify-content: center;
                }

                .info-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    background: rgba(59, 130, 246, 0.08);
                    padding: 0.375rem 0.75rem;
                    border-radius: 20px;
                    border: 1px solid rgba(59, 130, 246, 0.15);
                }

                .chip-value {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .chip-label {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    font-weight: 400;
                }

                /* === Footer com Botão Primário === */
                .card-footer {
                    padding: 1rem 1.25rem;
                    border-top: 1px solid var(--border-color);
                    background: rgba(148, 163, 184, 0.03);
                }

                .primary-action-btn {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
                }

                .primary-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
                }

                .primary-action-btn:active {
                    transform: translateY(0);
                }

                /* === Estilos Antigos Mantidos para Compatibilidade === */

                .estoque-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, transparent 100%);
                    border-bottom: 1px solid var(--border-color);
                }

                .estoque-card-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .status-badge {
                    padding: 0.3rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: white;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .estoque-card-body {
                    padding: 1.25rem;
                }

                /* Grid de Métricas Redesenhado */
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .info-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                /* Card Title Section */
                .card-title-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .card-location {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    font-weight: 400;
                }

                /* Hero Metric - Métrica Principal em Destaque */
                .hero-metric {
                    text-align: center;
                    padding: 1rem 0;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
                    margin-bottom: 1rem;
                }

                .hero-metric-main {
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 0.25rem;
                }

                .hero-value {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: var(--text-primary);
                    line-height: 1;
                }

                .hero-unit {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                }

                .hero-label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-top: 0.25rem;
                    display: block;
                }

                /* Progress Bar Grande */
                .progress-container {
                    margin-bottom: 1rem;
                }

                .progress-bar-large {
                    height: 12px;
                    background: rgba(148, 163, 184, 0.15);
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                }

                .progress-fill-large {
                    height: 100%;
                    border-radius: 8px;
                    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .progress-percent {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                }

                /* Métricas Secundárias em Chips */
                .secondary-metrics {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                .metric-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    background: rgba(59, 130, 246, 0.08);
                    padding: 0.375rem 0.75rem;
                    border-radius: 20px;
                    border: 1px solid rgba(59, 130, 246, 0.15);
                }

                .metric-chip-value {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .metric-chip-label {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    font-weight: 400;
                }

                /* Footer com Action Buttons */
                .estoque-card-footer {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: linear-gradient(180deg, rgba(148, 163, 184, 0.03) 0%, rgba(148, 163, 184, 0.08) 100%);
                    border-top: 1px solid rgba(148, 163, 184, 0.1);
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn svg {
                    width: 16px;
                    height: 16px;
                }

                .action-btn.qr {
                    background: rgba(59, 130, 246, 0.1);
                    color: #3b82f6;
                    flex: 1;
                    justify-content: center;
                }

                .action-btn.qr:hover {
                    background: rgba(59, 130, 246, 0.2);
                }

                .action-btn.settings {
                    background: rgba(100, 116, 139, 0.1);
                    color: var(--text-secondary);
                    flex: 1;
                    justify-content: center;
                }

                .action-btn.settings:hover {
                    background: rgba(100, 116, 139, 0.2);
                }

                .action-btn.delete {
                    background: rgba(239, 68, 68, 0.08);
                    color: #ef4444;
                    padding: 0.5rem;
                }

                .action-btn.delete:hover {
                    background: rgba(239, 68, 68, 0.15);
                }

                /* Legacy support */
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .info-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .info-item .label {
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 500;
                }

                .info-item .value {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .info-item.highlight .value {
                    color: var(--primary);
                    font-size: 1.1rem;
                }

                .info-extra {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.75rem;
                }

                .progress-bar {
                    height: 8px;
                    background: var(--bg-secondary);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    transition: width 0.3s ease;
                }

                .qr-code-text {
                    flex: 1;
                    font-family: monospace;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: none;
                    background: var(--card-bg);
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .btn-icon:hover {
                    background: var(--primary-light);
                    color: var(--primary);
                }

                .btn-icon.danger:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--danger);
                }

                .btn-icon.status {
                    font-size: 1rem;
                }

                .btn-icon.status:hover {
                    background: rgba(59, 130, 246, 0.1);
                    color: #3b82f6;
                }

                /* Modal de Status */
                .status-modal {
                    max-width: 400px;
                }

                .status-item-name {
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin: 0 0 0.5rem 0;
                    color: var(--text-primary);
                }

                .status-current {
                    color: var(--text-secondary);
                    margin: 0 0 1.5rem 0;
                }

                .status-label {
                    font-weight: 500;
                    margin: 0 0 1rem 0;
                }

                .status-options {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .status-option-btn {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    border: 2px solid var(--border-color);
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }

                .status-option-btn:hover:not(:disabled) {
                    border-color: var(--status-color);
                    background: rgba(var(--status-color), 0.1);
                    transform: translateX(4px);
                }

                .status-option-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .status-option-btn.current {
                    border-color: var(--status-color);
                    background: rgba(0, 0, 0, 0.05);
                }

                .status-emoji {
                    font-size: 1.5rem;
                }

                .status-text {
                    font-weight: 600;
                    font-size: 1.1rem;
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-secondary);
                }

                .empty-state svg {
                    width: 64px;
                    height: 64px;
                    margin-bottom: 1rem;
                    opacity: 0.5;
                }

                .empty-hint {
                    font-size: 0.85rem;
                    margin-top: 0.5rem;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .modal-content {
                    background: #ffffff;
                    border-radius: 16px;
                    width: 100%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow: auto;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }

                @media (prefers-color-scheme: dark) {
                    .modal-content {
                        background: #1e293b;
                    }
                }

                .dark .modal-content {
                    background: #1e293b;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                }

                .close-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: none;
                    background: var(--bg-secondary);
                    font-size: 1.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                }

                .modal-body {
                    padding: 1.5rem;
                }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 1rem;
                }

                .form-group textarea {
                    resize: vertical;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .checkbox-group {
                    background: var(--primary-light);
                    padding: 1rem;
                    border-radius: 8px;
                    border: 1px solid var(--primary);
                }

                .checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-weight: 500;
                }

                .checkbox-label input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .checkbox-hint {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-top: 0.5rem;
                }

                .modal-footer {
                    display: flex;
                    gap: 1rem;
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--border-color);
                }

                .btn-secondary,
                .btn-primary {
                    flex: 1;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-secondary {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                }

                .btn-primary {
                    background: var(--primary);
                    border: none;
                    color: white;
                }

                .btn-primary:hover {
                    background: var(--primary-dark);
                }

                /* QR Modal */
                .qr-modal {
                    max-width: 400px;
                }

                .qr-body {
                    text-align: center;
                }

                .qr-image {
                    max-width: 200px;
                    margin: 0 auto 1rem;
                }

                .qr-info {
                    margin-top: 1rem;
                }

                .qr-code-display {
                    font-family: monospace;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--primary);
                    margin-bottom: 0.5rem;
                }

                .qr-film {
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .qr-dimensions {
                    color: var(--text-secondary);
                }

                .loading-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--text-secondary);
                }

                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--border-color);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 1rem;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Modal Status V2 - Redesign Profissional */
                .status-modal-v2 {
                    background: var(--card-bg);
                    border-radius: 24px;
                    width: 100%;
                    max-width: 400px;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                    animation: fadeInUp 0.3s ease-out;
                }

                @media (max-width: 600px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                    
                    /* Stats bar - scroll horizontal em mobile */
                    .stats-bar {
                        padding: 0.5rem;
                        gap: 0.5rem;
                    }
                    
                    .stat-pill {
                        min-width: 120px;
                        padding: 0.75rem;
                    }
                    
                    .stat-pill-value {
                        font-size: 1.1rem;
                    }
                    
                    .stat-pill-icon {
                        width: 32px;
                        height: 32px;
                    }
                    
                    /* Header com tabs - empilhar em mobile */
                    .estoque-header {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .segmented-tabs {
                        width: 100%;
                    }
                    
                    .segment {
                        flex: 1;
                        justify-content: center;
                        padding: 0.75rem 0.5rem;
                    }
                    
                    .segment span:not(.segment-count) {
                        display: none;
                    }

                    /* Modal Mobile */
                    .status-modal-v2 {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        max-width: 100%;
                        border-radius: 24px 24px 0 0;
                        margin: 0;
                        animation: slideUp 0.3s ease-out;
                    }
                    
                    @keyframes slideUp {
                        from { transform: translateY(100%); }
                        to { transform: translateY(0); }
                    }

                    .status-options-grid {
                        grid-template-columns: 1fr;
                        gap: 0.5rem;
                    }
                    
                    .status-option-card {
                        padding: 0.875rem;
                    }
                    
                    .btn-add-primary {
                        width: 100%;
                        justify-content: center;
                        padding: 0.875rem;
                    }
                    
                    /* FAB posição ajustada */
                    .fab-scan {
                        bottom: 16px;
                        right: 16px;
                        width: 52px;
                        height: 52px;
                    }
                    
                    /* Cards redesenhados mobile */
                    .hero-value {
                        font-size: 2rem;
                    }
                    
                    .hero-unit {
                        font-size: 1.25rem;
                    }
                    
                    .hero-label {
                        font-size: 0.75rem;
                    }
                    
                    .progress-bar-large {
                        height: 10px;
                    }
                    
                    .secondary-metrics {
                        gap: 0.375rem;
                    }
                    
                    .metric-chip {
                        padding: 0.25rem 0.5rem;
                    }
                    
                    .metric-chip-value {
                        font-size: 0.75rem;
                    }
                    
                    .metric-chip-label {
                        font-size: 0.65rem;
                    }
                    
                    .action-btn {
                        padding: 0.5rem 0.625rem;
                        font-size: 0.75rem;
                    }
                    
                    .action-btn span {
                        display: none;
                    }
                    
                    .action-btn svg {
                        width: 18px;
                        height: 18px;
                    }
                    
                    /* Legacy - grid de métricas 2x2 */
                    .info-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 0.75rem;
                    }
                    
                    .info-item .value {
                        font-size: 1rem;
                    }

                    /* === AJUSTES MOBILE PARA NOVO CARD === */
                    
                    /* Header mais compacto */
                    .card-header-row {
                        padding: 0.75rem 1rem;
                        gap: 0.5rem;
                    }

                    .card-title {
                        font-size: 0.95rem;
                    }

                    .status-pill {
                        padding: 0.2rem 0.6rem;
                        font-size: 0.6rem;
                    }

                    .qr-icon-btn {
                        width: 28px;
                        height: 28px;
                    }

                    .qr-icon-btn svg {
                        width: 14px;
                        height: 14px;
                    }

                    /* Localização mais compacta */
                    .card-location-row {
                        padding: 0.4rem 1rem;
                        font-size: 0.75rem;
                    }

                    /* Corpo mais compacto */
                    .card-body {
                        padding: 1rem;
                    }

                    /* Métrica principal menor */
                    .metric-value {
                        font-size: 1.75rem;
                    }

                    .metric-unit {
                        font-size: 1rem;
                    }

                    .metric-label {
                        font-size: 0.75rem;
                    }

                    /* Barra de progresso e texto */
                    .progress-bar-thin {
                        height: 5px;
                    }

                    .usage-text {
                        font-size: 0.7rem;
                    }

                    /* Chips menores */
                    .info-chips {
                        gap: 0.375rem;
                    }

                    .info-chip {
                        padding: 0.3rem 0.6rem;
                    }

                    .chip-value {
                        font-size: 0.72rem;
                    }

                    .chip-label {
                        font-size: 0.65rem;
                    }

                    /* Footer e botão primário */
                    .card-footer {
                        padding: 0.75rem 1rem;
                    }

                    .primary-action-btn {
                        padding: 0.625rem 0.875rem;
                        font-size: 0.85rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default EstoqueView;
