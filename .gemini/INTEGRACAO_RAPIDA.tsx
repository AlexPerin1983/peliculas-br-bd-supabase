// INTEGRAÇÃO RÁPIDA - QR CODE SERVIÇOS
// Cole este código no App.tsx para integrar a funcionalidade

// ========================================
// 1. ADICIONAR NOS IMPORTS (próximo aos outros imports de modals)
// ========================================
import ServicoQrModal from './components/modals/ServicoQrModal';

// ========================================
// 2. ADICIONAR NO ESTADO (junto com outros estados de modals)
// ========================================
const [isServicoQrModalOpen, setIsServicoQrModalOpen] = useState(false);

// ========================================
// 3. ADICIONAR ANTES DO FECHAMENTO DO </div> PRINCIPAL
// (Procure por onde ficam os outros modais ou antes do último </div>)
// ========================================
<ServicoQrModal
    isOpen={isServicoQrModalOpen}
    onClose={() => setIsServicoQrModalOpen(false)}
    userInfo={userInfo}
    films={films}
/>

// ========================================
// 4. BOTÃO DE ACESSO - OPÇÃO A: Botão Flutuante (Recomendado)
// (Cole antes do fechamento do </div> principal, após os modais)
// ========================================
{
    userInfo && (
        <button
            onClick={() => setIsServicoQrModalOpen(true)}
            className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-4 rounded-full shadow-2xl z-40 transition-all duration-300 hover:scale-110 flex items-center justify-center"
            title="Registrar Serviço com QR Code"
            style={{ width: '56px', height: '56px' }}
        >
            <span className="text-2xl">📋</span>
        </button>
    )
}

// ========================================
// 4. BOTÃO DE ACESSO - OPÇÃO B: No Header (Tab Nova)
// (Adicionar no Header.tsx, na lista de tabs)
// ========================================
// No Header.tsx, adicionar nova tab:
<TabButton tabId="servicos" icon="fas fa-qrcode">QR Serviços</TabButton>

// E no App.tsx, adicionar o case para renderizar:
if (activeTab === 'servicos') {
    return (
        <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">QR Code para Serviços</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
                Gere etiquetas QR para marcar os locais onde prestou serviço
            </p>
            <button
                onClick={() => setIsServicoQrModalOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
                📋 Novo Serviço QR
            </button>
        </div>
    );
}

// ========================================
// 4. BOTÃO DE ACESSO - OPÇÃO C: Na Seção de Configurações
// (Adicionar como prop no UserSettingsView)
// ========================================
// No render do UserSettingsView (App.tsx linha ~2257):
<UserSettingsView
    userInfo={userInfo}
    onSave={handleSaveUserInfo}
    onOpenPaymentMethods={() => setIsPaymentModalOpen(true)}
    onOpenApiKeyModal={handleOpenApiKeyModal}
    isPwaInstalled={isInstalled}
    onPromptPwaInstall={handlePromptPwaInstall}
    onOpenServicoQrModal={() => setIsServicoQrModalOpen(true)}  // <- ADICIONAR ESTA LINHA
/>

// E no UserSettingsView.tsx, adicionar:
// 1. Na interface (linha ~9):
interface UserSettingsViewProps {
    // ... outras props
    onOpenServicoQrModal?: () => void;  // <- ADICIONAR
}

// 2. No destructuring (linha ~54):
const UserSettingsView: React.FC<UserSettingsViewProps> = ({
    userInfo,
    onSave,
    onOpenPaymentMethods,
    onOpenApiKeyModal,
    isPwaInstalled,
    onPromptPwaInstall,
    onOpenServicoQrModal  // <- ADICIONAR
}) => {

    // 3. Adicionar botão na seção de Configurações (após linha ~341):
    {
        onOpenServicoQrModal && (
            <button
                type="button"
                onClick={onOpenServicoQrModal}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
            >
                <i className="fas fa-qrcode"></i>
                Gerar QR Code de Serviço
            </button>
        )
    }

// ========================================
// RECOMENDAÇÃO
// ========================================
// Use a OPÇÃO A (Botão Flutuante) por ser a mais simples e não exigir
// modificações em múltiplos arquivos. É só copiar e colar no App.tsx!
