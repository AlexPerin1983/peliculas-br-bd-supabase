/**
 * Exemplo de componente React para enviar convites por email
 * 
 * Este é um exemplo de como integrar o serviço de email
 * em um componente de interface.
 */

import React, { useState } from 'react';
import { sendInviteEmailToUser } from '../services/inviteService';

interface InviteFormProps {
    inviteCode: string;
    organizationName: string;
    inviterName: string;
}

export function InviteEmailForm({ inviteCode, organizationName, inviterName }: InviteFormProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !email.includes('@')) {
            setMessage({ type: 'error', text: 'Por favor, insira um email válido' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const result = await sendInviteEmailToUser(
                email,
                inviteCode,
                inviterName,
                organizationName
            );

            if (result.success) {
                setMessage({
                    type: 'success',
                    text: `Convite enviado com sucesso para ${email}!`
                });
                setEmail(''); // Limpar campo
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Erro ao enviar convite'
                });
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: 'Erro inesperado ao enviar convite'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="invite-email-form">
            <h3>Convidar por Email</h3>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="email">Email do convidado:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@example.com"
                        disabled={loading}
                        required
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar Convite'}
                </button>
            </form>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="info">
                <p>
                    <strong>Código do convite:</strong> {inviteCode}
                </p>
                <p>
                    Um email será enviado com um link direto para aceitar o convite.
                </p>
            </div>

            <style jsx>{`
        .invite-email-form {
          max-width: 500px;
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #f9f9f9;
        }

        h3 {
          margin-top: 0;
          color: #333;
        }

        .form-group {
          margin-bottom: 15px;
        }

        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #555;
        }

        input[type="email"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        input[type="email"]:focus {
          outline: none;
          border-color: #667eea;
        }

        input[type="email"]:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        button:hover:not(:disabled) {
          opacity: 0.9;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .message {
          margin-top: 15px;
          padding: 12px;
          border-radius: 4px;
          font-size: 14px;
        }

        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .info {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }

        .info p {
          margin: 5px 0;
          font-size: 14px;
          color: #666;
        }

        .info strong {
          color: #333;
        }
      `}</style>
        </div>
    );
}

// Exemplo de uso em uma página de configurações
export function OrganizationSettingsPage() {
    const [inviteCode, setInviteCode] = useState('ABC12345');
    const organizationName = 'Películas Premium';
    const inviterName = 'João Silva';

    return (
        <div className="settings-page">
            <h1>Configurações da Organização</h1>

            <section>
                <h2>Convidar Membros</h2>

                <InviteEmailForm
                    inviteCode={inviteCode}
                    organizationName={organizationName}
                    inviterName={inviterName}
                />
            </section>
        </div>
    );
}
