// PARA FORCAR UMA NOVA VERSAO: Altere o numero da versao abaixo (ex: 71 -> 72)
// console.log('App Version: 81 - Sistema de Assinaturas');

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './src/index.css';
import App from './App';
import { ErrorProvider } from './src/contexts/ErrorContext';
import { FeedbackProvider } from './src/contexts/FeedbackContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ResetPassword } from './components/ResetPassword';
import { redirectToCanonicalHostIfNeeded } from './src/lib/canonicalHost';
import { supabase } from './services/supabaseClient';

const EstoquePublicoView = lazy(() => import('./components/views/EstoquePublicoView'));
const ServicoPublicoView = lazy(() => import('./components/views/ServicoPublicoView'));
const InviteRegister = lazy(() => import('./components/InviteRegister'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const urlParams = new URLSearchParams(window.location.search);
const pathname = window.location.pathname;

// O login com Google (PKCE) retorna para a raiz com ?code=, exatamente como os
// links publicos de estoque. Antes de redirecionar para o Google marcamos uma
// flag por aba; ao voltar, esse ?code= deve seguir para o fluxo de auth (app
// normal), e nao ser tratado como QR de estoque.
let isGoogleOAuthCallback = false;
try {
  if (sessionStorage.getItem('pb-google-oauth-redirect') === '1') {
    sessionStorage.removeItem('pb-google-oauth-redirect');
    isGoogleOAuthCallback = urlParams.has('code') || urlParams.has('error');
  }
} catch {
  // sessionStorage indisponivel: segue o fluxo padrao.
}

// Captura o code do OAuth (Google) AGORA, sincronamente, antes que qualquer
// efeito do React possa limpar a URL. A deteccao automatica do Supabase
// (detectSessionInUrl) roda so depois de adquirir o lock (~120ms), tempo em
// que o React ja montou e o ?code= pode ter sumido. Trocamos manualmente.
const oauthCallbackCode = isGoogleOAuthCallback && urlParams.has('code')
  ? urlParams.get('code')
  : null;

const isPublicEstoque = !isGoogleOAuthCallback && (urlParams.has('qr') || urlParams.has('code'));
const isEstoquePublico = isPublicEstoque && (
  pathname === '/' ||
  pathname === '/consulta' ||
  pathname.includes('estoque') ||
  pathname.endsWith('index.html')
);

const isPublicServico = urlParams.has('servico') || urlParams.has('s');
const isServicoPublico = isPublicServico && !isEstoquePublico;

const isInvitePage = pathname.startsWith('/convite/') || pathname.includes('/convite/');
const isResetPasswordPath = pathname.startsWith('/reset-password');

const root = ReactDOM.createRoot(rootElement);

const PublicLoadingFallback = (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: 'white'
    }}
  >
    <div>Carregando...</div>
  </div>
);

const AppWithPasswordRecovery: React.FC = () => {
  const { isPasswordRecovery, clearPasswordRecovery, session } = useAuth();

  if (isPasswordRecovery || (isResetPasswordPath && !!session)) {
    return <ResetPassword onSuccess={clearPasswordRecovery} />;
  }

  if (isResetPasswordPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-10 border border-slate-100 text-center">
          <h2 className="text-3xl font-extrabold text-[#020617] mb-3">Link invalido ou expirado</h2>
          <p className="text-slate-500 font-medium mb-8">
            Solicite um novo email de redefinicao de senha para continuar.
          </p>
          <button
            type="button"
            onClick={() => window.location.replace(window.location.origin)}
            className="w-full py-4 px-6 bg-[#020617] hover:bg-black text-white font-bold rounded-2xl transition-all shadow-xl shadow-slate-200/50"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return <App />;
};

const renderApp = () => {
  if (isServicoPublico) {
    root.render(
      <ThemeProvider>
        <Suspense fallback={PublicLoadingFallback}>
          <ServicoPublicoView />
        </Suspense>
      </ThemeProvider>
    );
  } else if (isEstoquePublico) {
    root.render(
      <ThemeProvider>
        <Suspense fallback={PublicLoadingFallback}>
          <EstoquePublicoView />
        </Suspense>
      </ThemeProvider>
    );
  } else if (isInvitePage) {
    root.render(
      <ThemeProvider>
        <Suspense fallback={PublicLoadingFallback}>
          <BrowserRouter>
            <InviteRegister />
          </BrowserRouter>
        </Suspense>
      </ThemeProvider>
    );
  } else {
    root.render(
      <ErrorProvider>
        <FeedbackProvider>
          <ThemeProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <AppWithPasswordRecovery />
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </FeedbackProvider>
      </ErrorProvider>
    );
  }
};

// Troca o code do Google por sessao explicitamente, garantindo que a sessao
// exista ANTES de montar o React. Se a deteccao automatica do Supabase ja
// tiver consumido o code, esta chamada apenas retorna erro (ignorado) e a
// sessao ja estara salva. Se ela perdeu a corrida, esta troca a estabelece.
const bootstrapOAuthSession = async () => {
  if (!oauthCallbackCode) {
    return;
  }
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(oauthCallbackCode);
    if (error) {
      console.warn('[OAuth] Troca explicita retornou erro (pode ja ter sido trocado):', error.message);
    } else {
      console.log('[OAuth] Sessao estabelecida via troca explicita do code.');
    }
  } catch (error) {
    console.error('[OAuth] Erro inesperado ao trocar o code:', error);
  } finally {
    // Limpa o ?code= da URL apos a troca.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // ignora: limpeza de URL e cosmetica.
    }
  }
};

void redirectToCanonicalHostIfNeeded()
  .then(async redirected => {
    if (redirected) {
      return;
    }
    await bootstrapOAuthSession();
    renderApp();
  })
  .catch(async error => {
    console.error('Erro ao verificar dominio canonico:', error);
    await bootstrapOAuthSession();
    renderApp();
  });
