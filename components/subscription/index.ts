// Exportação central dos componentes de assinatura

export { SubscriptionProvider, useSubscription, useFeatureAccess } from '../../contexts/SubscriptionContext';

export {
    FeatureGate,
    UpgradePrompt,
    LimitWarning,
    ModuleCard,
    UsageBar,
    ActivateModuleModal,
    LockedScreen,
    ProBadge,
    ProButton,
    LimitCounter
} from './SubscriptionComponents';

export { SubscriptionPage } from './SubscriptionPage';

export {
    getAvailableModules,
    getSubscriptionInfo,
    isModuleActive,
    hasReachedLimit,
    incrementUsage,
    requestModuleActivation,
    getPendingActivations,
    confirmModuleActivation,
    clearSubscriptionCache,
    checkPermissions,
    FREE_PLAN_LIMITS,
    type SubscriptionModule,
    type SubscriptionInfo,
    type SubscriptionLimits,
    type SubscriptionUsage,
    type ModuleDetail,
    type ModuleActivation
} from '../../services/subscriptionService';
