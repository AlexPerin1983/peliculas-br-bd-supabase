import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SavedPDF, Client, Agendamento } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import PageCollectionToolbar from '../ui/PageCollectionToolbar';

interface PdfHistoryViewProps {
    pdfs: SavedPDF[];
    clients: Client[];
    agendamentos: Agendamento[];
    onDelete: (pdfId: number) => void;
    onDownload: (pdf: SavedPDF, filename: string) => void;
    onUpdateStatus: (pdfId: number, status: SavedPDF['status']) => void;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    onGenerateCombinedPdf: (pdfs: SavedPDF[]) => void;
    onNavigateToOption: (clientId: number, optionId: number) => void;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const PdfHistoryItem: React.FC<{
    pdf: SavedPDF;
    clientName: string;
    agendamento: Agendamento | undefined;
    onDownload: (pdf: SavedPDF, filename: string) => void;
    onDelete: (id: number) => void;
    onUpdateStatus: (id: number, status: SavedPDF['status']) => void;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    swipedItemId: number | null;
    onSetSwipedItem: (id: number | null) => void;
    isSelected: boolean;
    onToggleSelect: (id: number) => void;
    onNavigateToOption: (clientId: number, optionId: number) => void;
}> = React.memo(({ pdf, clientName, agendamento, onDownload, onDelete, onUpdateStatus, onSchedule, swipedItemId, onSetSwipedItem, isSelected, onToggleSelect, onNavigateToOption }) => {
    const [translateX, setTranslateX] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDraggingCard = useRef(false);
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const swipeableRef = useRef<HTMLDivElement>(null);
    const currentTranslateX = useRef(0);
    const ACTION_WIDTH_LEFT = 100;
    const ACTION_WIDTH_RIGHT = 100;

    useEffect(() => {
        if (swipedItemId !== pdf.id && swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
        }
    }, [swipedItemId, pdf.id]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (swipedItemId && swipedItemId !== pdf.id) {
            onSetSwipedItem(null);
        }
        isDraggingCard.current = true;
        gestureDirection.current = null;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingCard.current || !swipeableRef.current) return;
        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        if (gestureDirection.current === null) {
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                gestureDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }
        }

        if (gestureDirection.current === 'vertical') return;

        if (e.cancelable) e.preventDefault();

        const newTranslateX = currentTranslateX.current + deltaX;
        let finalTranslateX = newTranslateX;

        if (newTranslateX > ACTION_WIDTH_RIGHT) {
            const overflow = newTranslateX - ACTION_WIDTH_RIGHT;
            finalTranslateX = ACTION_WIDTH_RIGHT + Math.pow(overflow, 0.7);
        } else if (newTranslateX < -ACTION_WIDTH_LEFT) {
            const overflow = -newTranslateX - ACTION_WIDTH_LEFT;
            finalTranslateX = -ACTION_WIDTH_LEFT - Math.pow(overflow, 0.7);
        }
        swipeableRef.current.style.transform = `translateX(${finalTranslateX}px)`;
    };

    const handleTouchEnd = () => {
        if (!isDraggingCard.current || !swipeableRef.current) return;
        isDraggingCard.current = false;

        if (gestureDirection.current === 'vertical') {
            gestureDirection.current = null;
            return;
        }
        gestureDirection.current = null;

        const transformValue = swipeableRef.current.style.transform;
        const matrix = new DOMMatrix(transformValue);
        const currentX = matrix.m41;

        swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

        if (currentX > ACTION_WIDTH_RIGHT / 2) {
            swipeableRef.current.style.transform = `translateX(${ACTION_WIDTH_RIGHT}px)`;
            currentTranslateX.current = ACTION_WIDTH_RIGHT;
            setTranslateX(ACTION_WIDTH_RIGHT);
            onSetSwipedItem(pdf.id!);
        } else if (currentX < -ACTION_WIDTH_LEFT / 2) {
            swipeableRef.current.style.transform = `translateX(-${ACTION_WIDTH_LEFT}px)`;
            currentTranslateX.current = -ACTION_WIDTH_LEFT;
            setTranslateX(-ACTION_WIDTH_LEFT);
            onSetSwipedItem(pdf.id!);
        } else {
            swipeableRef.current.style.transform = `translateX(0px)`;
            currentTranslateX.current = 0;
            setTranslateX(0);
            if (swipedItemId === pdf.id) onSetSwipedItem(null);
        }
    };

    const handleActionClick = (status: SavedPDF['status']) => {
        onUpdateStatus(pdf.id!, status);
        if (swipeableRef.current) {
            swipeableRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            swipeableRef.current.style.transform = `translateX(0px)`;
        }
        currentTranslateX.current = 0;
        setTranslateX(0);
        onSetSwipedItem(null);
    };

