import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchOHLCV } from '../services/alphaVantage';
import type { OHLCVBar, TimeRange } from '../types';

// Alpha Vantage free: 25 calls/day — cache aggressively
const STALE = 5 * 60 * 1000; // 5 minutes in memory

export function useOHLCV(ticker: string, range: TimeRange) {
  return useQuery<OHLCVBar[]>({
    queryKey: ['ohlcv', ticker, range],
    queryFn: () => fetchOHLCV(ticker, range),
    staleTime: STALE,
    gcTime: 24 * 60 * 60 * 1000, // keep in cache 24hrs
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
