/**
 * Resolves the backend base URL for API calls.
 *
 * Development  : VITE_API_BASE_URL is unset → '' → Vite dev proxy handles /api/*
 * Production   : VITE_API_BASE_URL = https://your-backend.onrender.com
 *                → all /api/* calls go directly to that host
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
