import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import '../index.css';
import { AuthProvider } from '@features/auth/AuthProvider';
import { ActiveOrganizationProvider } from '@shared/context/ActiveOrganizationContext';
import { queryClient } from '@shared/lib/queryClient';
import { I18nProvider } from '@shared/context/I18nProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <ActiveOrganizationProvider>
              <App />
            </ActiveOrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
