import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Package, Crown, Check, Clock, Zap } from 'lucide-react';

export const UserAccount: React.FC = () => {
    const { user, signOut } = useAuth();
    const { info, modules, isLoading: subscriptionLoading, hasModule, refresh } = useSubscription();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [showActivateModal, setShowActivateModal] = useState<string | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Erro ao atualizar senha' });
        } finally {
            setLoading(false);
        }
    };

    // Calcular valor total se comprar individual vs pacote
    const activeModulesCount = info?.active_modules?.length || 0;
    const hasFullPackage = hasModule('pacote_completo') || hasModule('ilimitado');

    // Obter detalhes dos módulos ativos
    const getModuleExpiry = (moduleId: string) => {
        const detail = info?.modules_detail?.find((m: any) => m.module_id === moduleId);
        if (detail?.expires_at) {
            const expiry = new Date(detail.expires_at);
            const now = new Date();
            const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return { expiry, daysLeft };
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Seção Meu Plano */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <Crown className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                Meu Plano
                            </h3>
                            <p className="text-sm text-blue-100">
                                Gerencie seus módulos e assinatura
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {subscriptionLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                    ) : (
                        <>
                            {/* Status do Plano */}
                            <div className="mb-6">
                                {hasFullPackage ? (
                                    <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-xl p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center">
                                                <Crown className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-400 text-lg">Pacote Completo</h4>
                                                <p className="text-amber-200/70 text-sm">
                                                    Todos os módulos liberados!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : activeModulesCount > 0 ? (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                        <div className="flex items-center gap-2 text-green-400">
                                            <Check className="w-5 h-5" />
                                            <span className="font-medium">
                                                {activeModulesCount} módulo(s) ativo(s)
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                        <p className="text-slate-500 dark:text-slate-400 text-center">
                                            Você está no plano gratuito com recursos limitados.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Oferta Especial - Pacote Completo (cálculo dinâmico) */}
                            {!hasFullPackage && (() => {
                                // Calcular preços dinamicamente dos módulos
                                const allModules = modules.filter(m => m.id !== 'pacote_completo'); // Excluir o próprio pacote se existir
                                const totalModulos = allModules.length;
                                const precoAvulso = allModules.reduce((acc, m) => acc + (m.price_monthly || 39), 0);
                                const precoPacote = 149;
                                const desconto = precoAvulso - precoPacote;
                                const descontoPercent = Math.round((desconto / precoAvulso) * 100);

                                return (
                                    <div className="mb-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-5 text-white relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                                        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full" />

                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                                                    ⚡ {descontoPercent}% OFF
                                                </span>
                                                <span className="text-indigo-200 text-sm line-through">R$ {precoAvulso.toFixed(0)},00</span>
                                            </div>

                                            <h4 className="text-xl font-bold mb-1">Pacote Completo</h4>
                                            <p className="text-indigo-200 text-sm mb-4">
                                                Libera TODOS os {totalModulos} módulos por 6 meses
                                            </p>

                                            <div className="flex items-baseline gap-2 mb-4">
                                                <span className="text-4xl font-bold">R$ {precoPacote}</span>
                                                <span className="text-indigo-200">/6 meses</span>
                                            </div>

                                            {/* Lista dinâmica de módulos inclusos */}
                                            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                                                {allModules.slice(0, 8).map(mod => (
                                                    <div key={mod.id} className="flex items-center gap-2">
                                                        <Check className="w-4 h-4 text-green-400" /> {mod.name}
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => setShowActivateModal('pacote_completo')}
                                                className="w-full py-3 bg-white text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Zap className="w-5 h-5" />
                                                Quero o Pacote Completo
                                            </button>

                                            <p className="text-center text-indigo-200/70 text-xs mt-3">
                                                Economia de R$ {desconto.toFixed(0)},00 vs avulso
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Lista de Módulos */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-4">
                                    Módulos Disponíveis
                                </h4>
                                <div className="space-y-3">
                                    {/* Lista TODOS os módulos do banco, ordenados por sort_order/nome */}
                                    {modules
                                        .filter(m => m.id !== 'pacote_completo') // Exclui apenas o pacote que é tratado separadamente
                                        .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99))
                                        .map(module => {
                                            const isActive = hasModule(module.id) || hasFullPackage;
                                            const expiryInfo = getModuleExpiry(module.id);

                                            return (
                                                <div
                                                    key={module.id}
                                                    className={`p-4 rounded-xl border transition-all ${isActive
                                                        ? 'bg-green-500/5 border-green-500/30'
                                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive
                                                                ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                                                }`}>
                                                                <Package className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-medium text-slate-900 dark:text-white">
                                                                    {module.name}
                                                                </h5>
                                                                {isActive ? (
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <span className="text-green-400 font-medium">✓ Ativo</span>
                                                                        {expiryInfo && (
                                                                            <span className="text-slate-400">
                                                                                • {expiryInfo.daysLeft} dias restantes
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-slate-500">
                                                                        {module.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {!isActive && (
                                                            <div className="text-right">
                                                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                                                    R$ {module.price_monthly?.toFixed(0) || 39}
                                                                </div>
                                                                <div className="text-xs text-slate-500">/ 6 meses</div>
                                                                <button
                                                                    onClick={() => setShowActivateModal(module.id)}
                                                                    className="mt-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                                                                >
                                                                    Ativar
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Seção Minha Conta (existente) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Minha Conta
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gerencie suas credenciais e acesso
                    </p>
                </div>

                <div className="p-6 space-y-8">
                    <div>
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-4">Informações Pessoais</h4>
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                            <p className="font-medium text-slate-900 dark:text-white">{user?.email}</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-4">Alterar Senha</h4>
                        {message && (
                            <div className={`p-4 rounded-lg mb-4 text-sm font-medium ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'
                                }`}>
                                {message.text}
                            </div>
                        )}
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !newPassword}
                                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Atualizando...' : 'Atualizar Senha'}
                            </button>
                        </form>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={signOut}
                            className="w-full sm:w-auto px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-sign-out-alt"></i>
                            Sair da Conta
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Ativação */}
            {showActivateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {showActivateModal === 'pacote_completo' ? 'Ativar Pacote Completo' : 'Ativar Módulo'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            Para ativar, faça o pagamento via PIX e aguarde a confirmação.
                        </p>

                        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 mb-6">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-slate-600 dark:text-slate-400">Valor:</span>
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {showActivateModal === 'pacote_completo' ? '149,00' : (modules.find(m => m.id === showActivateModal)?.price_monthly?.toFixed(2).replace('.', ',') || '39,00')}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 dark:text-slate-400">Validade:</span>
                                <span className="font-medium text-green-500">6 meses</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                                💳 Pagamento via PIX
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                                Entre em contato para receber os dados do PIX:
                            </p>
                            <a
                                href="https://wa.me/5583996476052"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WhatsApp
                            </a>
                        </div>

                        <button
                            onClick={() => setShowActivateModal(null)}
                            className="w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
