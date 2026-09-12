import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { ToastProvider } from './hooks/useToast';
import { queryClient } from './lib/queryClient';
import { initAuth } from './stores/auth';
import { initTheme } from './stores/theme';
import { initLanguage } from './i18n';
import { initPwa } from './lib/pwa';
import './index.css';

// All three run before the first paint: the document needs its lang/dir and
// its dark class set so the very first frame is laid out and coloured right,
// and the auth listener has to be attached before a component can ask who is
// signed in.
initLanguage();
initTheme();
initAuth();

// Not part of the first paint: this registers the service worker and then
// keeps asking whether a newer build has been deployed, so a fix reaches a
// phone that has had the app open for a week.
initPwa();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
