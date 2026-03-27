import { useQuery } from '@tanstack/react-query';
import { fetchMarketNews, fetchCompanyNews } from '../services/finnhub';
import type { NewsItem } from '../types';

export function useMarketNews() {
  return useQuery<NewsItem[]>({
    queryKey: ['news', 'market'],
    queryFn: fetchMarketNews,
    staleTime: 60_000,       // 1 minute
    refetchInterval: 120_000, // refetch every 2 minutes
    placeholderData: (prev) => prev,
  });
}

export function useCompanyNews(ticker: string) {
  return useQuery<NewsItem[]>({
    queryKey: ['news', ticker],
    queryFn: () => fetchCompanyNews(ticker),
    staleTime: 120_000,
    refetchInterval: 300_000,
    placeholderData: (prev) => prev,
    enabled: !!ticker,
  });
}
