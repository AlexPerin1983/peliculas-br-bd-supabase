import React, { useState, useEffect, useCallback } from 'react';
import { Bobina, Retalho, Film } from '../../types';
import {
    getAllBobinas,
    getAllRetalhos,
    getEstoqueStats,
    EstoqueStats
} from '../../services/estoqueDb';
import { getAllCustomFilms } from '../../services/db';
import { useEstoqueFilters } from '../../src/hooks/useEstoqueFilters';
import { useEstoqueOperations } from '../../src/hooks/useEstoqueOperations';
import { useEstoqueForm } from '../../src/hooks/useEstoqueForm';
import EstoqueStatsBar from './estoque/EstoqueStatsBar';
import EstoqueTopControls from './estoque/EstoqueTopControls';
import EstoqueBobinasPanel from './estoque/EstoqueBobinasPanel';
import EstoqueRetalhosPanel from './estoque/EstoqueRetalhosPanel';
import EstoqueAddModal from './estoque/EstoqueAddModal';
import EstoqueQrModal from './estoque/EstoqueQrModal';
import EstoqueDeleteConfirmModal from './estoque/EstoqueDeleteConfirmModal';
import EstoqueFilmFlow from './estoque/EstoqueFilmFlow';
import EstoqueStatusAndScannerFlow from './estoque/EstoqueStatusAndScannerFlow';
import EstoqueSkeleton from './estoque/EstoqueSkeleton';
import { QrCodeIcon } from './estoque/EstoqueIcons';

// Cache para persistir dados entre trocas de abas e evitar skeleton repetitivo
let estoqueCache: {
    bobinas: Bobina[];
    retalhos: Retalho[];
    stats: EstoqueStats | null;
} | null = null;

interface EstoqueViewProps {
    films: Film[];
    initialAction?: { action: 'scan', code: string } | null;
}

