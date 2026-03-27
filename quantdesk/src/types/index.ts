// ─── Market Data ───────────────────────────────────────────────────────────────
export interface Security {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  assetClass: 'equity' | 'fixed-income' | 'fx' | 'commodity' | 'crypto';
  currency: string;
}

export interface PriceData {
  ticker: string;
  last: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  vwap: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  timestamp: number;
}

export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketEvent {
  type: 'PRICE_UPDATE' | 'TRADE' | 'QUOTE' | 'STATUS';
  ticker: string;
  data: Partial<PriceData>;
  timestamp: number;
}

// ─── News ──────────────────────────────────────────────────────────────────────
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: number;
  summary: string;
  tags: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  tickers: string[];
  url?: string;
}

// ─── Crypto ────────────────────────────────────────────────────────────────────
/**
 * Wire format for an AES-256-GCM encrypted message.
 * This is what gets transmitted over WebSocket — plaintext never leaves the client.
 */
export interface EncryptedPayload {
  /** Schema version — always 1. */
  v: 1;
  /** Base64-encoded 12-byte random IV (unique per message). */
  iv: string;
  /** Base64-encoded ciphertext; last 16 bytes are the GCM auth tag. */
  ct: string;
  /** Additional Authenticated Data — chatId + senderId, MAC'd but not encrypted. */
  aad: {
    chatId: string;
    senderId: string;
  };
}

// ─── Messaging ─────────────────────────────────────────────────────────────────
export interface ChatContact {
  id: string;
  name: string;
  firm: string;
  status: 'active' | 'idle' | 'offline';
  unread: number;
  lastMessage?: string;
  lastMessageTime?: number;
  type: 'forum' | 'group' | 'counterparty' | 'app' | 'individual';
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'text' | 'structured' | 'system';
  parsed?: ParsedInquiry;
  reactions?: { emoji: string; count: number }[];
  /** Present when the message was encrypted client-side before storage/transmission. */
  encrypted?: EncryptedPayload;
}

export interface ParsedInquiry {
  ticker: string | null;
  side: 'BUY' | 'SELL' | null;
  quantity: number | null;
  price: number | null;
  currency: string | null;
  intent: string | null;
  confidence: number;
}

// ─── Financials ────────────────────────────────────────────────────────────────
export interface EarningsMetric {
  label: string;
  actual: number | null;
  consensus: number | null;
  gsEst: number | null;
  jpmEst: number | null;
  msEst: number | null;
  unit: string;
  beatMissPct: number | null;
  category: 'highlight' | 'segment' | 'regional' | 'stats' | 'fcf';
}

// ─── Risk ──────────────────────────────────────────────────────────────────────
export interface Position {
  ticker: string;
  name: string;
  qty: number;
  avgCost: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  delta: number;
  beta: number;
  var1d: number;
  sector: string;
}

export interface RiskMetrics {
  portfolioVar95: number;
  portfolioVar99: number;
  cvar: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  beta: number;
  totalValue: number;
  totalPnl: number;
}

// ─── Trading ───────────────────────────────────────────────────────────────────
export interface Order {
  id: string;
  ticker: string;
  side: 'BUY' | 'SELL' | 'SHORT';
  qty: number;
  filled: number;
  remaining: number;
  orderType: 'LIMIT' | 'MARKET' | 'STOP' | 'ALGO';
  price: number | null;
  status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED';
  trader: string;
  timestamp: number;
  account: string;
}

// ─── Fixed Income ──────────────────────────────────────────────────────────────
export interface Bond {
  isin: string;
  issuer: string;
  coupon: number;
  maturity: string;
  rating: string;
  sector: string;
  amtOutstanding: number;
  bid: number;
  ask: number;
  mid: number;
  yield: number;
  gSpread: number;
  iSpread: number;
  structure: string;
  couponFreq: string;
  dayCount: string;
  issueDate: string;
}

// ─── WebSocket Events ──────────────────────────────────────────────────────────
export interface IBEvent {
  type: 'MESSAGE' | 'READ' | 'DELIVERY' | 'TYPING';
  chatId: string;
  senderId: string;
  data: Partial<ChatMessage>;
}

export interface AlertEvent {
  type: 'PRICE_ALERT' | 'NEWS_ALERT' | 'COMPLIANCE_FLAG';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  timestamp: number;
}

// ─── UI State ──────────────────────────────────────────────────────────────────
export type ActiveModule = 'markets' | 'portfolio' | 'research' | 'trading' | 'analytics' | 'messaging' | 'settings';
export type TimeRange = '1D' | '3D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'Max';
export type ChartType = 'candlestick' | 'line' | 'area';