    const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status = 'pending' }) => {
        const statusInfo = {
            approved: { text: 'Aprovado', classes: 'bg-green-100 text-green-800' },
            revised: { text: 'Revisar', classes: 'bg-yellow-100 text-yellow-800' },
            pending: { text: 'Pendente', classes: 'bg-slate-200 text-slate-800' }
        };
        const { text, classes } = statusInfo[status];
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes}`}>{text}</span>;
    };

    const expirationDate = pdf.expirationDate ? new Date(pdf.expirationDate) : null;
    const isExpired = expirationDate ? new Date(expirationDate.toDateString()) < new Date(new Date().toDateString()) : false;

    return (
        <div className="relative rounded-lg bg-slate-100 overflow-hidden">
            {/* Background Actions */}
            <div className="absolute inset-0 flex justify-between items-stretch">
                <button
                    onClick={() => handleActionClick('revised')}
                    className="bg-yellow-400 text-white flex-shrink-0 flex flex-col items-center justify-center transition-colors hover:bg-yellow-500 rounded-l-lg"
                    style={{ width: `${ACTION_WIDTH_RIGHT}px` }}
                >
                    <i className="fas fa-eye text-xl"></i>
                    <span className="text-xs mt-1 font-semibold">Revisar</span>
                </button>
                <button
                    onClick={() => handleActionClick('approved')}
                    className="bg-green-500 text-white flex-shrink-0 flex flex-col items-center justify-center transition-colors hover:bg-green-600 rounded-r-lg"
                    style={{ width: `${ACTION_WIDTH_LEFT}px` }}
                >
                    <i className="fas fa-check text-xl"></i>
                    <span className="text-xs mt-1 font-semibold">Aprovado</span>
                </button>
            </div>

            {/* Foreground Content */}
            <div
                ref={swipeableRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'pan-y' }}
                className="relative z-10 w-full"
            >
                {/* Status accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg z-20 ${
                    pdf.status === 'approved' ? 'bg-emerald-500' :
                    pdf.status === 'revised'  ? 'bg-amber-400' :
                                                'bg-slate-300 dark:bg-slate-600'
                }`} />

                <div className="relative z-10 w-full pl-4 pr-4 pt-3 pb-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-md">

                    {/* Row 1: checkbox + título + ações */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(pdf.id!)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 flex-shrink-0 text-slate-800 border-slate-300 rounded focus:ring-slate-500 cursor-pointer"
                            aria-label="Selecionar para PDF combinado"
                        />
                        <div className="flex-grow min-w-0">
                            {pdf.proposalOptionName && (
                                pdf.proposalOptionId ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNavigateToOption(pdf.clienteId, pdf.proposalOptionId); }}
                                        className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left w-full"
                                    >
                                        {pdf.proposalOptionName}
                                    </button>
                                ) : (
                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">
                                        {pdf.proposalOptionName}
                                    </p>
                                )
                            )}
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {new Date(pdf.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-0.5 text-slate-400 flex-shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDownload(pdf, pdf.nomeArquivo); }}
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white transition-colors text-sm"
                                aria-label="Baixar PDF"
                            >
                                <i className="fas fa-download"></i>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(pdf.id!); }}
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors text-sm"
                                aria-label="Excluir PDF"
                            >
                                <i className="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>

                    {/* Row 2: status + validade */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <StatusBadge status={pdf.status} />
                        {expirationDate && (
                            <span className={`text-xs ${isExpired ? 'text-red-500 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                                {isExpired ? <><i className="fas fa-exclamation-circle mr-1"/>Vencido</> : <>Vence {expirationDate.toLocaleDateString('pt-BR')}</>}
                            </span>
                        )}
                    </div>

                    {/* Row 3: filmes */}
                    {pdf.measurements && pdf.measurements.length > 0 && (() => {
                        const filmMap = new Map<string, number>();
                        pdf.measurements!.forEach(m => {
                            if (m.pelicula) {
                                const m2 = (parseFloat(String(m.largura).replace(',', '.')) * parseFloat(String(m.altura).replace(',', '.'))) * (m.quantidade || 1) / 10000;
                                filmMap.set(m.pelicula, (filmMap.get(m.pelicula) || 0) + m2);
                            }
                        });
                        if (filmMap.size === 0) return null;
                        return (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {Array.from(filmMap.entries()).map(([nome, m2]) => (
                                    <span key={nome} style={{ fontSize: '9px' }} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium leading-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                                        {nome} · {m2.toFixed(2).replace('.', ',')} m²
                                    </span>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Row 4: m² + agendamento + preço */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                {pdf.totalM2.toFixed(2).replace('.', ',')} m²
                            </span>
                            {agendamento ? (
                                <button onClick={() => onSchedule({ pdf, agendamento })} className="text-left">
                                    <div className="flex items-center text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                        <i className="fas fa-check-circle mr-1 text-[9px]"></i>
                                        {new Date(agendamento.start).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </button>
                            ) : (
                                <button
                                    onClick={() => onSchedule({ pdf })}
                                    className="text-xs px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all flex items-center gap-1"
                                >
                                    <i className="fas fa-calendar-plus text-[9px]"></i>
                                    Agendar
                                </button>
                            )}
                        </div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-base tabular-nums">
                            {formatNumberBR(pdf.totalPreco)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});


const PdfHistoryView: React.FC<PdfHistoryViewProps> = ({ pdfs, clients, agendamentos, onDelete, onDownload, onUpdateStatus, onSchedule, onGenerateCombinedPdf, onNavigateToOption }) => {
    const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
    const [expandedClientId, setExpandedClientId] = useState<number | null>(null);
    const [selectedPdfIds, setSelectedPdfIds] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);

    const clientsById = useMemo(() => {
        return new Map(clients.map(c => [c.id, c]));
    }, [clients]);

    const agendamentosByPdfId = useMemo(() => {
        return agendamentos.reduce((acc, ag) => {
            if (ag.pdfId) {
                acc[ag.pdfId] = ag;
            }
            return acc;
        }, {} as Record<number, Agendamento>);
    }, [agendamentos]);

    const groupedHistory = useMemo(() => {
        const groups = new Map<number, { client: Client, pdfs: SavedPDF[] }>();

        // 1. Sort PDFs by date descending
        const sortedPdfs = [...pdfs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 2. Group by client
        sortedPdfs.forEach(pdf => {
            const clientId = pdf.clienteId;
            const client = clientsById.get(clientId);

            if (!client) return;

            if (!groups.has(clientId)) {
                groups.set(clientId, { client, pdfs: [] });
            }

            groups.get(clientId)!.pdfs.push(pdf);
        });

        // 3. Convert Map values to array
        return Array.from(groups.values());
    }, [pdfs, clientsById]);

    const filteredGroupedHistory = useMemo(() => {
        let groups = groupedHistory;

        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase().trim();
            groups = groups.filter(group => {
                const clientMatch = group.client.nome.toLowerCase().includes(lowerTerm);
                const pdfMatch = group.pdfs.some(pdf =>
                    (pdf.proposalOptionName && pdf.proposalOptionName.toLowerCase().includes(lowerTerm)) ||
                    formatNumberBR(pdf.totalPreco).includes(lowerTerm) ||
                    new Date(pdf.date).toLocaleDateString('pt-BR').includes(lowerTerm)
                );
                return clientMatch || pdfMatch;
            });
        }
        return groups;
    }, [groupedHistory, searchTerm]);

    const displayedHistory = useMemo(() => {
        return filteredGroupedHistory.slice(0, visibleCount);
    }, [filteredGroupedHistory, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const handleToggleExpand = (clientId: number) => {
        setExpandedClientId(prev => prev === clientId ? null : clientId);
        setSwipedItemId(null); // Fecha qualquer item que esteja swiped ao expandir/recolher
    };

    const handleToggleSelect = (pdfId: number) => {
        setSelectedPdfIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pdfId)) {
                newSet.delete(pdfId);
            } else {
                // Se for o primeiro item selecionado, expande o grupo do cliente
                const pdf = pdfs.find(p => p.id === pdfId);
                if (pdf && newSet.size === 0) {
                    setExpandedClientId(pdf.clienteId);
                }
                newSet.add(pdfId);
            }
            return newSet;
        });
    };

    const handleGenerateCombined = () => {
        if (selectedPdfIds.size < 2) {
            alert("Selecione pelo menos dois orçamentos para gerar um PDF combinado.");
            return;
        }

        const selectedPdfs = pdfs.filter(p => selectedPdfIds.has(p.id!));

        // Verifica se todos os PDFs selecionados são do mesmo cliente
        const firstClientId = selectedPdfs[0].clienteId;
        const allSameClient = selectedPdfs.every(p => p.clienteId === firstClientId);

        if (!allSameClient) {
            alert("Apenas orçamentos do mesmo cliente podem ser combinados em um único PDF.");
            return;
        }

        onGenerateCombinedPdf(selectedPdfs);
        setSelectedPdfIds(new Set()); // Limpa a seleção após a ação
    };

    const ClientHistoryGroup: React.FC<{
        group: typeof groupedHistory[0];
    }> = React.memo(({ group }) => {
        const { client, pdfs } = group;
        const isExpanded = expandedClientId === client.id;

        // Verifica se há algum PDF selecionado neste grupo
        const hasSelectedInGroup = pdfs.some(p => selectedPdfIds.has(p.id!));

        // Calculate summary data for the header
        const totalPdfs = pdfs.length;
        const latestPdf = pdfs[0]; // Já ordenado pela data mais recente
        const approvedCount = pdfs.filter(p => p.status === 'approved').length;

        // Determine overall status for display
        let statusText = `${totalPdfs} Orçamento${totalPdfs > 1 ? 's' : ''}`;
        if (approvedCount > 0) {
            statusText = `${approvedCount} Aprovado${approvedCount > 1 ? 's' : ''}`;
        } else if (pdfs.some(p => p.status === 'revised')) {
            statusText = 'Revisão Pendente';
        } else {
            statusText = 'Aguardando Resposta';
        }

        return (
            <div className={`rounded-lg border shadow-md bg-white dark:bg-slate-800 overflow-hidden transition-all duration-300 ${hasSelectedInGroup ? 'border-slate-800 ring-1 ring-slate-800' : 'border-slate-200 dark:border-slate-700'}`}>
                {/* Header Row (Clickable) */}
                <button
                    onClick={() => handleToggleExpand(client.id!)}
                    className="w-full p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    aria-expanded={isExpanded}
                >
                    <div className="text-left flex-grow min-w-0 pr-4">
                        <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200 truncate">{client.nome}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{statusText}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Último Orçamento</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{formatNumberBR(latestPdf.totalPreco)}</p>
                        </div>
                        <i className={`fas fa-chevron-down text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </div>
                </button>

                {/* Expanded Content */}
                <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
                    <div className="p-4 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-700">
                        {pdfs.map(pdf => (
                            <PdfHistoryItem
                                key={pdf.id}
                                pdf={pdf}
                                clientName={client.nome}
                                agendamento={agendamentosByPdfId[pdf.id!]}
                                onDownload={onDownload}
                                onDelete={onDelete}
                                onUpdateStatus={onUpdateStatus}
                                onSchedule={onSchedule}
                                swipedItemId={swipedItemId}
                                onSetSwipedItem={setSwipedItemId}
                                isSelected={selectedPdfIds.has(pdf.id!)}
                                onToggleSelect={handleToggleSelect}
                                onNavigateToOption={onNavigateToOption}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    });


    return (
        <div className="space-y-6">
            <PageCollectionToolbar
                search={searchTerm}
                onSearchChange={(value) => {
                    setSearchTerm(value);
                    setVisibleCount(10);
                }}
                onClearSearch={() => {
                    setSearchTerm('');
                    setVisibleCount(10);
                }}
                searchPlaceholder="Buscar por cliente, proposta, data ou valor..."
            />
            {selectedPdfIds.size > 0 && (
                <div className="sticky top-16 sm:top-20 z-10 mb-4 p-3 bg-slate-800 rounded-lg shadow-xl flex justify-between items-center">
                    <p className="text-white text-sm font-semibold">
                        {selectedPdfIds.size} orçamento{selectedPdfIds.size > 1 ? 's' : ''} selecionado{selectedPdfIds.size > 1 ? 's' : ''}
                    </p>
                    <ActionButton
                        onClick={handleGenerateCombined}
                        disabled={selectedPdfIds.size < 2}
                        variant="secondary"
                        size="sm"
                        iconClassName="fas fa-file-pdf"
                    >
                        Gerar PDF Combinado
                    </ActionButton>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {displayedHistory.length > 0 ? (
                    <>
                        {displayedHistory.map(group => (
                            <ClientHistoryGroup key={group.client.id} group={group} />
                        ))}

                        {visibleCount < filteredGroupedHistory.length && (
                            <div className="pt-4 flex justify-center">
                                <ActionButton
                                    onClick={handleLoadMore}
                                    variant="secondary"
                                    iconClassName="fas fa-chevron-down"
                                >
                                    Carregar mais
                                </ActionButton>
                            </div>
                        )}
                    </>
                ) : (
                    searchTerm ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-search"
                            title="Nenhum resultado encontrado"
                            description="Tente buscar com outros termos."
                        />
                    ) : (
                        <ContentState
                            iconClassName="fas fa-history"
                            title="Nenhum PDF no histórico"
                            description="Quando um orçamento for gerado, ele aparecerá aqui."
                        />
                    ))}
            </div>
        </div>
    );
};

export default PdfHistoryView;

