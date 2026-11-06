import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { UIProvider } from './components/UI';
import { APP } from './config';
import './styles.css';

document.title = APP.nome;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </React.StrictMode>,
);
