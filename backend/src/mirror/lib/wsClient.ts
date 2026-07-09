import WebSocket from 'ws';
import type { SodexNetwork } from './signer';

const WS_ENDPOINTS = {
  mainnet: { spot: 'wss://mainnet-gw.sodex.dev/ws/spot', perps: 'wss://mainnet-gw.sodex.dev/ws/perps' },
  testnet: { spot: 'wss://testnet-gw.sodex.dev/ws/spot', perps: 'wss://testnet-gw.sodex.dev/ws/perps' },
} as const;

export interface SodexAccountTrade {
  E: number;
  s: string;
  S: string;
  p: string;
  q: string;
  ordID?: string;
  clOrdID?: string;
  positionSide?: string;
  reduceOnly?: boolean;
  t?: number;
}

type TradeHandler = (trade: SodexAccountTrade) => void;

export class AccountTradeWatcher {
  private ws: WebSocket | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private closedByUser = false;
  private reconnectDelayMs = 1000;

  constructor(
    private network: SodexNetwork,
    private market: 'spot' | 'perps',
    private accountId: string,
    private onTrade: TradeHandler,
    private onStatus?: (status: 'connected' | 'disconnected' | 'error', detail?: string) => void
  ) {}

  start() {
    this.closedByUser = false;
    this.connect();
  }

  stop() {
    this.closedByUser = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.ws?.close();
  }

  private connect() {
    const url = WS_ENDPOINTS[this.network][this.market];
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.reconnectDelayMs = 1000;
      this.onStatus?.('connected');
      this.ws?.send(
        JSON.stringify({
          op: 'subscribe',
          id: 1,
          params: { channel: 'accountTrade', user: this.accountId },
        })
      );
      this.heartbeat = setInterval(() => {
        this.ws?.send(JSON.stringify({ op: 'ping' }));
      }, 20_000);
    });

    this.ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.op === 'pong' || msg.op === 'subscribe') return;
      if (msg.channel === 'accountTrade' && Array.isArray(msg.data)) {
        for (const trade of msg.data as SodexAccountTrade[]) this.onTrade(trade);
      } else if (msg.channel === 'accountTrade' && msg.data) {
        this.onTrade(msg.data as SodexAccountTrade);
      }
    });

    this.ws.on('close', () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.onStatus?.('disconnected');
      if (!this.closedByUser) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      this.onStatus?.('error', String(err));
    });
  }

  private scheduleReconnect() {
    setTimeout(() => this.connect(), this.reconnectDelayMs);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30_000);
  }
}
