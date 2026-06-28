import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './design/global.css';
import { ensureSeeded } from './data/store';
import { App } from './app/App';
import { UIStateProvider } from './app/uiState';

// Service worker: caches app shell only — never task/PHI data.
registerSW({ immediate: true });

async function boot() {
  await ensureSeeded();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <UIStateProvider>
        <App />
      </UIStateProvider>
    </StrictMode>,
  );
}

void boot();
