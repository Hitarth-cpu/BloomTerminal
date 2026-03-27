import { api } from './apiClient';

export interface ApiOrder {
  id:             string;
  user_id:        string;
  security_id:    string;
  side:           'Buy' | 'Sell' | 'Short' | 'Cover';
  order_type:     'Market' | 'Limit' | 'Stop' | 'StopLimit' | 'Algo';
  quantity:       number;
  limit_price:    number | null;
  stop_price:     number | null;
  filled_qty:     number;
  avg_fill_price: number | null;
  status:         'Pending' | 'PartialFill' | 'Filled' | 'Cancelled' | 'Rejected';
  tif:            string;
  algo_strategy:  string | null;
  notes:          string | null;
  submitted_at:   string;
  filled_at:      string | null;
  cancelled_at:   string | null;
}

export interface CreateOrderPayload {
  securityId:   string;
  side:         ApiOrder['side'];
  orderType:    ApiOrder['order_type'];
  quantity:     number;
  limitPrice?:  number;
  stopPrice?:   number;
  tif?:         string;
  algoStrategy?: string;
  notes?:       string;
  portfolioId?: string;
}

export async function fetchOrders(filters?: {
  status?: string; from?: string; to?: string; limit?: number; offset?: number;
}): Promise<ApiOrder[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from)   params.set('from',   filters.from);
  if (filters?.to)     params.set('to',     filters.to);
  if (filters?.limit)  params.set('limit',  String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const { orders } = await api.get<{ orders: ApiOrder[] }>(`/orders${qs ? `?${qs}` : ''}`);
  return orders;
}

export async function submitOrder(payload: CreateOrderPayload): Promise<ApiOrder> {
  const { order } = await api.post<{ order: ApiOrder }>('/orders', payload);
  return order;
}

export async function cancelOrder(id: string): Promise<ApiOrder> {
  const { order } = await api.delete<{ order: ApiOrder }>(`/orders/${id}`);
  return order;
}
