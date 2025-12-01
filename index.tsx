
// PARA FORÇAR UMA NOVA VERSÃO: Altere o número da versão abaixo (ex: 71 -> 72)
// console.log('App Version: 71 - Auto-Update Service Worker');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { ErrorProvider } from './src/contexts/ErrorContext';

import { ThemeProvider } from './src/contexts/ThemeContext';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorProvider>
  </React.StrictMode>
);