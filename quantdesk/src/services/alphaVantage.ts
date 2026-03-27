import type { OHLCVBar } from '../types';
import type { TimeRange } from '../types';
import { generateOHLCV } from './mockData';

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY as string | undefined;
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const BASE = '/api/alphavantage/query';

function isMock() {
  return MOCK_MODE || !API_KEY;
}

const INTRADAY_RANGES: TimeRange[] = ['1D', '3D'];

function filterByRange(bars: OHLCVBar[], range: TimeRange): OHLCVBar[] {
  const now = Date.now();
  const cutoffs: Partial<Record<TimeRange, number>> = {
    '1D':  now - 1  * 86400000,
    '3D':  now - 3  * 86400000,
    '1M':  now - 30 * 86400000,
    '6M':  now - 180 * 86400000,
    'YTD': new Date(new Date().getFullYear(), 0, 1).getTime(),
    '1Y':  now - 365 * 86400000,
    '5Y':  now - 5 * 365 * 86400000,
    'Max': 0,
  };
  const cutoff = cutoffs[range] ?? 0;
  return bars.filter(b => b.timestamp >= cutoff);
}

// ─── Intraday (1D, 3D) ─────────────────────────────────────────────────────────
async function fetchIntraday(ticker: string): Promise<OHLCVBar[]> {
  const url = `${BASE}?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=5min&outputsize=full&apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('AV intraday request failed');

  const data = await res.json();
  if (data['Note'] || data['Information']) {
    throw new Error('Alpha Vantage rate limit hit');
  }

  const series = data['Time Series (5min)'] as Record<string, Record<string, string>>;
  if (!series) throw new Error('No intraday data');

  return Object.entries(series)
    .map(([dateStr, v]) => ({
      timestamp: new Date(dateStr).getTime(),
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
      volume: parseInt(v['5. volume']),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Daily (1M and above) ──────────────────────────────────────────────────────
async function fetchDaily(ticker: string, outputsize: 'compact' | 'full' = 'full'): Promise<OHLCVBar[]> {
  const url = `${BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${ticker}&outputsize=${outputsize}&apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('AV daily request failed');

  const data = await res.json();
  if (data['Note'] || data['Information']) {
    throw new Error('Alpha Vantage rate limit hit');
  }

  const series = data['Time Series (Daily)'] as Record<string, Record<string, string>>;
  if (!series) throw new Error('No daily data');

  return Object.entries(series)
    .map(([dateStr, v]) => ({
      timestamp: new Date(dateStr).getTime(),
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['5. adjusted close']), // use adjusted
      volume: parseInt(v['6. volume']),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Public API ────────────────────────────────────────────────────────────────
export async function fetchOHLCV(ticker: string, range: TimeRange): Promise<OHLCVBar[]> {
  if (isMock()) {
    const days = { '1D': 1, '3D': 3, '1M': 30, '6M': 180, 'YTD': 90, '1Y': 252, '5Y': 1260, 'Max': 2520 };
    return generateOHLCV(ticker, days[range] ?? 252);
  }

  try {
    let all: OHLCVBar[];
    if (INTRADAY_RANGES.includes(range)) {
      all = await fetchIntraday(ticker);
    } else {
      const outputsize = ['1M', '6M', 'YTD'].includes(range) ? 'compact' : 'full';
      all = await fetchDaily(ticker, outputsize);
    }
    return filterByRange(all, range);
  } catch (err) {
    console.warn(`[AV] Falling back to mock for ${ticker}:`, err);
    const days = { '1D': 1, '3D': 3, '1M': 30, '6M': 180, 'YTD': 90, '1Y': 252, '5Y': 1260, 'Max': 2520 };
    return generateOHLCV(ticker, days[range] ?? 252);
  }
}
