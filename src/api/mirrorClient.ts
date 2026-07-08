import axios from 'axios';

const BASE = '/api/mirror';

export async function resolveWalletAddress(address: string, network: string) {
  const res = await axios.get(`${BASE}/wallet/resolve`, { params: { address, network } });
  return res.data;
}

export async function analyzeMirrorWallet(address: string, accountId: number, network: string, geminiKey: string) {
  const res = await axios.post(`${BASE}/analyze`, { address, accountId, network }, {
    headers: { 'x-gemini-api-key': geminiKey },
  });
  return res.data;
}

export async function startCopySession(data: any) {
  const res = await axios.post(`${BASE}/copy/start`, data);
  return res.data;
}

export async function stopCopySession(sessionId: string, action: 'pause' | 'resume' | 'revoke') {
  const res = await axios.post(`${BASE}/copy/stop`, { sessionId, action });
  return res.data;
}

export async function deleteCopySession(sessionId: string) {
  const res = await axios.post(`${BASE}/copy/delete`, { sessionId });
  return res.data;
}

export async function fetchCopySessions() {
  const res = await axios.get(`${BASE}/copy/sessions`);
  return res.data;
}

export async function fetchSessionLog(sessionId: string) {
  const res = await axios.get(`${BASE}/copy/sessions/${sessionId}/log`);
  return res.data;
}

export async function fetchPendingTrades() {
  const res = await axios.get(`${BASE}/copy/pending`);
  return res.data;
}

export async function handlePendingAction(pendingTradeId: string, action: 'approve' | 'reject') {
  const res = await axios.post(`${BASE}/copy/pending/action`, { pendingTradeId, action });
  return res.data;
}
