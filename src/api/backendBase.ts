/**
 * Resolves the backend base URL for API calls.
 *
 * Development  : VITE_API_BASE_URL is unset → '' → Vite dev proxy handles /api/*
 * Production   : VITE_API_BASE_URL = https://your-backend.onrender.com
 *                → all /api/* calls go directly to that host
 */
const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE: string = envUrl
  ? envUrl
  : (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:3001'
    : '';
