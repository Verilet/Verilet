import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './styles/layout.css';
import './styles/header.css';
import './styles/form.css';
import './styles/buttons.css';
import './styles/chips.css';
import './styles/home.css';
import './styles/scans.css';
import './styles/results.css';
import './styles/dev-nav.css';
import './styles/landing.css';
import './styles/about.css';
import './styles/transitions.css';
import './styles/auth.css';
import App from './App.tsx';
import AuthProvider from './auth/AuthProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
