import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { geminiRouter } from './routes/gemini';
import { sosovalueRouter } from './routes/sosovalue';
import { telegramRouter } from './routes/telegram';
import { startBot } from './bot';

const app = express();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.use('/api/gemini', geminiRouter);
app.use('/api/sosovalue', sosovalueRouter);
app.use('/api/telegram', telegramRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.listen(PORT, () => {
  console.log(`[SoDEX Backend] Listening on http://localhost:${PORT}`);
  startBot();
});
