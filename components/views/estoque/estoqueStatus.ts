// Opções de status do Estoque, compartilhadas entre o filtro do topo (desktop)
// e o bottom sheet de filtro (mobile).

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
              { value: 'disponivel', label: 'Disponivel', emoji: '•' },
              { value: 'reservado', label: 'Reservado', emoji: '•' },
              { value: 'usado', label: 'Usado', emoji: '•' },
              { value: 'descartado', label: 'Descartado', emoji: '•' },
          ];
