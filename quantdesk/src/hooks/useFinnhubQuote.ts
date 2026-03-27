import { useQuery } from '@tanstack/react-query';
import { fetchQuote, fetchAllQuotes } from '../services/finnhub';
import type { PriceData } from '../types';

const STALE = 30_000; // 30 seconds — stay under Finnhub free tier 60 req/min

export function useFinnhubQuote(ticker: string) {
  return useQuery<PriceData>({
    queryKey: ['quote', ticker],
    queryFn: () => fetchQuote(ticker),
    staleTime: STALE,
    refetchInterval: STALE,
    placeholderData: (prev) => prev,
  });
}

export function useBatchQuotes(tickers: string[]) {
  return useQuery<PriceData[]>({
    queryKey: ['quotes', tickers.join(',')],
    queryFn: () => fetchAllQuotes(tickers),
    staleTime: STALE,
    refetchInterval: STALE,
    placeholderData: (prev) => prev,
    enabled: tickers.length > 0,
  });
}
