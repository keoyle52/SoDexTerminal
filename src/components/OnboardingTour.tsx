import React, { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, ChevronLeft, ShieldCheck, Cpu, TrendingUp, Bot, CheckCircle2 } from 'lucide-react';

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  highlightCategory: string;
  badge: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Sodex PowerOps 2.0",
    subtitle: "Next-Generation Non-Custodial Trading Suite",
    description: "Built for institutional traders and Web3 visionaries. Experience automated quantitative execution powered by real-time SoSoValue market intelligence and Google Gemini AI.",
    icon: Sparkles,
    highlightCategory: "Platform Overview",
    badge: "Web3 Native"
  },
  {
    title: "100% Non-Custodial Security",
    subtitle: "EIP-712 Typed Data & WalletConnect Relay",
    description: "Your security is our top priority. Sodex PowerOps operates without raw private keys. Authenticate via MetaMask or WalletConnect and delegate temporary, isolated session keys for 24/7 background bots.",
    icon: ShieldCheck,
    highlightCategory: "Security First",
    badge: "Wave 2 Solved"
  },
  {
    title: "AI Alpha & 13-Signal Predictor",
    subtitle: "Multi-Engine BTC Sentiment & Trend Matrix",
    description: "Access our proprietary 13-signal trend engine integrated with Gemini Pro AI to validate market regimes, predict price shifts, and generate actionable trading signals with historical win-rate tracking.",
    icon: Cpu,
    highlightCategory: "AI Intelligence",
    badge: "Proprietary AI"
  },
  {
    title: "Unified Trading Bots Hub",
    subtitle: "Grid, TWAP, DCA & Market Making",
    description: "Deploy automated strategies in seconds. Our unified studio eliminates tab clutter, letting you switch between high-frequency grid liquidity, TWAP algorithmic execution, and smart DCA.",
    icon: Bot,
    highlightCategory: "Execution Engine",
    badge: "Zero-Latency"
  },
  {
    title: "Quant Risk Engine & Backtesting",
    subtitle: "95% VaR Computation & Fee Drag Modeling",
    description: "Protect your portfolio with institutional-grade risk monitoring. Simulate historical performance with accurate 0.08% roundtrip fee drag modeling before committing live capital.",
    icon: TrendingUp,
    highlightCategory: "Risk Controls",
    badge: "Institutional"
  }
];

export const OnboardingTour: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrentStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-backdrop">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-surface border border-border/80 shadow-2xl transition-all duration-300">
        {/* Glow backdrop behind modal */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
              {step.badge}
            </span>
            <span className="text-xs text-text-muted">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-lg shadow-primary/5">
              <Icon size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-text-primary">
                {step.title}
              </h3>
              <p className="text-xs font-medium text-primary">
                {step.subtitle}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-text-secondary">
            {step.description}
          </p>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {TOUR_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep ? 'w-8 bg-primary' : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-white/[0.01]">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-text-muted cursor-not-allowed opacity-50'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <ChevronLeft size={15} />
            Previous
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-lg bg-primary text-background hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <CheckCircle2 size={16} />
              Start Trading
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1))}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-primary text-background hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              Next
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
