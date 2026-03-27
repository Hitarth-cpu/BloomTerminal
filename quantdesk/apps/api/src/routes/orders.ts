import { Router } from 'express';
import {
  createOrder, getOrders, getOrderById, cancelOrder,
  type CreateOrderInput, type OrderFilters,
} from '../services/db/orderService';

const router = Router();

/** GET /api/orders */
router.get('/', async (req, res) => {
  const { status, securityId, from, to, limit, offset } = req.query as Record<string, string | undefined>;

  const filters: OrderFilters = {
    status:     status as OrderFilters['status'],
    securityId,
    from:       from   ? new Date(from)   : undefined,
    to:         to     ? new Date(to)     : undefined,
    limit:      limit  ? Number(limit)    : undefined,
    offset:     offset ? Number(offset)   : undefined,
  };

  const orders = await getOrders(req.user.id, filters);
  res.json({ orders });
});

/** POST /api/orders */
router.post('/', async (req, res) => {
  const body = req.body as Omit<CreateOrderInput, 'userId'>;
  const order = await createOrder({ ...body, userId: req.user.id });
  res.status(201).json({ order });
});

/** GET /api/orders/:id */
router.get('/:id', async (req, res) => {
  const order = await getOrderById(req.params.id, req.user.id);
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  res.json({ order });
});

/** DELETE /api/orders/:id — cancel */
router.delete('/:id', async (req, res) => {
  const order = await cancelOrder(req.params.id, req.user.id);
  if (!order) { res.status(404).json({ error: 'Order not found or cannot be cancelled' }); return; }
  res.json({ order });
});

export default router;
