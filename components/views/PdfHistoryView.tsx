import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SavedPDF, Client, Agendamento } from '../../types';

interface PdfHistoryViewProps {
    pdfs: SavedPDF[];
    clients: Client[];
    agendamentos: Agendamento[];
    onDelete: (pdfId: number) => void;
    onDownload: (blob: Blob, filename: string) => void;
    onUpdateStatus: (pdfId: number, status: SavedPDF['status']) => void;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
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
    onDownload: (blob: Blob, filename: string) => void;
    onDelete: (id: number) => void;
    onUpdateStatus: (id: number, status: SavedPDF['status']) => void;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    swipedItemId: number | null;
    onSetSwipedItem: (id: number | null) => void;
}> = React.memo(({ pdf, clientName, agendamento, onDownload, onDelete, onUpdateStatus, onSchedule, swipedItemId, onSetSwipedItem }) => {
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
                <div className="relative z-10 w-full p-4 bg-white rounded-lg border border-slate-200/80 shadow-md">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-grow min-w-0">
                            {/* Removed clientName here, as it's now displayed in the group header */}
                            {pdf.proposalOptionName && (
                                <p className="font-bold text-slate-900 text-lg truncate">
                                    {pdf.proposalOptionName}
                                </p>
                            )}
                            <p className="text-sm text-slate-500 mt-0.5">
                                {new Date(pdf.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-500 flex-shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDownload(pdf.pdfBlob, pdf.nomeArquivo); }}
                                className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                aria-label="Baixar PDF"
                            >
                                <i className="fas fa-download"></i>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(pdf.id!); }}
                                className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
                                aria-label="Excluir PDF"
                            >
                                <i className="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <StatusBadge status={pdf.status} />
                        {expirationDate && (
                            <div className={`flex items-center text-sm ${isExpired ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                                <i className="far fa-calendar-alt mr-2 text-slate-400"></i>
                                <span>Vence em: {expirationDate.toLocaleDateString('pt-BR')}</span>
                            </div>
                        )}
                    </div>

                    
                    <div className="flex items-end justify-between mt-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-col">
                            <p className="text-slate-600 font-medium">
                               {pdf.totalM2.toFixed(2).replace('.',',')} m²
                            </p>
                            {agendamento ? (
                                 <button onClick={() => onSchedule({ pdf, agendamento })} className="mt-2 text-left">
                                     <div className="flex items-center text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
                                         <i className="fas fa-check-circle mr-2"></i>
                                         <span>{new Date(agendamento.start).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                     </div>
                                 </button>
                             ) : (
                                 <button 
                                     onClick={() => onSchedule({ pdf })}
                                     className="mt-2 px-3 py-1.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors text-sm flex items-center gap-2"
                                 >
                                     <i className="fas fa-calendar-plus"></i>
                                     Agendar
                                 </button>
                             )}
                        </div>
                        <p className="font-bold text-slate-900 text-lg">
                            {formatNumberBR(pdf.totalPreco)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});


const PdfHistoryView: React.FC<PdfHistoryViewProps> = ({ pdfs, clients, agendamentos, onDelete, onDownload, onUpdateStatus, onSchedule }) => {
    const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
    const [expandedClientId, setExpandedClientId] = useState<number | null>(null); 

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
    
    const handleToggleExpand = (clientId: number) => {
        setExpandedClientId(prev => prev === clientId ? null : clientId);
        setSwipedItemId(null); // Fecha qualquer item que esteja swiped ao expandir/recolher
    };

    const ClientHistoryGroup: React.FC<{
        group: typeof groupedHistory[0];
    }> = React.memo(({ group }) => {
        const { client, pdfs } = group;
        const isExpanded = expandedClientId === client.id;

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
            <div className="rounded-lg border border-slate-200 shadow-md bg-white overflow-hidden">
                {/* Header Row (Clickable) */}
                <button
                    onClick={() => handleToggleExpand(client.id!)}
                    className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
                    aria-expanded={isExpanded}
                >
                    <div className="text-left flex-grow min-w-0 pr-4">
                        <h3 className="font-bold text-xl text-slate-800 truncate">{client.nome}</h3>
                        <p className="text-sm text-slate-500 mt-1">{statusText}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500">Último Orçamento</p>
                            <p className="font-bold text-slate-800">{formatNumberBR(latestPdf.totalPreco)}</p>
                        </div>
                        <i className={`fas fa-chevron-down text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </div>
                </button>

                {/* Expanded Content */}
                <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
                    <div className="p-4 pt-0 space-y-3 border-t border-slate-100">
                        {pdfs.map(pdf => (
                            <PdfHistoryItem
                                key={pdf.id}
                                pdf={pdf}
                                clientName={client.nome} // Mantido para compatibilidade, mas não é mais exibido no item
                                agendamento={agendamentosByPdfId[pdf.id!]}
                                onDownload={onDownload}
                                onDelete={onDelete}
                                onUpdateStatus={onUpdateStatus}
                                onSchedule={onSchedule}
                                swipedItemId={swipedItemId}
                                onSetSwipedItem={setSwipedItemId}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    });


    return (
        <div>
            <div className="space-y-4">
                {groupedHistory.length > 0 ? (
                    groupedHistory.map(group => (
                        <ClientHistoryGroup key={group.client.id} group={group} />
                    ))
                ) : (
                    <div className="text-center text-slate-500 p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-white/50 rounded-lg border-2 border-dashed border-slate-200">
                        <i className="fas fa-history fa-3x mb-4 text-slate-300"></i>
                        <h3 className="text-xl font-semibold text-slate-700">Nenhum PDF no Histórico</h3>
                        <p className="mt-1">Quando um orçamento for gerado, ele aparecerá aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfHistoryView;