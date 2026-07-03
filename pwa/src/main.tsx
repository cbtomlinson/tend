import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './design/global.css';
import { ensureSeeded } from './data/store';
import { Root } from './app/Root';
import { UIStateProvider } from './app/uiState';

// Service worker: caches app shell only — never task/PHI data.
// When a new version is waiting, App shows an "Update" banner that calls
// window.__tendApplyUpdate to activate it and reload.
const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('tend:need-refresh'));
  },
});
(window as unknown as { __tendApplyUpdate?: () => void }).__tendApplyUpdate =
  () => void applyUpdate(true);

async function boot() {
  // Ask the browser to protect this site's storage from automatic cleanup
  // (iOS/Safari can otherwise evict IndexedDB without warning).
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* older browsers */
  }
  await ensureSeeded();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <UIStateProvider>
        <Root />
      </UIStateProvider>
    </StrictMode>,
  );
}

void boot();
