import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, Smartphone, ShieldCheck, Zap, Bell,
  CheckCircle2, AlertCircle, Bot,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Toggle } from '../components/common/Input';
import toast from 'react-hot-toast';
import { cn, getErrorMessage } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';
import { API_BASE } from '../api/backendBase';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

async function verifyAndConnect(chatId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/telegram/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
  });
  const data = await res.json() as { ok: boolean; registered?: boolean; reason?: string; error?: string };
  if (!data.ok) throw new Error(data.reason ?? data.error ?? 'Could not verify Chat ID');
}

export const TelegramIntegration: React.FC = () => {
  const { telegramChatId, setTelegramChatId } = useSettingsStore();

  const [chatIdInput, setChatIdInput] = useState(telegramChatId);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const [alertEnabled, setAlertEnabled] = useState(true);
  const [pnlReportEnabled, setPnlReportEnabled] = useState(true);
  const [regimeAlertsOnly, setRegimeAlertsOnly] = useState(false);
  const [orderFillsEnabled, setOrderFillsEnabled] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: '🤖 SoDEX PowerOps Bot\n\nConnected and ready! I will notify you about regime changes, P&L reports, and order fills.\n\nType /help to see available commands.', timestamp: '14:20' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const isConfigured = !!telegramChatId;

  const handleVerify = async () => {
    if (!chatIdInput.trim()) {
      toast.error('Enter your Chat ID');
      return;
    }
    setTestStatus('testing');
    setTestError('');
    try {
      await verifyAndConnect(chatIdInput.trim());
      setTelegramChatId(chatIdInput.trim());
      setTestStatus('ok');
      toast.success('Connected! Check Telegram for a confirmation message.');
    } catch (err) {
      const msg = getErrorMessage(err, 'Connection failed');
      setTestError(msg);
      setTestStatus('error');
      toast.error(`Telegram: ${msg}`);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userText = inputValue.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: time }]);
    setInputValue('');
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const cmd = userText.toLowerCase();
      let botText = '';
      if (cmd.startsWith('/help')) {
        botText = 'Available commands:\n\n/status — Active bots overview\n/pnl — 24h P&L summary\n/alerts — Toggle notifications';
      } else if (cmd.startsWith('/status')) {
        botText = 'Bot Status:\n\n🟢 BTC Predictor — Running\n🟢 Grid Bot — 6 grids active\n🔴 DCA Bot — Stopped\n🟢 Market Maker — Running';
      } else if (cmd.startsWith('/pnl')) {
        botText = '24h Report:\n\n• Net PnL: +$241.80 USDT\n• Trades: 38 (win rate 73%)\n• Max DD: -0.45%';
      } else {
        botText = `Unknown command. Type /help for the list.`;
      }
      setMessages(prev => [...prev, { sender: 'bot', text: botText, timestamp: time }]);
    }, 900);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-primary flex items-center justify-center shadow-lg">
          <MessageSquare size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Telegram Notifications</h2>
          <p className="text-[11px] text-text-muted">Real-time trading alerts via your own Telegram bot</p>
        </div>
        {isConfigured && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-[11px] font-semibold shrink-0">
            <CheckCircle2 size={12} />
            Connected
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 flex-1 min-h-0">

        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Setup Guide */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border/50">
              <Bot size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Setup Guide</span>
            </div>
            <div className="space-y-3.5">
              {([
                {
                  n: 1,
                  title: 'Create a bot',
                  desc: <span>Open Telegram and message <span className="text-primary font-semibold">@BotFather</span>. Send <code className="bg-background/60 px-1 py-0.5 rounded text-[10px] font-mono">/newbot</code> and follow the steps. Copy the API token.</span>,
                },
                {
                  n: 2,
                  title: 'Get your Chat ID',
                  desc: <span>Start your new bot, then message <span className="text-primary font-semibold">@userinfobot</span> and send <code className="bg-background/60 px-1 py-0.5 rounded text-[10px] font-mono">/start</code> to get your numeric chat ID.</span>,
                },
                {
                  n: 3,
                  title: 'Enter credentials below',
                  desc: <span>Paste your token and chat ID, then click <span className="text-primary font-semibold">Save & Test</span> — a confirmation message will arrive in your chat.</span>,
                },
              ] as const).map((step) => (
                <div key={step.n} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary mt-0.5">
                    {step.n}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">{step.title}</div>
                    <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Configuration */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border/50">
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Connect</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Your Chat ID</label>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full mt-1.5 bg-background/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/50 transition-colors"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Send <code className="bg-background/60 px-1 rounded">/start</code> to <span className="text-primary font-semibold">@SoDexPowerOpsBot</span> to get this.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleVerify}
                loading={testStatus === 'testing'}
                icon={<Zap size={13} />}
              >
                {testStatus === 'testing' ? 'Verifying…' : 'Verify & Connect'}
              </Button>
              {testStatus === 'ok' && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle2 size={13} className="text-success shrink-0" />
                  <span className="text-[11px] text-success font-medium">Connected — test message delivered.</span>
                </div>
              )}
              {testStatus === 'error' && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-danger/10 border border-danger/20">
                  <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />
                  <span className="text-[11px] text-danger leading-snug">{testError}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Alert toggles */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1 pb-2.5 border-b border-border/50">
              <Bell size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Notifications</span>
            </div>
            <Toggle
              label="Regime Change Alerts"
              description="Alert when AI detects a market regime shift."
              checked={alertEnabled}
              onChange={setAlertEnabled}
            />
            <Toggle
              label="Daily P&L Reports"
              description="Daily summary of profits, wins, and drawdowns."
              checked={pnlReportEnabled}
              onChange={setPnlReportEnabled}
            />
            <Toggle
              label="Strict Regime Only"
              description="Suppress minor fills — only alert on trend transitions."
              checked={regimeAlertsOnly}
              onChange={setRegimeAlertsOnly}
            />
            <Toggle
              label="Order Fill Confirmations"
              description="Notify when Grid/Market Maker limits fill on SoDEX."
              checked={orderFillsEnabled}
              onChange={setOrderFillsEnabled}
            />
          </Card>
        </div>

        {/* Right column: phone preview */}
        <div className="lg:col-span-3 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Preview</span>
            {!isConfigured && (
              <span className="text-[10px] text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded-full">
                Demo — configure left panel to go live
              </span>
            )}
          </div>
          <div className="w-full max-w-[360px] h-[600px] bg-[#121214] border-[6px] border-[#2A2A2E] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#2A2A2E] rounded-b-2xl z-20 flex items-center justify-center">
              <div className="w-12 h-1 bg-black rounded-full mb-1" />
            </div>
            {/* Status bar */}
            <div className="h-10 bg-[#1e1e24] shrink-0 border-b border-border flex items-end justify-between px-6 pb-2 text-[10px] text-text-muted select-none font-semibold">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex items-center gap-1.5">
                <Smartphone size={10} />
                <span>@SoDexPowerOpsBot</span>
              </div>
            </div>
            {/* Chat */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-[#0C0C0E] scrollbar-thin">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed',
                    m.sender === 'user'
                      ? 'bg-primary text-white self-end rounded-br-sm'
                      : 'bg-[#18181D] border border-border text-text-secondary self-start rounded-bl-sm',
                  )}
                >
                  <div className="whitespace-pre-line">{m.text}</div>
                  <span className="text-[8px] opacity-50 mt-1.5 self-end">{m.timestamp}</span>
                </div>
              ))}
              {isTyping && (
                <div className="bg-[#18181D] border border-border self-start rounded-2xl rounded-bl-sm p-3 flex items-center gap-1">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="p-3 bg-[#16161A] border-t border-border flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="/help  /pnl  /status"
                className="flex-1 bg-background/50 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={handleSend}
                className="w-8 h-8 rounded-xl bg-primary hover:opacity-90 transition-opacity flex items-center justify-center text-white shrink-0"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
