import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { geminiRouter } from './routes/gemini';
import { sosovalueRouter } from './routes/sosovalue';
import { telegramRouter } from './routes/telegram';
import { startBot } from './bot';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
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
