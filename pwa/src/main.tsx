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
//
// iOS keeps installed PWAs "warm" for weeks — resumes, not reloads — so the
// default only-on-load update check never runs and banners never appear
// (Chelsea, 2026-09-08). Re-check on every return to the app + hourly.
const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('tend:need-refresh'));
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => void registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 60 * 60 * 1000);
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
