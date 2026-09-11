import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { queryClient } from './lib/queryClient';
import { initAuth } from './stores/auth';
import { initLanguage } from './i18n';
import './index.css';

// Both run before the first paint: the document needs its lang/dir set so the
// very first frame is laid out in the right direction, and the auth listener
// needs to be attached before a component can ask who is signed in.
initLanguage();
initAuth();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
