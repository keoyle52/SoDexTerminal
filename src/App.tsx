import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { useSettingsStore } from './store/settingsStore';
// Settings loaded synchronously to avoid Suspense stall issues
import { Settings } from './pages/Settings';
import { startDemoEngine, stopDemoEngine } from './api/demoEngine';
import { startWave3Engine } from './api/wave3Engine';

/**
 * Lazy-loaded route modules. Each page is a separate chunk so the first
 * paint stays small; subsequent navigations warm the chunk via
 * `preloadCommonPages` on idle.
 */
type LazyImport = () => Promise<{ default: React.ComponentType }>;

const lazyFrom = (mod: LazyImport, key: string) => lazy(() => mod().then((m) => {
  // Guard against individual page chunks failing — show a tiny inline
  // fallback instead of an unstyled crash. In practice Vite's fetch-level
  // retries cover transient network blips first.
  return m as { default: React.ComponentType };
}).catch(() => ({
  default: () => (
    <div className="p-6 text-sm text-danger">
      Failed to load <code>{key}</code> chunk. Please reload the page.
    </div>
  ),
})));

const TradingBots  = lazyFrom(() => import('./pages/TradingBots').then(m => ({ default: m.TradingBots })), 'TradingBots');

const TerminalWorkspace = lazyFrom(() => import('./pages/TerminalWorkspace').then(m => ({ default: m.TerminalWorkspace })), 'TerminalWorkspace');
const AccountAndRisk    = lazyFrom(() => import('./pages/AccountAndRisk').then(m => ({ default: m.AccountAndRisk })), 'AccountAndRisk');
const MirrorTool        = lazyFrom(() => import('./pages/MirrorTool').then(m => ({ default: m.MirrorTool })), 'MirrorTool');
import { HeaderDock } from './components/HeaderDock';

/**
 * Non-blocking Suspense fallback — a subtle top progress shimmer instead of
 * a full-screen spinner so components never collapse during a route-chunk fetch.
 */
const PageLoader = () => (
  <div className="flex-1 relative">
    <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-transparent via-primary to-transparent"
        style={{ animation: 'shimmer 1.2s linear infinite', backgroundSize: '200% 100%' }}
      />
    </div>
  </div>
);

/**
 * Keyed wrapper that re-mounts the active route's tree whenever the pathname
 * changes.
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-in flex-1 flex flex-col min-h-0 overflow-hidden">
      {children}
    </div>
  );
}

/** Scroll the main container to top on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.getElementById('app-main');
    if (main) main.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

/** Warm commonly-visited chunks on first idle so later nav is instant. */
function preloadCommonPages(): void {
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
  idle(() => {
    void import('./pages/TerminalWorkspace');
    void import('./pages/AccountAndRisk');
  });
}

function App() {
  const theme = useSettingsStore(state => state.theme);
  const isDemoMode = useSettingsStore(state => state.isDemoMode);

  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-light', theme === 'light');
    root.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (isDemoMode) {
      startDemoEngine();
      return () => stopDemoEngine();
    }
    return undefined;
  }, [isDemoMode]);

  useEffect(() => {
    preloadCommonPages();
    startWave3Engine();
      }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-text-primary font-sans antialiased bg-background selection:bg-primary/20">
      <ScrollToTop />
      <HeaderDock />
      
      <main id="app-main" className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <PageTransition>
          <Routes>
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/terminal"        element={<TerminalWorkspace />} />
                    <Route path="/dashboard"       element={<Navigate to="/terminal" replace />} />
                    <Route path="/account"          element={<AccountAndRisk />} />
                    <Route path="/positions"       element={<Navigate to="/account" replace />} />
                    <Route path="/risk"            element={<Navigate to="/account" replace />} />
                    <Route path="/trading-bots"    element={<TradingBots />} />
                    <Route path="/grid-bot"        element={<Navigate to="/trading-bots?bot=grid" replace />} />
                    <Route path="/twap-bot"        element={<Navigate to="/trading-bots?bot=twap" replace />} />
                    <Route path="/dca-bot"         element={<Navigate to="/trading-bots?bot=dca" replace />} />
                    <Route path="/market-maker"    element={<Navigate to="/trading-bots?bot=marketmaker" replace />} />
                    <Route path="/signal-bot"      element={<Navigate to="/trading-bots?bot=signal" replace />} />
                    <Route path="/mirror/*"        element={<MirrorTool />} />
                    <Route path="*"                element={<Navigate to="/terminal" replace />} />
                  </Routes>
                </Suspense>
              }
            />
          </Routes>
        </PageTransition>
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#18181D',
            color: '#F1F5F9',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: '8px',
            fontSize: '13px',
            padding: '10px 14px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
          },
          success: {
            iconTheme: { primary: '#34D399', secondary: '#18181D' },
          },
          error: {
            iconTheme: { primary: '#F87171', secondary: '#18181D' },
          },
        }}
      />
      
    </div>
  );
}

export default App;
