// Singleton WebSocket manager for Finnhub live price stream.
// The Finnhub API key is NEVER held client-side for security reasons.
// Live WebSocket ticks are therefore disabled; components fall back to
// REST polling (every 30 s via React Query) which goes through the
// server-side proxy at /api/market-data/finnhub/quote.
const MOCK_MODE = true; // WS disabled — no client-side API key

export interface PriceTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

type TickCallback = (tick: PriceTick) => void;

class FinnhubWebSocketManager {
  private ws: WebSocket | null = null;
  private subscribers = new Map<string, Set<TickCallback>>();
  private reconnectDelay = 1000;
  // reconnect timer handle (assigned to suppress unused-var; may be used for clearTimeout later)
  private isConnecting = false;

  subscribe(symbol: string, cb: TickCallback) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(cb);

    // Ensure connected
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(symbol);
    }
  }

  unsubscribe(symbol: string, cb: TickCallback) {
    const set = this.subscribers.get(symbol);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) {
      this.subscribers.delete(symbol);
      this.sendUnsubscribe(symbol);
    }
  }

  private connect() {
    if (MOCK_MODE || this.isConnecting) return;
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) return;

    this.isConnecting = true;
    // NOTE: wss://ws.finnhub.io connection intentionally omitted — no client key.
    this.ws = null;
    this.isConnecting = false;
    return;

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.reconnectDelay = 1000; // reset on success
      // Re-subscribe all existing symbols
      for (const symbol of this.subscribers.keys()) {
        this.sendSubscribe(symbol);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          for (const tick of msg.data) {
            const cbs = this.subscribers.get(tick.s);
            if (cbs) {
              const priceTick: PriceTick = {
                symbol: tick.s,
                price: tick.p,
                volume: tick.v,
                timestamp: tick.t,
              };
              cbs.forEach(cb => cb(priceTick));
            }
          }
        }
      } catch {
        // malformed message, ignore
      }
    };

    this.ws.onerror = () => {
      this.isConnecting = false;
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      if (this.subscribers.size === 0) return;
      // Exponential backoff reconnect
      void setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.connect();
      }, this.reconnectDelay);
    };
  }

  private sendSubscribe(symbol: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  private sendUnsubscribe(symbol: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  }

  get connectionStatus(): 'connected' | 'connecting' | 'disconnected' | 'mock' {
    if (MOCK_MODE) return 'mock';
    if (!this.ws) return 'disconnected';
    if (this.ws.readyState === WebSocket.OPEN) return 'connected';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting';
    return 'disconnected';
  }
}

// Single shared instance
export const finnhubWS = new FinnhubWebSocketManager();
