import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    MessageCircle,
    Pause,
    Phone,
    Play,
    Power,
    QrCode,
    Sparkles,
    UserCheck,
    UserPlus,
    UserX
} from 'lucide-react';
import { Client } from '../../types';
import ActionButton from '../ui/ActionButton';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import {
    conectar as apiConectar,
    desconectar as apiDesconectar,
    getRecebidos,
    getStatus,
    soDigitos,
    WaRecebido,
    WaStatus
} from '../../src/lib/waConnector';

interface WhatsappConnectorViewProps {
    clients: Client[];
    onSaveClient: (data: { nome: string; telefone: string }) => Promise<void>;
    onMontarOrcamento?: (telefone: string, nomeContato: string) => Promise<void>;
    automacaoAtiva?: boolean;
    onToggleAutomacao?: () => void;
}

type FeedStatus = 'salvo' | 'ja_cliente' | 'sem_nome' | 'erro';

interface FeedItem extends WaRecebido {
    telefoneDigits: string;
    uiStatus: FeedStatus;
}

const SINCE_KEY = 'wa-connector-since-ts';
const POLL_MS = 3000;

function loadTs(key: string): number {
    try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}
function persistTs(key: string, ts: number): void {
    try { localStorage.setItem(key, String(ts)); } catch { /* ignore */ }
}

