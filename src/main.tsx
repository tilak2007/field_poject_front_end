import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initOfflineSyncListeners } from './utils/offlineSync';

// Initialize automatic background sync when returning online
initOfflineSyncListeners();

// Register Service Worker for full PWA offline operation
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[FieldAssist PWA] Service Worker registered with scope:', reg.scope))
      .catch((err) => console.warn('[FieldAssist PWA] Service Worker registration notice:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
