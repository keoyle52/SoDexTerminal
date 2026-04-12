/**
 * Generic WebSocket Manager for SoDEX
 * Handles auto-reconnect with exponential backoff, ping/pong heartbeats, and state management.
 */

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export class WSManager {
  private url: string;
  private ws: WebSocket | null = null;
  private autoReconnect: boolean = true;
  private reconnectAttempt: number = 0;
  private maxReconnectDelay: number = 30000;
  
  private pingInterval: any = null;
  private pongTimeout: any = null;
  
  public status: ConnectionStatus = 'disconnected';
  private subscriptions: Set<string> = new Set();
  
  // Callbacks
  public onMessage: ((data: any) => void) | null = null;
  public onStatusChange: ((status: ConnectionStatus) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setStatus('connecting');
    this.autoReconnect = true;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.setStatus('connected');
      this.reconnectAttempt = 0;
      this.startHeartbeat();
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.op === 'pong') {
          this.handlePong();
        } else if (this.onMessage) {
           this.onMessage(data);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.setStatus('disconnected');
      if (this.autoReconnect) {
        this.reconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('WS Error:', err);
      // Let onclose handle the actual reconnection logic
    };
  }

  public disconnect() {
    this.autoReconnect = false;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  public send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public subscribe(params: any) {
    const subStr = JSON.stringify(params);
    this.subscriptions.add(subStr);
    this.send({ op: 'subscribe', params });
  }

  public unsubscribe(params: any) {
    const subStr = JSON.stringify(params);
    this.subscriptions.delete(subStr);
    this.send({ op: 'unsubscribe', params });
  }

  private resubscribeAll() {
    this.subscriptions.forEach((subStr) => {
       const params = JSON.parse(subStr);
       this.send({ op: 'subscribe', params });
    });
  }

  private reconnect() {
    // exponential backoff: 1s, 2s, 4s, 8s, 16s... max 30s
    let delay = Math.pow(2, this.reconnectAttempt) * 1000;
    if (delay > this.maxReconnectDelay) {
      delay = this.maxReconnectDelay;
    }
    this.reconnectAttempt++;
    
    // Safety ping to log retry in UI/console visually
    console.log(`WS reconnecting in ${delay}ms... (Attempt: ${this.reconnectAttempt})`);
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      this.send({ op: 'ping' });
      // Wait 5 seconds for pong response
      this.pongTimeout = setTimeout(() => {
        console.warn('WS Pong timeout, forcefully reconnecting...');
        // Force closing the socket triggers the onclose logic which handles reconnects.
        if (this.ws) this.ws.close(); 
      }, 5000);
    }, 30000); // Trigger ping every 30 seconds
  }

  private handlePong() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private cleanup() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    this.pingInterval = null;
    this.pongTimeout = null;
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus);
    }
  }
}
