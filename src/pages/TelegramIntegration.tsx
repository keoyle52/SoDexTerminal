import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Smartphone, ShieldCheck, Zap, Bell, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Toggle } from '../components/common/Input';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export const TelegramIntegration: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: 'Welcome to SoDEX PowerOps Assistant! 🚀\n\nI can monitor your positions, trigger bot alerts, and allow you to configure strategies directly from your chat.\n\nType /help to see all available commands.', timestamp: '14:20' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [tgCode, setTgCode] = useState('SODEX-982-XYZ');
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [pnlReportEnabled, setPnlReportEnabled] = useState(true);
  const [regimeAlertsOnly, setRegimeAlertsOnly] = useState(false);
  const [orderFillsEnabled, setOrderFillsEnabled] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: currentTime }]);
    setInputValue('');
    setIsTyping(true);

    // Simulate bot response
    setTimeout(() => {
      setIsTyping(false);
      let botText = '';
      
      const cmd = userText.toLowerCase();
      if (cmd.startsWith('/help')) {
        botText = 'Available Commands:\n\n' +
                  '• `/status` - View active trading bots status\n' +
                  '• `/pnl` - Get 24h P&L summary and win rate\n' +
                  '• `/start <bot>` - Turn on specific trading bot\n' +
                  '• `/stop <bot>` - Turn off specific trading bot\n' +
                  '• `/alerts` - Toggle real-time regime change alerts';
      } else if (cmd.startsWith('/status')) {
        botText = 'Active Bot Status (SoDEX Terminal):\n\n' +
                  '🤖 **BTC Predictor**: 🟢 RUNNING (Auto-Trade active)\n' +
                  '📈 **Grid Bot**: 🟢 RUNNING (6 open grids)\n' +
                  '🔁 **DCA Bot**: 🔴 STOPPED\n' +
                  '📊 **Market Maker**: 🟢 RUNNING (Post-Only GTD active)\n\n' +
                  'Type `/stop <bot>` to halt execution.';
      } else if (cmd.startsWith('/pnl')) {
        botText = 'Daily P&L Report 📊:\n\n' +
                  '• **Cumulative 24h PnL**: +$241.80 USDT (▲ 1.42%)\n' +
                  '• **Trades executed**: 38\n' +
                  '• **Win Rate**: 73.68% (28 W / 10 L)\n' +
                  '• **Max Drawdown**: -0.45%';
      } else if (cmd.startsWith('/start')) {
        const botName = userText.split(' ')[1] || 'bot';
        botText = `🟢 Bot command received! Starting **${botName}** on SoDEX platform...\n\nSynchronization successful. Active EIP-712 orders placed.`;
      } else if (cmd.startsWith('/stop')) {
        const botName = userText.split(' ')[1] || 'bot';
        botText = `🔴 Stopping **${botName}**... Cancel-all orders broadcasted. In-memory states cleared successfully.`;
      } else if (cmd.startsWith('/alerts')) {
        botText = '🔔 Alerts settings updated! Real-time AI regime changes and EIP-712 order fills are now ENABLED.';
      } else {
        botText = `Unknown command "${userText}". Type \`/help\` to list all available control commands.`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botText, timestamp: currentTime }]);
    }, 1200);
  };

  const generateNewCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'SODEX-';
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += '-';
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setTgCode(code);
    toast.success('Generated new Telegram linking code!');
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-6 overflow-y-auto">
      {/* Page Title Header */}
      <div className="shrink-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <MessageSquare size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Telegram Assistant Bot</h2>
          <p className="text-[11px] text-text-muted">
            Configure alerts, check P&L, and command your portfolio via Telegram.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
        
        {/* Configuration Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <ShieldCheck size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Linking & Authorization</h3>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs text-text-muted leading-relaxed">
                To link your SoDEX Terminal with Telegram, message our bot <strong className="text-text-primary">@SoDexPowerOpsBot</strong> and send the authorization code below:
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 font-mono text-center text-sm font-bold text-primary bg-background/50 p-2.5 rounded-xl border border-border">
                  {tgCode}
                </div>
                <Button variant="outline" size="sm" onClick={generateNewCode} title="Generate Code">
                  <RefreshCw size={13} />
                </Button>
              </div>

              <div className="mt-4 p-3 bg-primary/5 border border-primary/15 rounded-xl flex items-start gap-2.5">
                <Zap size={15} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Dual-signed EIP-712 triggers will request verification on your phone before execution for maximum security.
                </p>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <Bell size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Alert Configurator</h3>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <Toggle
                label="Regime Change Notifications"
                description="Get instant alerts when AI Orchestrator detects market regime shifts."
                checked={alertEnabled}
                onChange={setAlertEnabled}
              />
              <Toggle
                label="Daily Performance Reports"
                description="Receive automated summaries of bot profits, wins, and drawdowns."
                checked={pnlReportEnabled}
                onChange={setPnlReportEnabled}
              />
              <Toggle
                label="Strict Regime Alerts Only"
                description="Suppress minor order fill alerts; only alert on trend transitions."
                checked={regimeAlertsOnly}
                onChange={setRegimeAlertsOnly}
              />
              <Toggle
                label="EIP-712 Order Execution Fills"
                description="Notify when Grid/Market Maker limits are filled on SoDEX gateway."
                checked={orderFillsEnabled}
                onChange={setOrderFillsEnabled}
              />
            </div>
          </Card>
        </div>

        {/* Smartphone Simulator Column */}
        <div className="lg:col-span-3 flex flex-col items-center">
          
          {/* Smartphone Shell Frame */}
          <div className="w-full max-w-[360px] h-[580px] bg-[#121214] border-[6px] border-[#2A2A2E] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Speaker & Camera Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#2A2A2E] rounded-b-2xl z-20 flex items-center justify-center">
              <div className="w-12 h-1 bg-black rounded-full mb-1" />
            </div>

            {/* Smartphone Header / Status Bar */}
            <div className="h-10 bg-[#1e1e24] shrink-0 border-b border-border flex items-end justify-between px-6 pb-2 text-[10px] text-text-muted select-none font-semibold">
              <span>14:24</span>
              <div className="flex items-center gap-1.5">
                <Smartphone size={10} />
                <span>@SoDexPowerOpsBot</span>
              </div>
            </div>

            {/* Telegram App Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-[#0C0C0E] scrollbar-thin">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed relative',
                    m.sender === 'user'
                      ? 'bg-primary text-white self-end rounded-br-sm'
                      : 'bg-[#18181D] border border-border text-text-secondary self-start rounded-bl-sm'
                  )}
                >
                  <div className="whitespace-pre-line">{m.text}</div>
                  <span className="text-[8px] opacity-50 mt-1.5 self-end">{m.timestamp}</span>
                </div>
              ))}

              {isTyping && (
                <div className="bg-[#18181D] border border-border text-text-muted self-start rounded-2xl rounded-bl-sm p-3 text-xs flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-[#16161A] border-t border-border flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type /pnl, /status, /help..."
                className="flex-1 bg-background/50 border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary transition-colors"
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
