import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export type WsEventType =
  | 'SUBSCRIBE_ROOM'
  | 'BROADCAST_RECEIVED'
  | 'CONTACT_REQUEST_RECEIVED'
  | 'CONTACT_REQUEST_ACCEPTED'
  | 'USER_PRESENCE_UPDATE'
  | 'HEARTBEAT_ACK'
  | 'IB_MESSAGE'
  | 'ERROR';

export interface WsEvent {
  type: WsEventType;
  [key: string]: unknown;
}

type Handler = (event: WsEvent) => void;

// Singleton WebSocket shared across all hook consumers
let globalWs: WebSocket | null = null;
let globalHandlers = new Set<Handler>();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let currentToken: string | null = null;

function connect(token: string) {
  if (globalWs && globalWs.readyState <= WebSocket.OPEN) return;
  currentToken = token;

  // In dev: connect to local API server on :3001
  // In prod: Vercel cannot proxy WebSockets, so connect directly to the HF Space API.
  //          Set VITE_WS_URL=wss://hitarth-cpu-bloomterminal-api.hf.space/ws in Vercel env vars.
  let url: string;
  if (import.meta.env.DEV) {
    url = `ws://${window.location.hostname}:3001/ws?token=${encodeURIComponent(token)}`;
  } else {
    const wsBase = (import.meta.env.VITE_WS_URL as string | undefined)
      ?? `wss://${window.location.host}/ws`;
    url = `${wsBase}?token=${encodeURIComponent(token)}`;
  }

  globalWs = new WebSocket(url);

  globalWs.onopen = () => {
    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (globalWs?.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: 'HEARTBEAT' }));
      }
    }, 20_000);
  };

  globalWs.onmessage = (e) => {
    try {
      const event: WsEvent = JSON.parse(e.data as string);
      globalHandlers.forEach(h => h(event));
    } catch { /* ignore malformed */ }
  };

  globalWs.onclose = () => {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    globalWs = null;
    // Auto-reconnect after 3s if we still have a token
    if (currentToken) {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => connect(currentToken!), 3_000);
    }
  };

  globalWs.onerror = () => globalWs?.close();
}

function disconnect() {
  currentToken = null;
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  globalWs?.close();
  globalWs = null;
}

/** Send an event to the server via the shared WebSocket connection. */
export function sendWsEvent(event: WsEvent): void {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(event));
  }
}

/**
 * Subscribe to WebSocket events. Automatically connects on mount (if authed)
 * and disconnects when the last subscriber unmounts.
 */
export function useWebSocket(onEvent: Handler): void {
  const { apiToken } = useAuthStore();
  const handlerRef = useRef<Handler>(onEvent);
  handlerRef.current = onEvent;

  const stableHandler = useCallback((e: WsEvent) => handlerRef.current(e), []);

  useEffect(() => {
    if (!apiToken) return;

    globalHandlers.add(stableHandler);
    connect(apiToken);

    return () => {
      globalHandlers.delete(stableHandler);
      if (globalHandlers.size === 0) disconnect();
    };
  }, [apiToken, stableHandler]);
}
