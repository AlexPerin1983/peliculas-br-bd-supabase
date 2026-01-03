import React, { useState, useEffect } from 'react';
import {
    Crown,
    Package,
    Check,
    Clock,
    RefreshCw,
    ChevronRight,
    Zap,
    Shield,
    Star
} from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
    ModuleCard,
    UsageBar,
    ActivateModuleModal
} from './SubscriptionComponents';
import {
    requestModuleActivation,
    SubscriptionModule
} from '../../services/subscriptionService';

interface SubscriptionPageProps {
    onBack?: () => void;
    userInfo?: {
        nome?: string;
        empresa?: string;
        payment_methods?: Array<{
            tipo: string;
            chave_pix?: string;
        }>;
    };
}

export function SubscriptionPage({ onBack, userInfo }: SubscriptionPageProps) {
    const {
        info,
        modules,
        isLoading,
        refresh,
        canUseEstoque,
        canUseQrServicos,
        canUseColaboradores,
        canUseIA,
        canCustomize,
        canAddLocais,
        isUnlimited
    } = useSubscription();

    const [selectedModule, setSelectedModule] = useState<SubscriptionModule | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Buscar chave PIX das configurações do admin
    const adminPixKey = userInfo?.payment_methods?.find(p => p.tipo === 'pix')?.chave_pix || 'contato@peliculasbr.com';

    const handleActivateClick = (module: SubscriptionModule) => {
        setSelectedModule(module);
        setIsModalOpen(true);
    };

    const handleConfirmActivation = async (billingCycle: 'monthly' | 'yearly') => {
        if (!selectedModule) return;

        setIsSubmitting(true);
        try {
            const result = await requestModuleActivation(selectedModule.id, billingCycle);

            if (result.success) {
                setSuccessMessage(`Solicitação enviada! Assim que confirmarmos seu pagamento, o módulo "${selectedModule.name}" será ativado.`);
                setIsModalOpen(false);
                await refresh();
            } else {
                alert(`Erro: ${result.error}`);
            }
        } catch (error) {
            console.error('Erro ao solicitar ativação:', error);
            alert('Erro ao processar solicitação. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Mapear quais módulos estão ativos
    const activeModulesSet = new Set(info?.active_modules || []);

    // Encontrar detalhes de expiração
    const getModuleExpiration = (moduleId: string) => {
        const detail = info?.modules_detail?.find(m => m.module_id === moduleId);
        return detail?.expires_at || null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Crown className="w-7 h-7 text-amber-400" />
                        Minha Assinatura
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Gerencie seus módulos e funcionalidades
                    </p>
                </div>

                <button
                    onClick={() => refresh()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Mensagem de sucesso */}
            {successMessage && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-green-300">{successMessage}</p>
                        <button
                            onClick={() => setSuccessMessage(null)}
                            className="text-green-400/70 text-sm hover:text-green-400 mt-1"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Status do Plano */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Card de Status */}
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeModulesSet.size > 0
                                ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/30 text-amber-400'
                                : 'bg-gray-700 text-gray-400'
                            }`}>
                            {activeModulesSet.size > 0 ? <Star className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {activeModulesSet.size > 0 ? 'Plano Personalizado' : 'Plano Gratuito'}
                            </h2>
                            <p className="text-gray-400 text-sm">
                                {activeModulesSet.size} módulo(s) ativo(s)
                            </p>
                        </div>
                    </div>

                    {activeModulesSet.size > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {Array.from(activeModulesSet).map(moduleId => {
                                const mod = modules.find(m => m.id === moduleId);
                                return mod ? (
                                    <span
                                        key={moduleId}
                                        className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full flex items-center gap-1"
                                    >
                                        <Check className="w-3 h-3" />
                                        {mod.name}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    )}
                </div>

                {/* Card de Uso */}
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900 border border-gray-700 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-400" />
                        Uso do Mês
                    </h2>

                    <div className="space-y-4">
                        <UsageBar
                            label="Propostas geradas"
                            current={info?.usage?.pdfs_generated || 0}
                            max={isUnlimited ? -1 : (info?.limits?.max_pdfs_month || 10)}
                        />
                        <UsageBar
                            label="Agendamentos"
                            current={info?.usage?.agendamentos_created || 0}
                            max={isUnlimited ? -1 : (info?.limits?.max_agendamentos_month || 5)}
                        />
                    </div>

                    {info?.usage_resets_at && (
                        <p className="text-gray-500 text-xs mt-4 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Contadores renovam em {new Date(info.usage_resets_at).toLocaleDateString('pt-BR')}
                        </p>
                    )}
                </div>
            </div>

            {/* Benefícios PRO */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/30 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    Por que ativar módulos PRO?
                </h3>

                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-white font-medium">Sem limites</p>
                            <p className="text-gray-400 text-sm">Trabalhe sem restrições</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-white font-medium">Recursos exclusivos</p>
                            <p className="text-gray-400 text-sm">Estoque, QR Code e mais</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-white font-medium">Suporte prioritário</p>
                            <p className="text-gray-400 text-sm">Atendimento mais rápido</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Módulos */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">
                    Módulos Disponíveis
                </h2>

                <div className="space-y-4">
                    {modules.map(module => (
                        <ModuleCard
                            key={module.id}
                            module={module}
                            isActive={activeModulesSet.has(module.id)}
                            expiresAt={getModuleExpiration(module.id)}
                            onActivate={() => handleActivateClick(module)}
                        />
                    ))}
                </div>
            </div>

            {/* Limites do Plano Gratuito */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Limites do Plano Gratuito</h3>

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Clientes cadastrados</span>
                        <span className="text-gray-300">
                            {isUnlimited ? '∞' : info?.limits?.max_clients || 10}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Películas cadastradas</span>
                        <span className="text-gray-300">
                            {isUnlimited ? '∞' : info?.limits?.max_films || 5}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Propostas/mês</span>
                        <span className="text-gray-300">
                            {isUnlimited ? '∞' : info?.limits?.max_pdfs_month || 10}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Agendamentos/mês</span>
                        <span className="text-gray-300">
                            {isUnlimited ? '∞' : info?.limits?.max_agendamentos_month || 5}
                        </span>
                    </div>
                </div>

                <p className="text-gray-500 text-xs mt-4">
                    * Ative o módulo "Sem Limites" para remover todas as restrições.
                </p>
            </div>

            {/* Modal de Ativação */}
            {selectedModule && (
                <ActivateModuleModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedModule(null);
                    }}
                    module={selectedModule}
                    onConfirm={handleConfirmActivation}
                    pixKey={adminPixKey}
                />
            )}
        </div>
    );
}
