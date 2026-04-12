import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Toolbar } from './components/layout/Toolbar';
import { Terminal } from './components/layout/Terminal';
import { SettingsModal } from './components/settings/SettingsModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useAccount } from './hooks/useAccount';
import { useSettingsStore } from './store/settingsStore';

export const App: React.FC = () => {
  // Init essential global data streams natively at root level
  useWebSocket();
  useAccount();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme } = useSettingsStore();

  useEffect(() => {
    // Sync theme with HTML body for global CSS variables if needed
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0b0d] text-[#e8eaed] font-sans antialiased overflow-hidden select-none selection:bg-[#4285f4]/30">
      <Toolbar onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Terminal />
      </main>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      <Toaster 
        position="bottom-right"
        gutter={12}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#111318',
            border: '1px solid #1e2028',
            color: '#e8eaed',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 800,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            borderRadius: '10px',
            padding: '12px 20px',
          },
          success: { 
            iconTheme: { primary: '#00c853', secondary: '#111318' },
            style: { borderLeft: '4px solid #00c853' }
          },
          error: { 
            iconTheme: { primary: '#f44336', secondary: '#111318' },
            style: { borderLeft: '4px solid #f44336' }
          }
        }} 
      />
    </div>
  );
};

export default App;
