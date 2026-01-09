// PARA FORÇAR UMA NOVA VERSÃO: Altere o número da versão abaixo (ex: 71 -> 72)
// console.log('App Version: 81 - Sistema de Assinaturas');

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './src/index.css';
import App from './App';
import { ErrorProvider } from './src/contexts/ErrorContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';

// Lazy load das páginas públicas
const EstoquePublicoView = lazy(() => import('./components/views/EstoquePublicoView'));
const ServicoPublicoView = lazy(() => import('./components/views/ServicoPublicoView'));
const InviteRegister = lazy(() => import('./components/InviteRegister'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Verificar se é uma consulta pública
const urlParams = new URLSearchParams(window.location.search);
const pathname = window.location.pathname;

// Consulta pública de estoque (ex: ?qr=PBR-XXX ou ?code=XXX)
const isPublicEstoque = urlParams.has('qr') || urlParams.has('code');
const isEstoquePublico = isPublicEstoque && (
  pathname === '/' ||
  pathname === '/consulta' ||
  pathname.includes('estoque') ||
  pathname.endsWith('index.html')
);

// Consulta pública de serviço prestado (ex: ?servico=SVC-XXX ou ?s=XXX)
const isPublicServico = urlParams.has('servico') || urlParams.has('s');
const isServicoPublico = isPublicServico && !isEstoquePublico;

// Página de cadastro via convite (ex: /convite/ABCD1234)
const isInvitePage = pathname.startsWith('/convite/') || pathname.includes('/convite/');

const root = ReactDOM.createRoot(rootElement);

// Fallback de loading para páginas públicas
const PublicLoadingFallback = (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    color: 'white'
  }}>
    <div>Carregando...</div>
  </div>
);

if (isServicoPublico) {
  // Renderizar página pública de serviço (sem necessidade de login)
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <Suspense fallback={PublicLoadingFallback}>
          <ServicoPublicoView />
        </Suspense>
      </ThemeProvider>
    </React.StrictMode>
  );
} else if (isEstoquePublico) {
  // Renderizar página pública de estoque (sem necessidade de login)
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <Suspense fallback={PublicLoadingFallback}>
          <EstoquePublicoView />
        </Suspense>
      </ThemeProvider>
    </React.StrictMode>
  );
} else if (isInvitePage) {
  // Renderizar página de cadastro via convite (sem necessidade de login)
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <Suspense fallback={PublicLoadingFallback}>
          <BrowserRouter>
            <InviteRegister />
          </BrowserRouter>
        </Suspense>
      </ThemeProvider>
    </React.StrictMode>
  );
} else {
  // Renderizar app normal (com autenticação e controle de assinatura)
  root.render(
    <React.StrictMode>
      <ErrorProvider>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <App />
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorProvider>
    </React.StrictMode>
  );
}