import React, { useState, useEffect, FormEvent } from 'react';
import {
    Sparkles,
    KeyRound,
    ShieldCheck,
    ArrowRight,
    ArrowLeft,
    ExternalLink,
    Check,
    FileText,
    UserPlus,
    Ruler,
    Layers,
    LineChart,
    Lock,
    Gift,
} from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => Promise<void>;
    currentApiKey?: string;
    provider?: 'gemini';
}

// Suporte PelículasBR (DDD 83). wa.me exige o código do país (55).
const SUPPORT_PHONE = '5583996476052';
const HELP_MESSAGE = encodeURIComponent(
    'Olá! Preciso de ajuda para configurar a chave de Inteligência Artificial no PelículasBR.'
);
const GEMINI_URL = 'https://aistudio.google.com/app/apikey';

const STEPS = ['Sobre a IA', 'Gerar a chave', 'Ativar'] as const;

// O que a IA realmente faz no app — espelha as funções existentes.
const AI_FEATURES = [
    { icon: FileText, title: 'Propostas em segundos', desc: 'Gera orçamentos completos a partir de uma descrição.' },
    { icon: UserPlus, title: 'Cadastro de clientes', desc: 'Cria a ficha do cliente a partir de um texto colado.' },
    { icon: Ruler, title: 'Leitura de medidas', desc: 'Interpreta medidas e preenche os ambientes sozinha.' },
    { icon: Layers, title: 'Cadastro de películas', desc: 'Completa as especificações técnicas automaticamente.' },
    { icon: LineChart, title: 'Assistente financeiro', desc: 'Analisa seus números e responde perguntas do dia a dia.' },
] as const;

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
    const [step, setStep] = useState(currentApiKey ? 2 : 0);
    const [apiKey, setApiKey] = useState(currentApiKey || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setStep(currentApiKey ? 2 : 0);
            setApiKey(currentApiKey || '');
            setIsSaving(false);
            setSaveError(null);
        }
    }, [isOpen, currentApiKey]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving || !apiKey.trim()) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(apiKey.trim());
        } catch (err: any) {
            setSaveError(err?.message || 'Não conseguimos validar a chave. Confira se copiou ela inteira e tente de novo.');
            setIsSaving(false);
        }
    };

    const helpLink = (
        <a
            href={`https://wa.me/${SUPPORT_PHONE}?text=${HELP_MESSAGE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-soft)] transition-colors hover:text-[#25D366]"
        >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar com o suporte
        </a>
    );

    const footer = (
        <div className="flex w-full items-center justify-between gap-3">
            {helpLink}
            <div className="flex items-center gap-2">
                {step === 0 && (
                    <>
                        <ActionButton onClick={onClose} variant="ghost" size="sm">Agora não</ActionButton>
                        <ActionButton onClick={() => setStep(1)} variant="primary" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                            Vamos configurar
                        </ActionButton>
                    </>
                )}
                {step === 1 && (
                    <>
                        <ActionButton onClick={() => setStep(0)} variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
                            Voltar
                        </ActionButton>
                        <ActionButton onClick={() => setStep(2)} variant="primary" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                            Já copiei a chave
                        </ActionButton>
                    </>
                )}
                {step === 2 && (
                    <>
                        {!currentApiKey && (
                            <ActionButton onClick={() => setStep(1)} variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
                                Voltar
                            </ActionButton>
                        )}
                        {currentApiKey && (
                            <ActionButton onClick={onClose} disabled={isSaving} variant="ghost" size="sm">Cancelar</ActionButton>
                        )}
                        <ActionButton
                            type="submit"
                            form="apiKeyForm"
                            disabled={isSaving || !apiKey.trim()}
                            loading={isSaving}
                            loadingText="Ativando…"
                            variant="primary"
                            size="sm"
                            icon={<ShieldCheck className="h-4 w-4" />}
                        >
                            Ativar Inteligência Artificial
                        </ActionButton>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={isSaving ? () => {} : onClose}
            title="Inteligência Artificial"
            footer={footer}
            disableClose={isSaving}
        >
            {/* Indicador de progresso — numerado, conectado, na cor da marca */}
            <div className="flex items-center justify-center gap-1.5">
                {STEPS.map((label, i) => {
                    const done = step > i;
                    const active = step === i;
                    return (
                        <React.Fragment key={label}>
                            <div className="flex items-center gap-2">
                                <span
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
                                    style={{
                                        background: done || active ? 'var(--brand-primary)' : 'var(--surface-muted)',
                                        color: done || active ? '#fff' : 'var(--text-soft)',
                                        boxShadow: active ? '0 0 0 4px var(--brand-primary-soft)' : 'none',
                                    }}
                                >
                                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                </span>
                                <span
                                    className="hidden text-xs font-semibold transition-colors sm:inline"
                                    style={{ color: active ? 'var(--text-strong)' : 'var(--text-soft)' }}
                                >
                                    {label}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <span
                                    className="h-px w-5 sm:w-7"
                                    style={{ background: step > i ? 'var(--brand-primary)' : 'var(--border-subtle)' }}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ETAPA 1 — Sobre a IA */}
            {step === 0 && (
                <div className="animate-fade-in space-y-5">
                    <div className="text-center">
                        <div
                            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{ background: 'var(--brand-primary-soft)' }}
                        >
                            <Sparkles className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <h3 className="text-lg font-bold tracking-[-0.01em] text-[var(--text-strong)]">
                            Deixe a IA fazer o trabalho repetitivo
                        </h3>
                        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
                            Conecte sua chave gratuita do Google e libere os recursos inteligentes do PelículasBR.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {AI_FEATURES.map(({ icon: Icon, title, desc }) => (
                            <div
                                key={title}
                                className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"
                            >
                                <span
                                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)]"
                                    style={{ background: 'var(--brand-primary-soft)' }}
                                >
                                    <Icon className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--text-strong)]">{title}</p>
                                    <p className="truncate text-xs text-[var(--text-muted)]">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        className="flex items-center gap-3 rounded-[var(--radius-control)] p-3"
                        style={{ background: 'color-mix(in srgb, var(--brand-accent) 12%, transparent)' }}
                    >
                        <Gift className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand-accent)' }} />
                        <p className="text-xs leading-relaxed text-[var(--text-body)]">
                            A chave é <strong>gratuita</strong> e vinculada apenas à sua conta Google. A configuração leva menos de 2 minutos.
                        </p>
                    </div>
                </div>
            )}

            {/* ETAPA 2 — Gerar a chave */}
            {step === 1 && (
                <div className="animate-fade-in space-y-5">
                    <div className="text-center">
                        <div
                            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{ background: 'var(--brand-primary-soft)' }}
                        >
                            <KeyRound className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <h3 className="text-lg font-bold tracking-[-0.01em] text-[var(--text-strong)]">
                            Gere sua chave no Google AI Studio
                        </h3>
                        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
                            Abra o site oficial do Google e siga os passos abaixo, sem pressa.
                        </p>
                    </div>

                    <a
                        href={GEMINI_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(21,94,239,0.18)] transition-colors"
                        style={{ background: 'var(--brand-primary)' }}
                    >
                        Abrir Google AI Studio
                        <ExternalLink className="h-4 w-4" />
                    </a>

                    <ol className="space-y-2.5">
                        {[
                            {
                                title: 'Entre com sua conta Google',
                                desc: 'Use o mesmo e-mail que você já usa no celular ou no Gmail.',
                            },
                            {
                                title: 'Clique em "Criar chave de API"',
                                desc: 'O botão fica no canto superior direito da tela.',
                            },
                            {
                                title: 'Crie um projeto quando pedir',
                                desc: 'O Google pede um projeto para guardar a chave. Clique em "Criar projeto", mantenha o nome sugerido e confirme — é só uma organização interna do Google.',
                                highlight: true,
                            },
                            {
                                title: 'Copie a chave gerada',
                                desc: 'Ela começa com "AIza…". Clique em "Copiar" e volte para esta tela.',
                            },
                        ].map((item, i) => (
                            <li
                                key={i}
                                className="flex gap-3 rounded-[var(--radius-control)] border p-3"
                                style={{
                                    borderColor: item.highlight ? 'color-mix(in srgb, var(--brand-primary) 35%, transparent)' : 'var(--border-subtle)',
                                    background: item.highlight ? 'var(--brand-primary-soft)' : 'var(--surface-muted)',
                                }}
                            >
                                <span
                                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                    style={{ background: 'var(--brand-primary)' }}
                                >
                                    {i + 1}
                                </span>
                                <div className="min-w-0 space-y-0.5">
                                    <p className="text-sm font-semibold text-[var(--text-strong)]">{item.title}</p>
                                    <p className="text-xs leading-relaxed text-[var(--text-muted)]">{item.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <p className="text-center text-xs text-[var(--text-soft)]">
                        Travou em algum passo? Toque em <span className="font-medium text-[var(--text-muted)]">"Falar com o suporte"</span> abaixo.
                    </p>
                </div>
            )}

            {/* ETAPA 3 — Ativar */}
            {step === 2 && (
                <form id="apiKeyForm" onSubmit={handleSubmit} className="animate-fade-in space-y-5">
                    <div className="text-center">
                        <div
                            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{ background: 'color-mix(in srgb, var(--brand-accent) 14%, transparent)' }}
                        >
                            <ShieldCheck className="h-7 w-7" style={{ color: 'var(--brand-accent)' }} />
                        </div>
                        <h3 className="text-lg font-bold tracking-[-0.01em] text-[var(--text-strong)]">
                            {currentApiKey ? 'Atualizar sua chave' : 'Cole sua chave para ativar'}
                        </h3>
                        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
                            {currentApiKey
                                ? 'Você já tem uma chave ativa. Substitua apenas se precisar trocá-la.'
                                : 'Cole a chave que você copiou do Google AI Studio no campo abaixo.'}
                        </p>
                    </div>

                    <Input
                        id="apiKey"
                        label="Chave de API do Google Gemini"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Cole sua chave aqui (começa com AIza…)"
                    />

                    {saveError && (
                        <div
                            className="flex gap-2 rounded-[var(--radius-control)] border p-3 text-sm"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--brand-primary) 22%, transparent)',
                                background: 'var(--brand-primary-soft)',
                                color: 'var(--text-body)',
                            }}
                        >
                            <span>{saveError}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-soft)]">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Sua chave fica guardada apenas na sua conta.</span>
                    </div>

                    {!currentApiKey && (
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="mx-auto block text-xs font-medium text-[var(--text-soft)] transition-colors hover:text-[var(--brand-primary)]"
                        >
                            Ainda não tenho a chave — ver como criar
                        </button>
                    )}
                </form>
            )}
        </Modal>
    );
};

export default ApiKeyModal;
