/**
 * Resolves the backend base URL for API calls.
 *
 * Development  : VITE_API_BASE_URL is unset → '' → Vite dev proxy handles /api/*
 * Production   : VITE_API_BASE_URL = https://your-backend.onrender.com
 *                → all /api/* calls go directly to that host
 */
const getApiBase = (): string => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envUrl) {
    if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) return envUrl;
    return `https://${envUrl}`;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  }
  return 'https://sodexterminal-production.up.railway.app';
};

export const API_BASE: string = getApiBase();
