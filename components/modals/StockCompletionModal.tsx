import React, { useEffect, useMemo, useState } from 'react';
import { Agendamento, Bobina, SavedPDF } from '../../types';
import {
    ServiceStockConsumptionInput,
    getAllBobinas,
} from '../../services/estoqueDb';
import {
    buildServiceStockPlans,
    calculateStockPlanForRoll,
    normalizeStockFilmName,
    StockFilmPlan,
} from '../../src/lib/serviceStockConsumption';
import Modal from '../ui/Modal';
import StockRollSelect from './StockRollSelect';

interface StockCompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    agendamento: Agendamento;
    linkedPdfs: SavedPDF[];
    onConfirm: (lines: ServiceStockConsumptionInput[]) => Promise<boolean>;
    onSkip: () => Promise<boolean>;
}

type SelectionState = Record<string, { bobinaId: string; meters: string }>;

const formatMeters = (value: number): string => (
    Number.isFinite(value)
        ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00'
);

const parseMeters = (value: string): number => {
    const raw = String(value || '').trim();
    const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildPlanKey = (plan: StockFilmPlan): string => plan.normalizedFilmName;

const buildSourceKeySuffix = (plan: StockFilmPlan): string => (
    encodeURIComponent(plan.normalizedFilmName) || 'material'
);

const getMatchingBobinas = (plan: StockFilmPlan, bobinas: Bobina[]): Bobina[] => (
    bobinas
        .filter((bobina) => (
            bobina.id
            && bobina.status === 'ativa'
            && bobina.comprimentoRestanteM > 0
            && normalizeStockFilmName(bobina.filmId) === plan.normalizedFilmName
        ))
        .sort((a, b) => a.comprimentoRestanteM - b.comprimentoRestanteM)
);

const StockCompletionModal: React.FC<StockCompletionModalProps> = ({
    isOpen,
    onClose,
    agendamento,
    linkedPdfs,
    onConfirm,
    onSkip,
}) => {
    const plans = useMemo(() => buildServiceStockPlans(linkedPdfs), [linkedPdfs]);
    const pendingPlans = useMemo(() => plans.filter((plan) => plan.pieces.length > 0), [plans]);
    const [bobinas, setBobinas] = useState<Bobina[]>([]);
    const [selections, setSelections] = useState<SelectionState>({});
    const [isLoading, setIsLoading] = useState(false);
    const [busyAction, setBusyAction] = useState<'confirm' | 'skip' | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        setIsLoading(true);
        setMessage('');
        setBusyAction(null);

        getAllBobinas()
            .then((loadedBobinas) => {
                if (!active) return;
                const activeBobinas = loadedBobinas.filter((bobina) => bobina.status === 'ativa');
                const initialSelections: SelectionState = {};

                pendingPlans.forEach((plan) => {
                    const matches = getMatchingBobinas(plan, activeBobinas);
                    const selected = matches.length === 1 ? matches[0] : undefined;
                    const calculation = selected
                        ? calculateStockPlanForRoll(plan, selected.larguraCm)
                        : plan.defaultCalculation;
                    initialSelections[buildPlanKey(plan)] = {
                        bobinaId: selected?.id ? String(selected.id) : '',
                        meters: formatMeters(calculation.totalLinearMeters),
                    };
                });

                setBobinas(activeBobinas);
                setSelections(initialSelections);
            })
            .catch((error) => {
                console.error('Erro ao carregar estoque para concluir atendimento:', error);
                if (active) {
                    setBobinas([]);
                    setSelections({});
                    setMessage('Não foi possível consultar o estoque. Você ainda pode concluir sem dar baixa agora.');
                }
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [isOpen, pendingPlans]);

    const updateBobina = (plan: StockFilmPlan, bobinaId: string) => {
        const bobina = bobinas.find((item) => item.id === Number(bobinaId));
        const calculation = bobina
            ? calculateStockPlanForRoll(plan, bobina.larguraCm)
            : plan.defaultCalculation;

        setSelections((current) => ({
            ...current,
            [buildPlanKey(plan)]: {
                bobinaId,
                meters: formatMeters(calculation.totalLinearMeters),
            },
        }));
        setMessage('');
    };

    const updateMeters = (plan: StockFilmPlan, meters: string) => {
        setSelections((current) => ({
            ...current,
            [buildPlanKey(plan)]: {
                bobinaId: current[buildPlanKey(plan)]?.bobinaId || '',
                meters,
            },
        }));
        setMessage('');
    };

    const getPlanValidation = (plan: StockFilmPlan): string | null => {
        const selection = selections[buildPlanKey(plan)];
        const bobina = bobinas.find((item) => item.id === Number(selection?.bobinaId));
        if (!bobina) return 'Selecione a bobina realmente utilizada.';

        const calculation = calculateStockPlanForRoll(plan, bobina.larguraCm);
        if (calculation.unplacedPieceCount > 0) {
            return `${calculation.unplacedPieceCount} peça(s) não cabem na largura desta bobina.`;
        }

        const meters = parseMeters(selection?.meters || '');
        if (meters <= 0) return 'Informe os metros efetivamente utilizados.';
        if (meters > bobina.comprimentoRestanteM + 0.0001) {
            return `Saldo insuficiente: esta bobina possui ${formatMeters(bobina.comprimentoRestanteM)} m.`;
        }

        return null;
    };

    const invalidPlanCount = pendingPlans.filter((plan) => getPlanValidation(plan)).length;
    const canConfirmStock = !isLoading && pendingPlans.length > 0 && invalidPlanCount === 0;
    const isBusy = busyAction !== null;

    const buildLines = (): ServiceStockConsumptionInput[] => pendingPlans.map((plan) => {
        const selection = selections[buildPlanKey(plan)];
        const bobina = bobinas.find((item) => item.id === Number(selection.bobinaId))!;
        const meters = parseMeters(selection.meters);

        return {
            bobinaId: bobina.id!,
            metrosConsumidos: meters,
            sourceKey: `agenda:${agendamento.id}:film:${buildSourceKeySuffix(plan)}`,
            filmId: plan.filmName,
            pdfId: plan.sourcePdfIds[0],
            larguraCorteCm: bobina.larguraCm,
            comprimentoCorteCm: meters * 100,
            areaM2: (bobina.larguraCm / 100) * meters,
            tipo: 'corte',
            observacao: `Baixa confirmada ao concluir o atendimento de ${agendamento.clienteNome}: ${plan.filmName}`,
        };
    });

    const handleConfirm = async () => {
        if (!canConfirmStock || isBusy) return;
        setBusyAction('confirm');
        setMessage('');
        try {
            const completed = await onConfirm(buildLines());
            if (completed) onClose();
            else setMessage('Não foi possível concluir. Confira os dados e tente novamente.');
        } catch (error) {
            console.error('Erro ao concluir atendimento com baixa de estoque:', error);
            setMessage('Não foi possível baixar o estoque. Nenhum material foi descontado; tente novamente.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleSkip = async () => {
        if (isBusy) return;
        setBusyAction('skip');
        setMessage('');
        try {
            const completed = await onSkip();
            if (completed) onClose();
            else setMessage('Não foi possível concluir o atendimento. Tente novamente.');
        } catch (error) {
            console.error('Erro ao concluir atendimento sem baixa de estoque:', error);
            setMessage('Não foi possível concluir o atendimento. Tente novamente.');
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            disableClose={isBusy}
            keyboardAwareFooter
            title={<span className="inline-flex items-center gap-2"><i className="fas fa-boxes-stacked text-blue-500" /> Concluir serviço</span>}
            footer={(
                <div className="grid w-full gap-2 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={isBusy}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-body)] disabled:opacity-50"
                    >
                        <i className={`fas ${busyAction === 'skip' ? 'fa-spinner fa-spin' : 'fa-clock'}`} />
                        Concluir sem baixar agora
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isBusy || !canConfirmStock}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <i className={`fas ${busyAction === 'confirm' ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                        Concluir e baixar estoque
                    </button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="rounded-[var(--radius-card)] border border-blue-200 bg-blue-50 p-4 text-sm leading-5 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200">
                    <p className="font-black">Confira o material realmente utilizado</p>
                    <p className="mt-1 text-xs opacity-80">Preenchemos a estimativa usando as medidas dos orçamentos. Você pode ajustar antes da baixa.</p>
                </div>

                {isLoading ? (
                    <div className="flex min-h-32 items-center justify-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
                        <i className="fas fa-spinner fa-spin" /> Consultando bobinas...
                    </div>
                ) : plans.length === 0 ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] p-5 text-center">
                        <p className="font-bold text-[var(--text-strong)]">Nenhum material calculado</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">O atendimento pode ser concluído normalmente sem baixa de estoque.</p>
                    </div>
                ) : (
                    plans.map((plan) => {
                        const matches = getMatchingBobinas(plan, bobinas);
                        const selection = selections[buildPlanKey(plan)];
                        const selectedBobina = bobinas.find((item) => item.id === Number(selection?.bobinaId));
                        const calculation = selectedBobina
                            ? calculateStockPlanForRoll(plan, selectedBobina.larguraCm)
                            : plan.defaultCalculation;
                        const validation = plan.pieces.length > 0 ? getPlanValidation(plan) : null;

                        return (
                            <section key={buildPlanKey(plan)} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-hairline)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-black text-[var(--text-strong)]">{plan.filmName}</p>
                                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                            {plan.pieces.length} peça(s) · {formatMeters(calculation.totalLinearMeters)} m previstos
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {plan.sourcePdfIds.length} orçamento(s)
                                    </span>
                                </div>

                                {plan.alreadyConsumedPieces > 0 ? (
                                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        <i className="fas fa-circle-check" />
                                        {plan.alreadyConsumedPieces} peça(s) em retalho já baixada(s); não serão descontadas novamente.
                                    </p>
                                ) : null}

                                {plan.pieces.length > 0 ? (
                                    <div className="mt-3 grid gap-3">
                                        <StockRollSelect
                                            label="Bobina utilizada"
                                            ariaLabel={`Bobina utilizada para ${plan.filmName}`}
                                            options={matches}
                                            value={selection?.bobinaId || ''}
                                            onChange={(bobinaId) => updateBobina(plan, bobinaId)}
                                            placeholder={matches.length ? 'Selecione a bobina' : 'Nenhuma bobina compatível'}
                                            disabled={matches.length === 0}
                                        />
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-bold text-[var(--text-strong)]">Metros realmente usados</span>
                                            <input
                                                aria-label={`Metros usados em ${plan.filmName}`}
                                                type="text"
                                                inputMode="decimal"
                                                value={selection?.meters || ''}
                                                onChange={(event) => updateMeters(plan, event.target.value)}
                                                className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-strong)] outline-none focus:border-blue-500"
                                            />
                                        </label>
                                        {validation ? <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{validation}</p> : null}
                                    </div>
                                ) : null}
                            </section>
                        );
                    })
                )}

                {message ? <p role="status" className="text-center text-xs font-semibold text-[var(--text-muted)]">{message}</p> : null}
            </div>
        </Modal>
    );
};

export default StockCompletionModal;
