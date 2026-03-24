import React from 'react';

type EstoqueDeleteConfirmModalProps = {
    showDeleteConfirm: { type: 'bobina' | 'retalho'; id: number } | null;
    onClose: () => void;
    onConfirm: () => void;
};

export default function EstoqueDeleteConfirmModal({
    showDeleteConfirm,
    onClose,
    onConfirm,
}: EstoqueDeleteConfirmModalProps) {
    if (!showDeleteConfirm) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content status-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ color: 'var(--danger)' }}>Confirmar Exclusao</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                        Tem certeza que deseja excluir este <strong>{showDeleteConfirm.type}</strong>?
                    </p>
                    {showDeleteConfirm.type === 'bobina' ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Todos os consumos associados a ela permanecerao no historico.
                        </p>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Dica: se o retalho foi usado, considere mudar o status para usado em vez de excluir.
                        </p>
                    )}
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className="btn-primary"
                        style={{ flex: 1, backgroundColor: 'var(--danger)' }}
                        onClick={onConfirm}
                    >
                        Sim, Excluir
                    </button>
                </div>
            </div>
        </div>
    );
}
