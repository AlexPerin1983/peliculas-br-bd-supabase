import React, { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, CreditCard, FileText, Tag, UsersRound } from 'lucide-react';
import { Client, SavedPDF, StandaloneExpense } from '../../types';
import { PROPOSAL_EXPENSE_CATEGORY_OPTIONS, normalizeCurrencyInput, parseCurrencyInput } from '../../src/lib/proposalExpenses';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';

interface StandaloneExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: StandaloneExpense) => Promise<void> | void;
    clients: Client[];
    pdfs: SavedPDF[];
    isSaving?: boolean;
}

const paymentMethods = ['Pix', 'Cartao', 'Dinheiro', 'Boleto', 'Transferencia', 'Outro'];
type PickerKey = 'category' | 'payment' | 'client' | 'proposal';

interface PickerOption {
    value: string;
    label: string;
    helper?: string;
}

const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const dateInputToIso = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return new Date().toISOString();
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
};

const PickerField: React.FC<{
    id: PickerKey;
    label: string;
    icon: React.ReactNode;
    value: string;
    options: PickerOption[];
    openPicker: PickerKey | null;
    onToggle: (id: PickerKey) => void;
    onChange: (value: string) => void;
    placeholder?: string;
}> = ({
    id,
    label,
    icon,
    value,
    options,
    openPicker,
    onToggle,
    onChange,
    placeholder = 'Selecionar'
}) => {
    const selectedOption = options.find(option => option.value === value);
    const isOpen = openPicker === id;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ left: number; top: number; width: number } | null>(null);

    const updateCoords = () => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setCoords({ left: rect.left, top: rect.bottom + 6, width: rect.width });
    };

    useLayoutEffect(() => {
        if (isOpen) updateCoords();
    }, [isOpen]);

    // Reposiciona ao rolar/redimensionar e fecha ao clicar fora (menu vive num portal).
    useEffect(() => {
        if (!isOpen) return;
        const onReposition = () => updateCoords();
        const onOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            onToggle(id);
        };
        window.addEventListener('scroll', onReposition, true);
        window.addEventListener('resize', onReposition);
        document.addEventListener('mousedown', onOutside);
        return () => {
            window.removeEventListener('scroll', onReposition, true);
            window.removeEventListener('resize', onReposition);
            document.removeEventListener('mousedown', onOutside);
        };
    }, [isOpen, id, onToggle]);

    return (
        <div className="relative">
            <span className="ui-label mb-1 flex items-center gap-1.5">
                {icon}
                {label}
            </span>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => onToggle(id)}
                className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-left text-sm font-semibold text-[var(--text-strong)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)]"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span className="min-w-0 truncate">{selectedOption?.label || placeholder}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isOpen && coords && createPortal(
                <div
                    ref={menuRef}
                    role="listbox"
                    data-modal-companion=""
                    // pointerEvents: o Radix (vaul modal) zera pointer-events do body;
                    // sem o auto explícito o toque atravessa o menu e a opção nunca é aplicada.
                    style={{ position: 'fixed', left: coords.left, top: coords.top, width: coords.width, pointerEvents: 'auto' }}
                    className="z-[10050] max-h-60 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-1 shadow-[var(--shadow-elevated)] ring-1 ring-black/5 dark:ring-white/10"
                >
                    {options.map(option => {
                        const isSelected = option.value === value;

                        return (
                            <button
                                key={option.value || 'empty-option'}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => onChange(option.value)}
                                className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-[7px] px-3 py-2 text-left transition-colors ${isSelected ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'}`}
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold">{option.label}</span>
                                    {option.helper && (
                                        <span className={`mt-0.5 block truncate text-xs ${isSelected ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                            {option.helper}
                                        </span>
                                    )}
                                </span>
                                {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

const StandaloneExpenseModal: React.FC<StandaloneExpenseModalProps> = ({
    isOpen,
    onClose,
    onSave,
    clients,
    pdfs,
    isSaving = false
}) => {
    const [date, setDate] = useState(toDateInputValue(new Date()));
    const [category, setCategory] = useState<StandaloneExpense['category']>('other');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Pix');
    const [clientId, setClientId] = useState('');
    const [proposalId, setProposalId] = useState('');
    const [error, setError] = useState('');
    const [openPicker, setOpenPicker] = useState<PickerKey | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setDate(toDateInputValue(new Date()));
        setCategory('other');
        setAmount('');
        setDescription('');
        setPaymentMethod('Pix');
        setClientId('');
        setProposalId('');
        setError('');
        setOpenPicker(null);
    }, [isOpen]);

    const proposalOptions = useMemo(() => {
        const selectedClientId = Number(clientId);
        return pdfs
            .filter(pdf => !selectedClientId || pdf.clienteId === selectedClientId)
            .slice()
            .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    }, [clientId, pdfs]);

    const selectedCategoryLabel = PROPOSAL_EXPENSE_CATEGORY_OPTIONS.find(option => option.category === category)?.label || 'Despesa';
    const amountValue = parseCurrencyInput(amount);
    const categoryOptions = PROPOSAL_EXPENSE_CATEGORY_OPTIONS.map(option => ({
        value: option.category,
        label: option.label
    }));
    const paymentOptions = paymentMethods.map(method => ({
        value: method,
        label: method
    }));
    const clientOptions = [
        { value: '', label: 'Sem cliente', helper: 'Despesa geral da empresa' },
        ...clients
            .filter(client => client.id)
            .map(client => ({
                value: String(client.id),
                label: client.nome,
                helper: client.telefone || client.email || undefined
            }))
    ];
    const proposalPickerOptions = [
        { value: '', label: 'Sem proposta', helper: 'Nao vincular a orcamento' },
        ...proposalOptions
            .filter(pdf => pdf.id)
            .map(pdf => ({
                value: String(pdf.id),
                label: pdf.proposalOptionName || 'Orcamento',
                helper: pdf.clientName || clients.find(client => client.id === pdf.clienteId)?.nome || 'Cliente'
            }))
    ];

    const handleTogglePicker = (picker: PickerKey) => {
        setOpenPicker(current => current === picker ? null : picker);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');

        if (amountValue <= 0) {
            setError('Informe um valor maior que zero.');
            return;
        }

        const nextExpense: StandaloneExpense = {
            date: dateInputToIso(date),
            category,
            amount: amountValue,
            description: description.trim() || selectedCategoryLabel,
            paymentMethod,
            clientId: clientId ? Number(clientId) : null,
            proposalId: proposalId ? Number(proposalId) : null
        };

        await onSave(nextExpense);
    };

    const footer = (
        <>
            <ActionButton type="submit" form="standaloneExpenseForm" variant="primary" size="sm" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar despesa'}
            </ActionButton>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nova despesa"
            footer={footer}
            disableClose={isSaving}
            fullScreenOnMobile
        >
            <form id="standaloneExpenseForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="ui-label mb-1 flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            Data
                        </span>
                        <input
                            type="date"
                            value={date}
                            onChange={event => setDate(event.target.value)}
                            className="ui-field h-11 w-full px-3 text-sm"
                        />
                    </label>

                    <PickerField
                        id="category"
                        label="Categoria"
                        icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}
                        value={category}
                        options={categoryOptions}
                        openPicker={openPicker}
                        onToggle={handleTogglePicker}
                        onChange={value => {
                            setCategory(value as StandaloneExpense['category']);
                            setOpenPicker(null);
                        }}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="ui-label mb-1 flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                            Valor
                        </span>
                        <input
                            value={amount}
                            onChange={event => setAmount(normalizeCurrencyInput(event.target.value))}
                            className="ui-field h-11 w-full px-3 text-sm"
                            inputMode="decimal"
                            placeholder="0,00"
                        />
                    </label>

                    <PickerField
                        id="payment"
                        label="Pagamento"
                        icon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}
                        value={paymentMethod}
                        options={paymentOptions}
                        openPicker={openPicker}
                        onToggle={handleTogglePicker}
                        onChange={value => {
                            setPaymentMethod(value);
                            setOpenPicker(null);
                        }}
                    />
                </div>

                <label className="block">
                    <span className="ui-label mb-1 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Descricao
                    </span>
                    <textarea
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        className="ui-field min-h-[82px] w-full resize-y px-3 py-2 text-sm"
                        placeholder="Ex: mensalidade de trafego pago, ferramenta, combustivel..."
                    />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                    <PickerField
                        id="client"
                        label="Cliente opcional"
                        icon={<UsersRound className="h-3.5 w-3.5" aria-hidden="true" />}
                        value={clientId}
                        options={clientOptions}
                        openPicker={openPicker}
                        onToggle={handleTogglePicker}
                        onChange={value => {
                            setClientId(value);
                            setProposalId('');
                            setOpenPicker(null);
                        }}
                    />

                    <PickerField
                        id="proposal"
                        label="Proposta opcional"
                        icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                        value={proposalId}
                        options={proposalPickerOptions}
                        openPicker={openPicker}
                        onToggle={handleTogglePicker}
                        onChange={value => {
                            setProposalId(value);
                            setOpenPicker(null);
                        }}
                    />
                </div>

                {error && (
                    <p className="rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
};

export default StandaloneExpenseModal;
