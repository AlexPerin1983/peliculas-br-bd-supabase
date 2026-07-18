import React from 'react';
import { Drawer } from 'vaul';
import { QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { Bobina, Retalho } from '../../../types';

export type EstoqueSelectedItem = { type: 'bobina'; item: Bobina } | { type: 'retalho'; item: Retalho };

type EstoqueItemSheetProps = {
    selected: EstoqueSelectedItem | null;
    onClose: () => void;
    onShowQR: (selected: EstoqueSelectedItem) => void;
    onChangeStatus: (selected: EstoqueSelectedItem) => void;
    onDelete: (selected: EstoqueSelectedItem) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

const EstoqueItemSheet: React.FC<EstoqueItemSheetProps> = ({ selected, onClose, onShowQR, onChangeStatus, onDelete, getStatusLabel, getStatusColor }) => {
    if (!selected) return null;
    const { item, type } = selected;
    const isBobina = type === 'bobina';
    const bobina = isBobina ? item as Bobina : null;
    const retalho = !isBobina ? item as Retalho : null;
    const run = (action: (value: EstoqueSelectedItem) => void) => {
        const current = selected;
        onClose();
        action(current);
    };

    return (
        <Drawer.Root open onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-[2px]" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[24px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none sm:hidden">
                    <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
                    <div className="px-4 pb-4 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Drawer.Title className="truncate text-[1.05rem] font-semibold text-[var(--text-strong)]">{item.filmId}</Drawer.Title>
                                <Drawer.Description className="mt-1 text-[11px] text-[var(--text-muted)]">{isBobina ? 'Bobina' : 'Retalho'} #{item.id}</Drawer.Description>
                            </div>
                            <span className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                            {isBobina ? <>
                                <div><p className="text-[9px] uppercase text-[var(--text-muted)]">Restante</p><p className="mt-1 text-[18px] font-semibold text-[var(--text-strong)]">{bobina!.comprimentoRestanteM.toFixed(1)}m</p></div>
                                <div><p className="text-[9px] uppercase text-[var(--text-muted)]">Largura</p><p className="mt-1 text-[18px] font-semibold text-[var(--text-strong)]">{bobina!.larguraCm}cm</p></div>
                                <p className="col-span-2 text-[11px] text-[var(--text-muted)]">{bobina!.comprimentoTotalM}m total{bobina!.lote ? ` · Lote ${bobina!.lote}` : ''}{bobina!.localizacao ? ` · ${bobina!.localizacao}` : ''}</p>
                            </> : <>
                                <div><p className="text-[9px] uppercase text-[var(--text-muted)]">Largura</p><p className="mt-1 text-[18px] font-semibold text-[var(--text-strong)]">{retalho!.larguraCm}cm</p></div>
                                <div><p className="text-[9px] uppercase text-[var(--text-muted)]">Comprimento</p><p className="mt-1 text-[18px] font-semibold text-[var(--text-strong)]">{retalho!.comprimentoCm}cm</p></div>
                                {retalho!.localizacao ? <p className="col-span-2 text-[11px] text-[var(--text-muted)]">{retalho!.localizacao}</p> : null}
                            </>}
                        </div>

                        <div className="mt-4 space-y-2">
                            <button type="button" onClick={() => run(onShowQR)} className="flex h-12 w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 text-[13px] font-semibold text-[var(--text-strong)]"><QrCode className="h-5 w-5 text-[var(--brand-primary)]" /> Ver QR Code</button>
                            <button type="button" onClick={() => run(onChangeStatus)} className="flex h-12 w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 text-[13px] font-semibold text-[var(--text-strong)]"><RefreshCw className="h-5 w-5 text-[var(--brand-primary)]" /> Alterar status</button>
                            <button type="button" onClick={() => run(onDelete)} className="flex h-12 w-full items-center gap-3 rounded-[var(--radius-control)] border border-rose-500/25 px-4 text-[13px] font-semibold text-rose-500"><Trash2 className="h-5 w-5" /> Excluir material</button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default EstoqueItemSheet;
