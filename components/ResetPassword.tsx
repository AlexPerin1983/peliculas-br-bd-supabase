import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';

interface ResetPasswordProps {
    onSuccess: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onSuccess }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' });
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Senha redefinida com sucesso! Redirecionando...' });

            // Aguarda um pouco para o usuário ver a mensagem de sucesso
            setTimeout(() => {
                onSuccess();
            }, 2000);
        } catch (error: any) {
            console.error('[ResetPassword] Erro:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Erro ao redefinir senha. Tente novamente.'
            });
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full pl-11 pr-12 py-3 bg-[#f1f5f9] border-none rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-300 outline-none transition-all";

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-10 border border-slate-100">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-[#020617] mb-3">
                        Redefinir Senha
                    </h2>
                    <p className="text-slate-500 font-medium">
                        Digite sua nova senha abaixo
                    </p>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl mb-6 text-sm font-semibold flex items-center gap-3 ${message.type === 'error'
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : 'bg-green-50 text-green-600 border border-green-100'
                        }`}>
                        {message.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#020617] ml-1">Nova senha</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={inputClasses}
                                placeholder="••••••••"
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#020617] ml-1">Confirmar nova senha</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={inputClasses}
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>
                    </div>

                    {/* Indicador de força da senha */}
                    {newPassword && (
                        <div className="space-y-2">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4].map((level) => (
                                    <div
                                        key={level}
                                        className={`h-1 flex-1 rounded-full transition-colors ${newPassword.length >= level * 3
                                                ? newPassword.length >= 12
                                                    ? 'bg-green-500'
                                                    : newPassword.length >= 8
                                                        ? 'bg-yellow-500'
                                                        : 'bg-red-400'
                                                : 'bg-slate-200'
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 text-center">
                                {newPassword.length < 6
                                    ? 'Senha muito curta'
                                    : newPassword.length < 8
                                        ? 'Senha fraca'
                                        : newPassword.length < 12
                                            ? 'Senha média'
                                            : 'Senha forte'}
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || newPassword.length < 6}
                        className="w-full py-4 px-6 bg-[#020617] hover:bg-black text-white font-bold rounded-2xl transition-all shadow-xl shadow-slate-200/50 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check size={20} />
                                <span>Salvar Nova Senha</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-slate-400">
                        Lembre-se de guardar sua senha em local seguro.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
