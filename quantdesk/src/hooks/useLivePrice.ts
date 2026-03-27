import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { finnhubWS, type PriceTick } from '../services/finnhubWebSocket';
import { useFinnhubQuote } from './useFinnhubQuote';
import type { PriceData } from '../types';

export function useLivePrice(ticker: string): {
  price: PriceData | null;
  isLive: boolean;
  isLoading: boolean;
} {
  const queryClient = useQueryClient();
  const { data: restQuote, isLoading } = useFinnhubQuote(ticker);
  const [liveTick, setLiveTick] = useState<Partial<PriceData> | null>(null);

  const onTick = useCallback((tick: PriceTick) => {
    setLiveTick({ last: tick.price, timestamp: tick.timestamp });
    // Also update React Query cache so other components reading ['quote', ticker] get the update
    queryClient.setQueryData<PriceData>(['quote', ticker], (prev) =>
      prev ? {
        ...prev,
        last: tick.price,
        close: tick.price,
        change: tick.price - prev.prevClose,
        changePct: ((tick.price - prev.prevClose) / prev.prevClose) * 100,
        timestamp: tick.timestamp,
      } : prev
    );
  }, [ticker, queryClient]);

  useEffect(() => {
    setLiveTick(null); // reset on ticker change
    finnhubWS.subscribe(ticker, onTick);
    return () => finnhubWS.unsubscribe(ticker, onTick);
  }, [ticker, onTick]);

  const merged: PriceData | null = restQuote
    ? { ...restQuote, ...(liveTick ?? {}) }
    : null;

  return {
    price: merged,
    isLive: finnhubWS.connectionStatus === 'connected',
    isLoading,
  };
}
