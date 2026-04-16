import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';

const BASE_URL = 'https://openapi.sosovalue.com';

export const sosoValueClient = axios.create({ baseURL: BASE_URL });

sosoValueClient.interceptors.request.use((config) => {
  const { sosoApiKey } = useSettingsStore.getState();
  if (sosoApiKey) {
    config.headers['x-soso-api-key'] = sosoApiKey;
  }
  return config;
});

sosoValueClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0) {
      throw new Error(String(data.msg ?? `SosoValue API error (code=${data.code})`));
    }
    return data;
  },
  (error) => Promise.reject(error),
);
