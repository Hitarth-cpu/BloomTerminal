import { useQuery } from '@tanstack/react-query';
import { fetchQuote, fetchAllQuotes } from '../services/finnhub';
import type { PriceData } from '../types';

const STALE    = 30_000;  // 30 s
const INTERVAL = 60_000;  // refetch every 60 s — matches server-side cache TTL

export function useFinnhubQuote(ticker: string) {
  return useQuery<PriceData>({
    queryKey: ['quote', ticker],
    queryFn: () => fetchQuote(ticker),
    staleTime: STALE,
    refetchInterval: INTERVAL,
    placeholderData: (prev) => prev,
    retry: 1,          // default 3 retries × many symbols = log spam on failures
    retryDelay: 5_000,
  });
}

export function useBatchQuotes(tickers: string[]) {
  return useQuery<PriceData[]>({
    queryKey: ['quotes', tickers.join(',')],
    queryFn: () => fetchAllQuotes(tickers),
    staleTime: STALE,
    refetchInterval: INTERVAL,
    placeholderData: (prev) => prev,
    enabled: tickers.length > 0,
    retry: 1,
    retryDelay: 5_000,
  });
}
