import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[OTIVO Antigravity] ServiceWorker registration successful with scope: ', registration.scope);
        
        const checkIsolation = () => {
          if (window.self !== window.top) {
            return;
          }
          const reloadCount = parseInt(sessionStorage.getItem('otivo_reload_count') || '0');
          
          if (!window.crossOriginIsolated && reloadCount < 1) {
            console.log('[OTIVO Antigravity] Not cross-origin isolated. Reloading to enable WebContainer support...');
            sessionStorage.setItem('otivo_reload_count', (reloadCount + 1).toString());
            window.location.reload();
          } else if (window.crossOriginIsolated) {
            sessionStorage.removeItem('otivo_reload_count');
          }
        };

        if (registration.active) {
          checkIsolation();
        } else {
          // Wait for the service worker to become active
          const sw = registration.installing || registration.waiting;
          if (sw) {
            sw.addEventListener('statechange', (e: any) => {
              if (e.target.state === 'activated') {
                checkIsolation();
              }
            });
          }
        }
      },
      (err) => {
        console.log('[OTIVO Antigravity] ServiceWorker registration failed: ', err);
      }
    );
  });
}
