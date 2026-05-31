import { Router, Request, Response } from 'express';
import axios from 'axios';
import https from 'https';

const router = Router();

const DOMAIN_OPENAPI = 'https://openapi.sosovalue.com';
const DOMAIN_API_XYZ = 'https://api.sosovalue.xyz';

// Wildcard proxy — all GET/POST to /api/sosovalue/* are forwarded to SoSoValue
// with our server-side API key. The path determines which base domain to use:
//   /openapi/v2/etf/* → api.sosovalue.xyz
//   everything else   → openapi.sosovalue.com
router.all('*', async (req: Request, res: Response) => {
  const path = req.path === '/' ? '' : req.path;
  const isEtf = path.includes('/openapi/v2/etf');
  const baseUrl = isEtf ? DOMAIN_API_XYZ : DOMAIN_OPENAPI;
  const targetUrl = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (apiKey) headers['x-soso-api-key'] = apiKey;

  try {
    const response = await axios({
      method: req.method as 'get' | 'post',
      url: targetUrl,
      params: req.query,
      data: req.method !== 'GET' && Object.keys(req.body as object).length > 0
        ? req.body
        : undefined,
      headers,
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    res.json(response.data);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 502;
      const data = (err.response?.data as object | undefined) ?? { error: err.message };
      res.status(status).json(data);
    } else {
      res.status(502).json({ error: String(err) });
    }
  }
});

export { router as sosovalueRouter };
