import { redis } from '../../db/redis';

export interface CachedPrice {
  ticker:    string;
  last:      number;
  change:    number;
  changePct: number;
  bid:       number;
  ask:       number;
  volume:    number;
  timestamp: number;
}

export interface TickerStripItem {
  sym:    string;
  price:  number;
  change: number;
  pct:    number;
  up:     boolean;
}

// ─── Individual ticker prices (TTL 5s) ────────────────────────────────────────

export async function setPrice(ticker: string, data: CachedPrice): Promise<void> {
  await redis.set(`price:${ticker}`, JSON.stringify(data), 'EX', 5);
}

export async function getPrice(ticker: string): Promise<CachedPrice | null> {
  const raw = await redis.get(`price:${ticker}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as CachedPrice; } catch { return null; }
}

// ─── Global ticker strip (TTL 10s) ────────────────────────────────────────────

export async function setTickerStrip(items: TickerStripItem[]): Promise<void> {
  await redis.set('ticker:strip', JSON.stringify(items), 'EX', 10);
}

export async function getTickerStrip(): Promise<TickerStripItem[] | null> {
  const raw = await redis.get('ticker:strip');
  if (!raw) return null;
  try { return JSON.parse(raw) as TickerStripItem[]; } catch { return null; }
}

// ─── Historical daily OHLCV (TTL 24h) ────────────────────────────────────────

export async function setDailyOHLCV(ticker: string, date: string, data: unknown): Promise<void> {
  await redis.set(`price:hist:${ticker}:${date}`, JSON.stringify(data), 'EX', 86_400);
}

export async function getDailyOHLCV(ticker: string, date: string): Promise<unknown | null> {
  const raw = await redis.get(`price:hist:${ticker}:${date}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export async function setPresence(userId: string, status: 'online' | 'away'): Promise<void> {
  await redis.set(`chat:online:${userId}`, status, 'EX', 30);
}

export async function getOnlineUsers(userIds: string[]): Promise<Record<string, string | null>> {
  if (userIds.length === 0) return {};
  const pipeline = redis.pipeline();
  userIds.forEach(id => pipeline.get(`chat:online:${id}`));
  const results = await pipeline.exec();
  return Object.fromEntries(
    userIds.map((id, i) => [id, results?.[i]?.[1] as string | null ?? null])
  );
}