const EstoqueView: React.FC<EstoqueViewProps> = ({ films: initialFilms, initialAction }) => {
    const [activeTab, setActiveTab] = useState<'bobinas' | 'retalhos'>('bobinas');
    const [bobinas, setBobinas] = useState<Bobina[]>(estoqueCache?.bobinas || []);
    const [retalhos, setRetalhos] = useState<Retalho[]>(estoqueCache?.retalhos || []);
    const [stats, setStats] = useState<EstoqueStats | null>(estoqueCache?.stats || null);
    const [loading, setLoading] = useState(!estoqueCache);
    const [films, setFilms] = useState<Film[]>(initialFilms);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState<{ type: 'bobina' | 'retalho', item: Bobina | Retalho } | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [showFilmSelectionModal, setShowFilmSelectionModal] = useState(false);
    const [showFilmModal, setShowFilmModal] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [filmNameToAdd, setFilmNameToAdd] = useState<string>('');
    const { form, setters } = useEstoqueForm();

    // Estado para modal de status
    const [showStatusModal, setShowStatusModal] = useState<{ type: 'bobina' | 'retalho', item: Bobina | Retalho } | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'bobina' | 'retalho', id: number } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        viewMode,
        setViewMode,
        filteredBobinas,
        filteredRetalhos
    } = useEstoqueFilters(bobinas, retalhos);

    // Sincronizar films com props quando mudarem
    useEffect(() => {
        setFilms(initialFilms);
    }, [initialFilms]);

    const loadData = useCallback(async (isInitial = false) => {
        try {
            if (!isInitial) setLoading(true);

            // Se jÃ¡ temos filmes iniciais, nÃ£o precisamos buscar novamente no carregamento inicial
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

            // Atualizar cache
            estoqueCache = {
                bobinas: bobinasData,
                retalhos: retalhosData,
                stats: statsData
            };
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

    const {
        handleShowQR,
        handleSaveImage,
        handleSavePDF,
        handleAddBobina,
        handleAddRetalho,
        handleDelete,
        handleConfirmDelete,
        handleChangeStatus,
        handleConfirmStatusChange,
        getStatusOptions,
        getStatusColor,
        getStatusLabel,
    } = useEstoqueOperations({
        form,
        setters,
        showQRModal,
        setShowQRModal,
        setQrCodeDataUrl,
        setShowAddModal,
        showDeleteConfirm,
        setShowDeleteConfirm,
        showStatusModal,
        setShowStatusModal,
        setIsGenerating,
        loadData,
        qrCodeDataUrl,
    });

    if (loading) {
        return <EstoqueSkeleton />;
    }

    return (
        <div className="estoque-view">
            {stats && <EstoqueStatsBar stats={stats} />}

            <EstoqueTopControls
                activeTab={activeTab}
                bobinasCount={bobinas.length}
                retalhosCount={retalhos.length}
                onChangeTab={setActiveTab}
                onAdd={() => setShowAddModal(true)}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onScan={() => setShowScannerModal(true)}
            />
            {activeTab === 'bobinas' && (
                <EstoqueBobinasPanel
                    viewMode={viewMode}
                    filteredBobinas={filteredBobinas}
                    onShowQR={handleShowQR}
                    onChangeStatus={handleChangeStatus}
                    onDelete={handleDelete}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                />
            )}

            {activeTab === 'retalhos' && (
                <EstoqueRetalhosPanel
                    viewMode={viewMode}
                    filteredRetalhos={filteredRetalhos}
                    onShowQR={handleShowQR}
                    onChangeStatus={handleChangeStatus}
                    onDelete={handleDelete}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                />
            )}


            <EstoqueAddModal
                isOpen={showAddModal}
                activeTab={activeTab}
                onClose={() => setShowAddModal(false)}
                onOpenFilmSelection={() => setShowFilmSelectionModal(true)}
                onSubmit={activeTab === 'bobinas' ? handleAddBobina : handleAddRetalho}
                bobinas={bobinas}
                formFilmId={form.formFilmId}
                setFormFilmId={setters.setFormFilmId}
                formLargura={form.formLargura}
                setFormLargura={setters.setFormLargura}
                formComprimento={form.formComprimento}
                setFormComprimento={setters.setFormComprimento}
                formFornecedor={form.formFornecedor}
                setFormFornecedor={setters.setFormFornecedor}
                formLote={form.formLote}
                setFormLote={setters.setFormLote}
                formCusto={form.formCusto}
                setFormCusto={setters.setFormCusto}
                formLocalizacao={form.formLocalizacao}
                setFormLocalizacao={setters.setFormLocalizacao}
                formObservacao={form.formObservacao}
                setFormObservacao={setters.setFormObservacao}
                formBobinaId={form.formBobinaId}
                setFormBobinaId={setters.setFormBobinaId}
                formDeduzirDaBobina={form.formDeduzirDaBobina}
                setFormDeduzirDaBobina={setters.setFormDeduzirDaBobina}
            />

            <EstoqueQrModal
                showQRModal={showQRModal}
                qrCodeDataUrl={qrCodeDataUrl}
                isGenerating={isGenerating}
                onClose={() => setShowQRModal(null)}
                onSaveImage={handleSaveImage}
                onSavePDF={handleSavePDF}
            />

            <EstoqueFilmFlow
                films={films}
                showFilmSelectionModal={showFilmSelectionModal}
                setShowFilmSelectionModal={setShowFilmSelectionModal}
                showFilmModal={showFilmModal}
                setShowFilmModal={setShowFilmModal}
                editingFilm={editingFilm}
                setEditingFilm={setEditingFilm}
                filmNameToAdd={filmNameToAdd}
                setFilmNameToAdd={setFilmNameToAdd}
                setFormFilmId={setters.setFormFilmId}
                onReloadData={loadData}
            />

            <EstoqueStatusAndScannerFlow
                showScannerModal={showScannerModal}
                setShowScannerModal={setShowScannerModal}
                onDataUpdated={loadData}
                showStatusModal={showStatusModal}
                setShowStatusModal={setShowStatusModal}
                getStatusOptions={getStatusOptions}
                onStatusChange={handleConfirmStatusChange}
                onDelete={handleDelete}
                getStatusLabel={getStatusLabel}
                getStatusColor={getStatusColor}
            />

            <EstoqueDeleteConfirmModal
                showDeleteConfirm={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                onConfirm={handleConfirmDelete}
            />

            <style>{`
                .estoque-view {
                    padding: 1rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding-bottom: 80px;
                }

                /* Stats Bar - Layout Horizontal Moderno */
                .stats-bar {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(15, 23, 42, 0.04) 100%);
                    border: 1px solid rgba(191, 219, 254, 0.6);
                    border-radius: 18px;
                    margin-bottom: 1.25rem;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                }

                @media (min-width: 1024px) {
                    .stats-bar {
                        overflow-x: visible;
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    }
                }

                .stats-bar::-webkit-scrollbar {
                    display: none;
                }

                .stat-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%);
                    padding: 0.875rem 1rem;
                    border: 1px solid rgba(226, 232, 240, 0.9);
                    border-radius: 14px;
                    min-width: 140px;
                    flex: 1;
                    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .stat-pill:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
                }

                .stat-pill-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: rgba(148, 163, 184, 0.12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #475569;
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

                /* Header com Tabs e BotÃ£o */
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
                    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
                    color: white;
                    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24);
                }

                .segment.active .segment-count {
                    background: rgba(255,255,255,0.25);
                    color: white;
                }

                .segment:hover:not(.active) {
                    background: var(--bg-secondary);
                }

                /* BotÃ£o Principal Add */
                .btn-add-primary {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1.25rem;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
                }

                .btn-add-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.24);
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
                    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
                    border: none;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 14px 32px rgba(37, 99, 235, 0.28);
                    z-index: 100;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .fab-scan:hover {
                    transform: scale(1.08);
                    box-shadow: 0 18px 36px rgba(37, 99, 235, 0.34);
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
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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

                /* === Novo Design: Header em Linha Ãšnica === */
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

                /* LocalizaÃ§Ã£o como linha separada */
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

                /* MÃ©trica Principal */
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

                /* Chips de InformaÃ§Ãµes */
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

                /* === Footer com BotÃ£o PrimÃ¡rio === */
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

                /* Grid de MÃ©tricas Redesenhado */
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

                /* Hero Metric - MÃ©trica Principal em Destaque */
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

                /* MÃ©tricas SecundÃ¡rias em Chips */
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

                .empty-state-title {
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .empty-state svg {
                    width: 64px;
                    height: 64px;
                    margin-bottom: 1rem;
                    opacity: 0.5;
                }

                .empty-hint {
                    font-size: 0.9rem;
                    margin-top: 0.5rem;
                    max-width: 320px;
                    margin-left: auto;
                    margin-right: auto;
                    line-height: 1.55;
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
                    
                    /* FAB posiÃ§Ã£o ajustada */
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
                    
                    /* Legacy - grid de mÃ©tricas 2x2 */
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

                    /* LocalizaÃ§Ã£o mais compacta */
                    .card-location-row {
                        padding: 0.4rem 1rem;
                        font-size: 0.75rem;
                    }

                    /* Corpo mais compacto */
                    .card-body {
                        padding: 1rem;
                    }

                    /* MÃ©trica principal menor */
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

                    /* Footer e botÃ£o primÃ¡rio */
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