function formatPhone(digits: string): string {
    const d = digits.replace(/\D/g, '').replace(/^55/, '');
    if (d.length <= 2) return digits;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const STATUS_LABEL: Record<WaStatus, string> = {
    disconnected: 'Desconectado',
    connecting: 'Conectando...',
    qr: 'Aguardando leitura do QR',
    connected: 'Conectado',
    reconnecting: 'Reconectando...'
};

const WhatsappConnectorView: React.FC<WhatsappConnectorViewProps> = ({ clients, onSaveClient, onMontarOrcamento, automacaoAtiva = true, onToggleAutomacao }) => {
    const { showToast } = useFeedback();
    const [montandoFor, setMontandoFor] = useState<string | null>(null);

    const [serviceUp, setServiceUp] = useState<boolean | null>(null);
    const [status, setStatus] = useState<WaStatus>('disconnected');
    const [qr, setQr] = useState<string | null>(null);
    const [phone, setPhone] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [manualNames, setManualNames] = useState<Record<string, string>>({});

    const sinceRef = useRef<number>(loadTs(SINCE_KEY));
    const processedRef = useRef<Set<string>>(new Set());

    const clientPhoneSet = useMemo(
        () => new Set(clients.map(c => soDigitos(c.telefone)).filter(Boolean)),
        [clients]
    );

    const upsertFeed = useCallback((item: FeedItem) => {
        setFeed(prev => {
            const without = prev.filter(f => f.telefoneDigits !== item.telefoneDigits);
            return [item, ...without].slice(0, 100);
        });
    }, []);

    const handleRecebidos = useCallback(async (list: WaRecebido[]) => {
        for (const r of list) {
            const digits = soDigitos(r.telefone);
            if (!digits) continue;
            if (processedRef.current.has(digits)) continue;

            if (clientPhoneSet.has(digits)) {
                processedRef.current.add(digits);
                upsertFeed({ ...r, telefoneDigits: digits, uiStatus: 'ja_cliente' });
                continue;
            }

            if (r.nomeValido) {
                processedRef.current.add(digits);
                try {
                    await onSaveClient({ nome: r.nome.trim(), telefone: digits });
                    upsertFeed({ ...r, telefoneDigits: digits, uiStatus: 'salvo' });
                    showToast(`Cliente salvo: ${r.nome.trim()}`, { tone: 'success' });
                } catch {
                    processedRef.current.delete(digits);
                    upsertFeed({ ...r, telefoneDigits: digits, uiStatus: 'erro' });
                }
            } else {
                // Sem nome de perfil válido — fica pendente para decisão manual.
                upsertFeed({ ...r, telefoneDigits: digits, uiStatus: 'sem_nome' });
            }
        }
    }, [clientPhoneSet, onSaveClient, showToast, upsertFeed]);

    // Polling: status + recebidos (o gatilho por palavra-chave é tratado globalmente no App)
    useEffect(() => {
        let cancelled = false;

        const tick = async () => {
            try {
                const st = await getStatus();
                if (cancelled) return;
                setServiceUp(true);
                setStatus(st.status);
                setQr(st.qr);
                setPhone(st.phone);

                if (st.status === 'connected') {
                    const recebidos = await getRecebidos(sinceRef.current);
                    if (cancelled) return;
                    if (recebidos.length > 0) {
                        const maxTs = Math.max(...recebidos.map(i => i.ts));
                        sinceRef.current = Math.max(sinceRef.current, maxTs);
                        persistTs(SINCE_KEY, sinceRef.current);
                        // Automação pausada: consome (avança o since) mas NÃO salva contatos.
                        if (automacaoAtiva) {
                            await handleRecebidos(recebidos);
                        }
                    }
                }
            } catch {
                if (!cancelled) setServiceUp(false);
            }
        };

        tick();
        const id = setInterval(tick, POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [handleRecebidos, automacaoAtiva]);

    const handleConnect = useCallback(async () => {
        setConnecting(true);
        try {
            const r = await apiConectar();
            setStatus(r.status);
            setQr(r.qr);
        } catch {
            showToast('Não consegui falar com o conector. Ele está rodando? (iniciar-conector.bat)', { tone: 'danger' });
        } finally {
            setConnecting(false);
        }
    }, [showToast]);

    const handleDisconnect = useCallback(async () => {
        try {
            await apiDesconectar();
            setStatus('disconnected');
            setQr(null);
            setPhone(null);
        } catch {
            showToast('Falha ao desconectar.', { tone: 'danger' });
        }
    }, [showToast]);

    const handleManualSave = useCallback(async (item: FeedItem) => {
        const nome = (manualNames[item.telefoneDigits] || '').trim();
        if (nome.length < 2) {
            showToast('Digite um nome para salvar.', { tone: 'warning' });
            return;
        }
        try {
            await onSaveClient({ nome, telefone: item.telefoneDigits });
            processedRef.current.add(item.telefoneDigits);
            upsertFeed({ ...item, nome, uiStatus: 'salvo' });
            showToast(`Cliente salvo: ${nome}`, { tone: 'success' });
        } catch {
            showToast('Não consegui salvar esse cliente.', { tone: 'danger' });
        }
    }, [manualNames, onSaveClient, showToast, upsertFeed]);

    const handleMontar = useCallback(async (item: FeedItem) => {
        if (!onMontarOrcamento) return;
        setMontandoFor(item.telefoneDigits);
        try {
            await onMontarOrcamento(item.telefoneDigits, item.nome?.trim() || '');
        } finally {
            setMontandoFor(null);
        }
    }, [onMontarOrcamento]);

    const isConnected = status === 'connected';
    const savedCount = feed.filter(f => f.uiStatus === 'salvo').length;

    return (
        <div className="space-y-5 opacity-0 animate-fade-in">
            <header className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-[var(--text-strong)]">Conector de WhatsApp</h2>
                        <span className="rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                            Local / Beta
                        </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                        Conecte seu WhatsApp de atendimento. Quem te mandar mensagem é salvo como cliente automaticamente
                        (usando o nome do perfil). No próprio chat, digite <code className="rounded bg-[var(--surface-muted)] px-1">#orcar</code>{' '}
                        (ou "vou orçar aqui") para a IA montar o orçamento, e <code className="rounded bg-[var(--surface-muted)] px-1">segue orçamento</code>{' '}
                        para gerar o PDF e enviar pro cliente. Só funciona com o conector local aberto.
                    </p>
                </div>
            </header>

            {onToggleAutomacao && (
                <div
                    className={[
                        'flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border p-4',
                        automacaoAtiva
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10'
                            : 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10'
                    ].join(' ')}
                >
                    <div className="flex items-center gap-3">
                        <span
                            className={[
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                automacaoAtiva
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                            ].join(' ')}
                        >
                            {automacaoAtiva ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--text-strong)]">
                                {automacaoAtiva ? 'Automação ligada' : 'Automação pausada'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                                {automacaoAtiva
                                    ? 'Salvando contatos e executando #orcar e segue orçamento sozinho.'
                                    : 'Nada automático: não salva contatos nem executa comandos. A conexão continua.'}
                            </p>
                        </div>
                    </div>
                    <ActionButton
                        variant={automacaoAtiva ? 'danger' : 'primary'}
                        size="md"
                        onClick={onToggleAutomacao}
                        icon={automacaoAtiva ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                    >
                        {automacaoAtiva ? 'Parar automação' : 'Retomar automação'}
                    </ActionButton>
                </div>
            )}

            {serviceUp === false && (
                <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="font-semibold">Conector local não encontrado</p>
                        <p className="mt-1 leading-relaxed">
                            Abra o <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">iniciar-conector.bat</code> na
                            pasta <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">wa-connector</code> e deixe a janela aberta.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                {/* Painel de conexão */}
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between">
                        <p className="ui-kicker">Conexão</p>
                        <span
                            className={[
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                                isConnected
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                            ].join(' ')}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {STATUS_LABEL[status]}
                        </span>
                    </div>

                    <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center text-center">
                        {isConnected ? (
                            <>
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                                    <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                                </div>
                                <p className="mt-4 font-semibold text-[var(--text-strong)]">WhatsApp conectado</p>
                                {phone && (
                                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                                        <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {formatPhone(phone)}
                                    </p>
                                )}
                                <p className="mt-3 max-w-[240px] text-xs leading-relaxed text-[var(--text-soft)]">
                                    Deixe esta aba e o conector abertos para capturar os contatos.
                                </p>
                            </>
                        ) : qr ? (
                            <>
                                <img
                                    src={qr}
                                    alt="QR Code para conectar o WhatsApp"
                                    className="h-[240px] w-[240px] rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-white p-2"
                                />
                                <p className="mt-3 max-w-[240px] text-xs leading-relaxed text-[var(--text-soft)]">
                                    No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte para o QR.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                    {connecting || status === 'connecting' ? (
                                        <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <QrCode className="h-7 w-7" aria-hidden="true" />
                                    )}
                                </div>
                                <p className="mt-4 text-sm text-[var(--text-muted)]">
                                    {connecting || status === 'connecting'
                                        ? 'Gerando o QR Code...'
                                        : 'Clique para gerar o QR e conectar.'}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-4">
                        {isConnected ? (
                            <ActionButton
                                variant="secondary"
                                size="md"
                                className="w-full"
                                onClick={handleDisconnect}
                                icon={<Power className="h-4 w-4" aria-hidden="true" />}
                            >
                                Desconectar
                            </ActionButton>
                        ) : (
                            <ActionButton
                                variant="primary"
                                size="md"
                                className="w-full"
                                onClick={handleConnect}
                                loading={connecting}
                                loadingText="Conectando..."
                                disabled={serviceUp === false}
                                icon={<QrCode className="h-4 w-4" aria-hidden="true" />}
                            >
                                Conectar WhatsApp
                            </ActionButton>
                        )}
                    </div>
                </div>

                {/* Feed de recebidos */}
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between">
                        <p className="ui-kicker">Contatos recebidos</p>
                        {savedCount > 0 && (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                                {savedCount} salvo{savedCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {feed.length === 0 ? (
                        <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                <MessageCircle className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <p className="mt-4 text-sm font-semibold text-[var(--text-strong)]">Nenhuma mensagem ainda</p>
                            <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-[var(--text-soft)]">
                                {isConnected
                                    ? 'Quando alguém te mandar mensagem, o contato aparece aqui.'
                                    : 'Conecte o WhatsApp para começar a capturar.'}
                            </p>
                        </div>
                    ) : (
                        <ul className="mt-4 space-y-2.5">
                            {feed.map(item => (
                                <li
                                    key={item.telefoneDigits}
                                    className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
                                >
                                    <div className="flex items-start gap-3">
                                        <FeedBadge status={item.uiStatus} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                                                    {item.nome?.trim() || 'Sem nome'}
                                                </p>
                                                <span className="shrink-0 text-xs text-[var(--text-soft)]">
                                                    {formatPhone(item.telefoneDigits)}
                                                </span>
                                            </div>
                                            {item.texto && (
                                                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{item.texto}</p>
                                            )}

                                            {item.uiStatus === 'sem_nome' && (
                                                <div className="mt-2 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={manualNames[item.telefoneDigits] || ''}
                                                        onChange={e => setManualNames(prev => ({ ...prev, [item.telefoneDigits]: e.target.value }))}
                                                        placeholder="Digite o nome para salvar"
                                                        className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-body)] outline-none focus:border-[var(--brand-primary)]"
                                                    />
                                                    <ActionButton
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => handleManualSave(item)}
                                                        icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                                                    >
                                                        Salvar
                                                    </ActionButton>
                                                </div>
                                            )}

                                            {onMontarOrcamento && item.uiStatus !== 'sem_nome' && (
                                                <div className="mt-2">
                                                    <ActionButton
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleMontar(item)}
                                                        loading={montandoFor === item.telefoneDigits}
                                                        loadingText="Montando..."
                                                        disabled={montandoFor !== null}
                                                        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                                                    >
                                                        Montar orçamento da conversa
                                                    </ActionButton>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

const FeedBadge: React.FC<{ status: FeedStatus }> = ({ status }) => {
    const map: Record<FeedStatus, { icon: React.ReactNode; cls: string; title: string }> = {
        salvo: {
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
            cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
            title: 'Salvo como cliente'
        },
        ja_cliente: {
            icon: <UserCheck className="h-4 w-4" aria-hidden="true" />,
            cls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
            title: 'Já era cliente'
        },
        sem_nome: {
            icon: <UserX className="h-4 w-4" aria-hidden="true" />,
            cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
            title: 'Sem nome de perfil'
        },
        erro: {
            icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
            cls: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
            title: 'Erro ao salvar'
        }
    };
    const { icon, cls, title } = map[status];
    return (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`} title={title} aria-label={title}>
            {icon}
        </span>
    );
};

export default WhatsappConnectorView;
