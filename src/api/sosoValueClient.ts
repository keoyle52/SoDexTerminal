import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';

// SosoValue has TWO base URLs used across different endpoints:
// - https://openapi.sosovalue.com  (coin list, news)
// - https://api.sosovalue.xyz      (ETF endpoints — used in sample requests)
// Both are behind Cloudflare and accept the same x-soso-api-key header.
// We use openapi.sosovalue.com as the single base (it works for all endpoints).
const BASE_URL = 'https://openapi.sosovalue.com';

function makeClient() {
  const client = axios.create({ baseURL: BASE_URL });

  client.interceptors.request.use((config) => {
    const { sosoApiKey } = useSettingsStore.getState();
    if (sosoApiKey) {
      config.headers['x-soso-api-key'] = sosoApiKey;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const body = response.data;
      // SosoValue uses code=0 for success, code=1 (or 4xxxxx) for errors.
      if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
        const msg =
          body.msg ??
          body.message ??
          `SosoValue error (code=${body.code})`;
        throw new Error(String(msg));
      }
      // Return the full body so services can access .data, .code etc.
      return body;
    },
    (error) => {
      // Extract a readable message from Axios HTTP errors (e.g. 401, 429)
      const apiMsg =
        error?.response?.data?.msg ??
        error?.response?.data?.message ??
        error?.message ??
        'Network error';
      const status = error?.response?.status;
      return Promise.reject(new Error(`[${status ?? 'ERR'}] ${apiMsg}`));
    },
  );

  return client;
}

export const sosoValueClient = makeClient();
