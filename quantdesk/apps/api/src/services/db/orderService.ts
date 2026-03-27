import { query, transaction } from '../../db/postgres';

export interface Order {
  id:             string;
  user_id:        string;
  portfolio_id:   string | null;
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
  submitted_at:   Date;
  filled_at:      Date | null;
  cancelled_at:   Date | null;
  updated_at:     Date;
}

export interface OrderFill {
  order_id:  string;
  quantity:  number;
  price:     number;
  venue:     string | null;
  filled_at: Date;
}

export interface CreateOrderInput {
  userId:       string;
  portfolioId?: string;
  securityId:   string;
  side:         Order['side'];
  orderType:    Order['order_type'];
  quantity:     number;
  limitPrice?:  number;
  stopPrice?:   number;
  tif?:         string;
  algoStrategy?: string;
  notes?:       string;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const rows = await query<Order>(`
    INSERT INTO orders
      (user_id, portfolio_id, security_id, side, order_type, quantity,
       limit_price, stop_price, tif, algo_strategy, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `, [
    input.userId, input.portfolioId ?? null, input.securityId,
    input.side, input.orderType, input.quantity,
    input.limitPrice ?? null, input.stopPrice ?? null,
    input.tif ?? 'DAY', input.algoStrategy ?? null, input.notes ?? null,
  ]);
  return rows[0];
}

export interface OrderFilters {
  status?:     Order['status'];
  securityId?: string;
  from?:       Date;
  to?:         Date;
  limit?:      number;
  offset?:     number;
}

export async function getOrders(userId: string, filters: OrderFilters = {}): Promise<Order[]> {
  const conditions = ['user_id = $1'];
  const params: unknown[] = [userId];
  let p = 2;

  if (filters.status)     { conditions.push(`status = $${p++}`);              params.push(filters.status); }
  if (filters.securityId) { conditions.push(`security_id = $${p++}`);         params.push(filters.securityId); }
  if (filters.from)       { conditions.push(`submitted_at >= $${p++}`);       params.push(filters.from); }
  if (filters.to)         { conditions.push(`submitted_at <= $${p++}`);       params.push(filters.to); }

  const where = conditions.join(' AND ');
  const limit  = filters.limit  ?? 100;
  const offset = filters.offset ?? 0;

  return query<Order>(`SELECT * FROM orders WHERE ${where} ORDER BY submitted_at DESC LIMIT $${p++} OFFSET $${p}`,
    [...params, limit, offset]);
}

export async function getOrderById(id: string, userId?: string): Promise<Order | null> {
  const rows = userId
    ? await query<Order>('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId])
    : await query<Order>('SELECT * FROM orders WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function cancelOrder(id: string, userId: string): Promise<Order | null> {
  const rows = await query<Order>(`
    UPDATE orders
    SET status = 'Cancelled', cancelled_at = NOW()
    WHERE id = $1 AND user_id = $2 AND status IN ('Pending','PartialFill')
    RETURNING *
  `, [id, userId]);
  return rows[0] ?? null;
}

export async function recordFill(
  orderId: string,
  fill: { quantity: number; price: number; venue?: string },
): Promise<Order> {
  return transaction(async (client) => {
    // Insert fill record
    await client.query(
      'INSERT INTO order_fills(order_id, quantity, price, venue) VALUES($1,$2,$3,$4)',
      [orderId, fill.quantity, fill.price, fill.venue ?? null],
    );

    // Update order: recalculate avg fill price and filled_qty
    const result = await client.query<Order>(`
      UPDATE orders SET
        filled_qty     = filled_qty + $2,
        avg_fill_price = ((COALESCE(avg_fill_price,0) * filled_qty) + ($2 * $3)) / (filled_qty + $2),
        status         = CASE
                           WHEN filled_qty + $2 >= quantity THEN 'Filled'
                           ELSE 'PartialFill'
                         END,
        filled_at      = CASE WHEN filled_qty + $2 >= quantity THEN NOW() ELSE filled_at END
      WHERE id = $1
      RETURNING *
    `, [orderId, fill.quantity, fill.price]);
    return result.rows[0];
  });
}
