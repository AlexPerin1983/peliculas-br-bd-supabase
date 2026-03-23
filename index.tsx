// PARA FORCAR UMA NOVA VERSAO: Altere o numero da versao abaixo (ex: 71 -> 72)
// console.log('App Version: 81 - Sistema de Assinaturas');

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './src/index.css';
import App from './App';
import { ErrorProvider } from './src/contexts/ErrorContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ResetPassword } from './components/ResetPassword';

const EstoquePublicoView = lazy(() => import('./components/views/EstoquePublicoView'));
const ServicoPublicoView = lazy(() => import('./components/views/ServicoPublicoView'));
const InviteRegister = lazy(() => import('./components/InviteRegister'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const urlParams = new URLSearchParams(window.location.search);
const pathname = window.location.pathname;

const isPublicEstoque = urlParams.has('qr') || urlParams.has('code');
const isEstoquePublico = isPublicEstoque && (
  pathname === '/' ||
  pathname === '/consulta' ||
  pathname.includes('estoque') ||
  pathname.endsWith('index.html')
);

const isPublicServico = urlParams.has('servico') || urlParams.has('s');
const isServicoPublico = isPublicServico && !isEstoquePublico;

const isInvitePage = pathname.startsWith('/convite/') || pathname.includes('/convite/');

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
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth();

  if (isPasswordRecovery) {
    return <ResetPassword onSuccess={clearPasswordRecovery} />;
  }

  return <App />;
};

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
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <AppWithPasswordRecovery />
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorProvider>
  );
}
