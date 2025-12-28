import React, { useState, useEffect, useCallback } from 'react';
import { Bobina, Retalho, Film } from '../../types';
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
import { getAllCustomFilms } from '../../services/db';
import QRCode from 'qrcode';
import QRScannerModal from '../modals/QRScannerModal';

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

const EstoqueView: React.FC<EstoqueViewProps> = ({ films, initialAction }) => {
    const [activeTab, setActiveTab] = useState<'bobinas' | 'retalhos'>('bobinas');
    const [bobinas, setBobinas] = useState<Bobina[]>([]);
    const [retalhos, setRetalhos] = useState<Retalho[]>([]);
    const [stats, setStats] = useState<EstoqueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState<{ type: 'bobina' | 'retalho', item: Bobina | Retalho } | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [showScannerModal, setShowScannerModal] = useState(false);

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

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [bobinasData, retalhosData, statsData] = await Promise.all([
                getAllBobinas(),
                getAllRetalhos(),
                getEstoqueStats()
            ]);
            setBobinas(bobinasData);
            setRetalhos(retalhosData);
            setStats(statsData);
        } catch (error) {
            console.error('Erro ao carregar dados do estoque:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
                        <img src="${qrCodeDataUrl}" alt="QR Code" />
                        <div class="code">${item.codigoQr}</div>
                        <div class="info">${type}: ${item.filmId}</div>
                        <div class="info">${item.larguraCm}cm x ${'comprimentoTotalM' in item ? item.comprimentoTotalM + 'm' : (item as Retalho).comprimentoCm + 'cm'}</div>
                    </div>
                    <script>window.print(); window.close();</script>
                </body>
                </html>
            `);
            printWindow.document.close();
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

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Carregando estoque...</p>
            </div>
        );
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
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="status-filter"
                    >
                        <option value="todos">Todos os Status</option>
                        {activeTab === 'bobinas' ? (
                            <>
                                <option value="ativa">Ativa</option>
                                <option value="finalizada">Finalizada</option>
                                <option value="descartada">Descartada</option>
                            </>
                        ) : (
                            <>
                                <option value="disponivel">Disponível</option>
                                <option value="reservado">Reservado</option>
                                <option value="usado">Usado</option>
                                <option value="descartado">Descartado</option>
                            </>
                        )}
                    </select>

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
                                            {/* Header compacto */}
                                            <div className="estoque-card-header">
                                                <div className="card-title-section">
                                                    <h3>{bobina.filmId}</h3>
                                                    {bobina.localizacao && <span className="card-location">📍 {bobina.localizacao}</span>}
                                                </div>
                                                <span
                                                    className="status-badge"
                                                    style={{ backgroundColor: getStatusColor(bobina.status) }}
                                                >
                                                    {getStatusLabel(bobina.status)}
                                                </span>
                                            </div>

                                            <div className="estoque-card-body">
                                                {/* Métrica Principal Destacada */}
                                                <div className="hero-metric">
                                                    <div className="hero-metric-main">
                                                        <span className="hero-value">{bobina.comprimentoRestanteM.toFixed(1)}</span>
                                                        <span className="hero-unit">m</span>
                                                    </div>
                                                    <span className="hero-label">restantes de {bobina.comprimentoTotalM}m</span>
                                                </div>

                                                {/* Progress Bar Grande */}
                                                <div className="progress-container">
                                                    <div className="progress-bar-large">
                                                        <div
                                                            className="progress-fill-large"
                                                            style={{
                                                                width: `${remaining * 100}%`,
                                                                background: remaining > 0.5
                                                                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                                                    : remaining > 0.2
                                                                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                                                        : 'linear-gradient(90deg, #ef4444, #f87171)'
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="progress-percent">{usagePercent.toFixed(0)}% usado</span>
                                                </div>

                                                {/* Métricas Secundárias */}
                                                <div className="secondary-metrics">
                                                    <div className="metric-chip">
                                                        <span className="metric-chip-value">{bobina.larguraCm}</span>
                                                        <span className="metric-chip-label">cm largura</span>
                                                    </div>
                                                    {bobina.fornecedor && (
                                                        <div className="metric-chip">
                                                            <span className="metric-chip-value">{bobina.fornecedor}</span>
                                                            <span className="metric-chip-label">fornecedor</span>
                                                        </div>
                                                    )}
                                                    {bobina.lote && (
                                                        <div className="metric-chip">
                                                            <span className="metric-chip-value">{bobina.lote}</span>
                                                            <span className="metric-chip-label">lote</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer com Ações */}
                                            <div className="estoque-card-footer">
                                                <button
                                                    className="action-btn qr"
                                                    onClick={() => handleShowQR('bobina', bobina)}
                                                >
                                                    <QrCodeIcon />
                                                    <span>QR Code</span>
                                                </button>
                                                <button
                                                    className="action-btn settings"
                                                    onClick={() => handleChangeStatus('bobina', bobina)}
                                                >
                                                    ⚙️
                                                    <span>Status</span>
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => handleDelete('bobina', bobina.id!)}
                                                >
                                                    <TrashIcon />
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
                                    <div key={retalho.id} className="estoque-card retalho">
                                        <div className="estoque-card-header">
                                            <h3>{retalho.filmId}</h3>
                                            <span
                                                className="status-badge"
                                                style={{ backgroundColor: getStatusColor(retalho.status) }}
                                            >
                                                {getStatusLabel(retalho.status)}
                                            </span>
                                        </div>
                                        <div className="estoque-card-body">
                                            <div className="info-grid">
                                                <div className="info-item">
                                                    <span className="label">Largura:</span>
                                                    <span className="value">{retalho.larguraCm} cm</span>
                                                </div>
                                                <div className="info-item">
                                                    <span className="label">Comprimento:</span>
                                                    <span className="value">{retalho.comprimentoCm} cm</span>
                                                </div>
                                                <div className="info-item highlight">
                                                    <span className="label">Área:</span>
                                                    <span className="value">{retalho.areaM2?.toFixed(2) || ((retalho.larguraCm * retalho.comprimentoCm) / 10000).toFixed(2)} m²</span>
                                                </div>
                                            </div>
                                            {retalho.localizacao && (
                                                <div className="info-extra">
                                                    <span>Local: {retalho.localizacao}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="estoque-card-footer">
                                            <button
                                                className="action-btn qr"
                                                onClick={() => handleShowQR('retalho', retalho)}
                                            >
                                                <QrCodeIcon />
                                                <span>QR Code</span>
                                            </button>
                                            <button
                                                className="action-btn settings"
                                                onClick={() => handleChangeStatus('retalho', retalho)}
                                            >
                                                ⚙️
                                                <span>Status</span>
                                            </button>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => handleDelete('retalho', retalho.id!)}
                                            >
                                                <TrashIcon />
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

            {/* Modal Adicionar */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Adicionar {activeTab === 'bobinas' ? 'Bobina' : 'Retalho'}</h2>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Película *</label>
                                <select
                                    value={formFilmId}
                                    onChange={e => setFormFilmId(e.target.value)}
                                    required
                                >
                                    <option value="">Selecione uma película</option>
                                    {films.map(film => (
                                        <option key={film.nome} value={film.nome}>{film.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Largura (cm) *</label>
                                    <input
                                        type="number"
                                        value={formLargura}
                                        onChange={e => setFormLargura(e.target.value)}
                                        placeholder="Ex: 152"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{activeTab === 'bobinas' ? 'Comprimento (m) *' : 'Comprimento (cm) *'}</label>
                                    <input
                                        type="number"
                                        value={formComprimento}
                                        onChange={e => setFormComprimento(e.target.value)}
                                        placeholder={activeTab === 'bobinas' ? 'Ex: 30' : 'Ex: 150'}
                                        required
                                    />
                                </div>
                            </div>

                            {activeTab === 'bobinas' ? (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Fornecedor</label>
                                            <input
                                                type="text"
                                                value={formFornecedor}
                                                onChange={e => setFormFornecedor(e.target.value)}
                                                placeholder="Ex: 3M, Solar Gard"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Lote</label>
                                            <input
                                                type="text"
                                                value={formLote}
                                                onChange={e => setFormLote(e.target.value)}
                                                placeholder="Ex: ABC123"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Custo Total (R$)</label>
                                        <input
                                            type="number"
                                            value={formCusto}
                                            onChange={e => setFormCusto(e.target.value)}
                                            placeholder="Ex: 1500.00"
                                            step="0.01"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Associar a uma bobina */}
                                    <div className="form-group">
                                        <label>Origem do Retalho</label>
                                        <select
                                            value={formBobinaId}
                                            onChange={e => {
                                                const val = e.target.value ? parseInt(e.target.value) : '';
                                                setFormBobinaId(val);
                                                // Auto-preencher película quando seleciona bobina
                                                if (val) {
                                                    const bobina = bobinas.find(b => b.id === val);
                                                    if (bobina) {
                                                        setFormFilmId(bobina.filmId);
                                                        setFormLargura(bobina.larguraCm.toString());
                                                    }
                                                }
                                            }}
                                        >
                                            <option value="">Retalho avulso (sem bobina)</option>
                                            {bobinas.filter(b => b.status === 'ativa').map(bobina => (
                                                <option key={bobina.id} value={bobina.id}>
                                                    {bobina.filmId} - {bobina.larguraCm}cm ({bobina.comprimentoRestanteM.toFixed(1)}m restantes)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Checkbox para deduzir da bobina */}
                                    {formBobinaId && (
                                        <div className="form-group checkbox-group">
                                            <label className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formDeduzirDaBobina}
                                                    onChange={e => setFormDeduzirDaBobina(e.target.checked)}
                                                />
                                                <span>Deduzir do estoque da bobina</span>
                                            </label>
                                            <span className="checkbox-hint">
                                                Ao marcar, o comprimento do retalho será descontado da bobina automaticamente
                                            </span>
                                        </div>
                                    )}


                                </>
                            )}

                            <div className="form-group">
                                <label>Localização</label>
                                <input
                                    type="text"
                                    value={formLocalizacao}
                                    onChange={e => setFormLocalizacao(e.target.value)}
                                    placeholder="Ex: Prateleira A, Gaveta 3"
                                />
                            </div>

                            <div className="form-group">
                                <label>Observação</label>
                                <textarea
                                    value={formObservacao}
                                    onChange={e => setFormObservacao(e.target.value)}
                                    placeholder="Observações adicionais..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={activeTab === 'bobinas' ? handleAddBobina : handleAddRetalho}
                            >
                                Salvar {activeTab === 'bobinas' ? 'Bobina' : 'Retalho'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal QR Code */}
            {showQRModal && (
                <div className="modal-overlay" onClick={() => setShowQRModal(null)}>
                    <div className="modal-content qr-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>QR Code - {showQRModal.type === 'bobina' ? 'Bobina' : 'Retalho'}</h2>
                            <button className="close-btn" onClick={() => setShowQRModal(null)}>×</button>
                        </div>
                        <div className="modal-body qr-body">
                            {qrCodeDataUrl && (
                                <img src={qrCodeDataUrl} alt="QR Code" className="qr-image" />
                            )}
                            <div className="qr-info">
                                <p className="qr-code-display">{showQRModal.item.codigoQr}</p>
                                <p className="qr-film">{showQRModal.item.filmId}</p>
                                <p className="qr-dimensions">
                                    {showQRModal.item.larguraCm}cm x {
                                        'comprimentoTotalM' in showQRModal.item
                                            ? `${showQRModal.item.comprimentoTotalM}m`
                                            : `${(showQRModal.item as Retalho).comprimentoCm}cm`
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowQRModal(null)}>
                                Fechar
                            </button>
                            <button className="btn-primary" onClick={handlePrintQR}>
                                Imprimir QR Code
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

            {/* Modal Alterar Status - Redesenhado */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(null)}>
                    <div className="modal-content status-modal-v2" onClick={e => e.stopPropagation()}>
                        {/* Header com ícone */}
                        <div className="status-modal-header">
                            <div className="status-modal-icon">
                                ⚙️
                            </div>
                            <h2>Alterar Status</h2>
                            <button className="close-btn-v2" onClick={() => setShowStatusModal(null)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Info do item */}
                        <div className="status-modal-item">
                            <span className="status-modal-item-name">{showStatusModal.item.filmId}</span>
                            <span
                                className="status-modal-current-badge"
                                style={{ backgroundColor: getStatusColor(showStatusModal.item.status) }}
                            >
                                {getStatusLabel(showStatusModal.item.status)}
                            </span>
                        </div>

                        {/* Opções de status */}
                        <div className="status-options-grid">
                            {getStatusOptions(showStatusModal.type).map(option => {
                                const isActive = showStatusModal.item.status === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        className={`status-option-card ${isActive ? 'active' : ''}`}
                                        onClick={() => handleConfirmStatusChange(option.value)}
                                        disabled={isActive}
                                        style={{
                                            '--status-color': option.color,
                                            '--status-color-light': `${option.color}20`
                                        } as React.CSSProperties}
                                    >
                                        <div className="status-option-indicator" style={{ background: option.color }} />
                                        <span className="status-option-label">{option.label}</span>
                                        {isActive && (
                                            <span className="status-option-check">✓</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="status-modal-footer">
                            <button className="btn-cancel-v2" onClick={() => setShowStatusModal(null)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
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

                .status-modal-header {
                    padding: 1.5rem 1.5rem 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    position: relative;
                }

                .status-modal-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 16px;
                    background: rgba(148, 163, 184, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                }

                .status-modal-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .close-btn-v2 {
                    position: absolute;
                    top: 1.5rem;
                    right: 1.5rem;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .close-btn-v2:hover {
                    background: rgba(148, 163, 184, 0.1);
                    color: var(--text-primary);
                }

                .status-modal-item {
                    padding: 0 1.5rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
                }

                .status-modal-item-name {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .status-modal-current-badge {
                    align-self: flex-start;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: white;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .status-options-grid {
                    padding: 1.5rem;
                    display: grid;
                    gap: 0.75rem;
                }

                .status-option-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 2px solid transparent;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .status-option-card:hover:not(:disabled) {
                    background: rgba(148, 163, 184, 0.1);
                    transform: translateY(-2px);
                }

                .status-option-card.active {
                    background: var(--status-color-light);
                    border-color: var(--status-color);
                }

                .status-option-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
                }

                .status-option-label {
                    flex: 1;
                    text-align: left;
                    font-weight: 600;
                    color: var(--text-primary);
                    font-size: 1rem;
                }

                .status-option-check {
                    color: var(--status-color);
                    font-weight: 800;
                    font-size: 1.25rem;
                }

                .status-modal-footer {
                    padding: 0 1.5rem 1.5rem;
                }

                .btn-cancel-v2 {
                    width: 100%;
                    padding: 1rem;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-weight: 600;
                    cursor: pointer;
                    border-radius: 12px;
                    transition: all 0.2s;
                }

                .btn-cancel-v2:hover {
                    background: rgba(148, 163, 184, 0.1);
                    color: var(--text-primary);
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
                }
            `}</style>
        </div>
    );
};

export default EstoqueView;
