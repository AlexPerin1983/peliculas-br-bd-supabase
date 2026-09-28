import { Ban, Bookmark, CheckCheck, PackageCheck, type LucideIcon } from 'lucide-react';

// Opções de status do Estoque, compartilhadas entre o filtro do topo (desktop)
// e o bottom sheet de filtro (mobile).

export type EstoqueStatusTone = 'good' | 'warn' | 'muted' | 'danger';

// Como cada status aparece na folha "Alterar status": nome, o que significa, cor e ícone.
export const ESTOQUE_STATUS_META: Record<string, { label: string; description: string; tone: EstoqueStatusTone; icon: LucideIcon }> = {
    ativa: { label: 'Ativa', description: 'Em uso, com metragem para cortar', tone: 'good', icon: PackageCheck },
    finalizada: { label: 'Finalizada', description: 'A metragem acabou e ela sai do estoque livre', tone: 'muted', icon: CheckCheck },
    descartada: { label: 'Descartada', description: 'Perdida ou danificada', tone: 'danger', icon: Ban },
    disponivel: { label: 'Disponível', description: 'Livre para usar em um serviço', tone: 'good', icon: PackageCheck },
    reservado: { label: 'Reservado', description: 'Separado para um serviço', tone: 'warn', icon: Bookmark },
    usado: { label: 'Usado', description: 'Já foi aplicado e sai do estoque livre', tone: 'muted', icon: CheckCheck },
    descartado: { label: 'Descartado', description: 'Perdido ou danificado', tone: 'danger', icon: Ban },
};

export interface EstoqueStatusOption {
    value: string;
    label: string;
    emoji?: string;
}

export const getEstoqueStatusOptions = (activeTab: 'bobinas' | 'retalhos'): EstoqueStatusOption[] =>
    activeTab === 'bobinas'
        ? [
              { value: 'todos', label: 'Status', emoji: '•' },
              { value: 'ativa', label: 'Ativa', emoji: '•' },
              { value: 'finalizada', label: 'Finalizada', emoji: '•' },
              { value: 'descartada', label: 'Descartada', emoji: '•' },
          ]
        : [
              { value: 'todos', label: 'Status', emoji: '•' },
              { value: 'disponivel', label: 'Disponível', emoji: '•' },
              { value: 'reservado', label: 'Reservado', emoji: '•' },
              { value: 'usado', label: 'Usado', emoji: '•' },
              { value: 'descartado', label: 'Descartado', emoji: '•' },
          ];
