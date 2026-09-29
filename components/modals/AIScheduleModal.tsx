import React from 'react';
import { AIInput, Client } from '../../types';
import AIComposerModal from './ai/AIComposerModal';

interface AIScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (input: AIInput) => Promise<void>;
    isProcessing: boolean;
    provider: 'gemini' | 'openai' | 'local_ocr';
    // "Salvar direto na agenda": parar o áudio já processa e salva, sem conferência.
    autoSave: boolean;
    onToggleAutoSave: (enabled: boolean) => void;
    // Aberto na tela de um cliente: basta falar o dia e a hora.
    client?: Client | null;
}

// Abre direto no microfone: a pessoa fala e confere o agendamento antes de salvar
// (ou, com a chave ligada, a IA já salva ao parar o áudio).
const AIScheduleModal: React.FC<AIScheduleModalProps> = ({ autoSave, onToggleAutoSave, client, ...props }) => {
    const ask = client
        ? `Agendando para ${client.nome}. Fale o dia e a hora.`
        : 'Fale o nome do cliente, o local, o dia e a hora.';
    return (
    <AIComposerModal
        {...props}
        title="Agendamento com IA"
        intro={autoSave
            ? `${ask} Ao parar, a IA já salva na agenda.`
            : `${ask} A IA preenche o agendamento e você confere antes de salvar.`}
        options={(
            <button
                type="button"
                role="switch"
                aria-checked={autoSave}
                onClick={() => onToggleAutoSave(!autoSave)}
                disabled={props.isProcessing}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${autoSave
                    ? 'border-[var(--brand-primary)] bg-[rgba(21,94,239,0.06)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]'
                    }`}
            >
                <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text-strong)]">Salvar direto na agenda</span>
                    <span className="block text-xs text-[var(--text-muted)]">
                        Sem conferir. Se algo não ficar claro ou o horário não puder ser agendado, abre a conferência.
                    </span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${autoSave ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${autoSave ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
            </button>
        )}
        textPlaceholder={client ? 'Dia e hora…' : 'Cliente, local, dia e hora…'}
        textExample={client ? 'Sexta às 9h, umas 3 horas.' : 'Maria Souza, Rua das Flores 120, Centro, sexta às 9h.'}
        filesHint="Print da conversa em que o cliente combinou o dia e o horário."
        voiceHint={client ? 'Ex.: “sexta às 9, umas 3 horas”.' : 'Ex.: “Maria Souza, Rua das Flores 120, sexta às 9 da manhã”.'}
        submitLabel={autoSave ? 'Salvar na agenda' : 'Preencher agendamento'}
        stages={['Entendendo o pedido…', 'Separando dia e horário…', autoSave ? 'Salvando na agenda…' : 'Montando o agendamento…']}
        processingNote={autoSave
            ? 'Leva alguns segundos. Se algo não ficar claro, você confere antes de salvar.'
            : 'Leva alguns segundos. Você revisa tudo antes de salvar.'}
        initialMode="voice"
        autoSubmitVoice={autoSave}
        keyboardAwareFooter
    />
    );
};

export default AIScheduleModal;
