import { useAuthStore } from '../../stores/authStore';

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  published_at: string;
  tickers: string[];
  categories: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral' | null;
  ai_summary: string | null;
  is_breaking: boolean;
  image_url: string | null;
}

function apiHeaders(): HeadersInit {
  const token = useAuthStore.getState().apiToken;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function fetchNews(params: {
  tickers?: string; categories?: string; sentiment?: string;
  source?: string; page?: number; limit?: number;
} = {}): Promise<{ items: NewsItem[]; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params.tickers)    qs.set('tickers', params.tickers);
  if (params.categories) qs.set('categories', params.categories);
  if (params.sentiment)  qs.set('sentiment', params.sentiment);
  if (params.source)     qs.set('source', params.source);
  qs.set('page',  String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 30));
  const res = await fetch(`/api/news?${qs}`, { headers: apiHeaders() });
  if (!res.ok) throw new Error('Failed to fetch news');
  return res.json() as Promise<{ items: NewsItem[]; page: number; limit: number }>;
}

export async function fetchTickerNews(ticker: string): Promise<{ items: NewsItem[] }> {
  const res = await fetch(`/api/news/ticker/${ticker}`, { headers: apiHeaders() });
  if (!res.ok) throw new Error('Failed to fetch ticker news');
  return res.json() as Promise<{ items: NewsItem[] }>;
}

export async function fetchBreakingNews(): Promise<{ items: NewsItem[] }> {
  const res = await fetch('/api/news/breaking', { headers: apiHeaders() });
  if (!res.ok) return { items: [] };
  return res.json() as Promise<{ items: NewsItem[] }>;
}

export async function refreshNews(): Promise<{ newItems: number }> {
  const res = await fetch('/api/news/refresh', { method: 'POST', headers: apiHeaders() });
  if (!res.ok) throw new Error('Refresh failed');
  return res.json() as Promise<{ newItems: number }>;
}
