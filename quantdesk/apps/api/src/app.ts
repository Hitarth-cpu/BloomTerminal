import 'dotenv/config';
import express from 'express';
import { json } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { requireAuth } from './middleware/requireAuth';

// ─── Routers ──────────────────────────────────────────────────────────────────
import authRouter       from './routes/auth';
import usersRouter      from './routes/users';
import ordersRouter     from './routes/orders';
import marketRouter     from './routes/market';
import chatRouter       from './routes/chat';
import documentsRouter  from './routes/documents';
import riskRouter       from './routes/risk';
import healthRouter     from './routes/health';
import contactsRouter        from './routes/contacts';
import broadcastsRouter     from './routes/broadcasts';
import adminAuthRouter       from './routes/admin/auth';
import adminMembersRouter    from './routes/admin/members';
import adminPerfRouter       from './routes/admin/performance';
import adminChatRouter       from './routes/admin/chat';
import adminSecurityRouter   from './routes/admin/security';
import adminAiRouter         from './routes/admin/ai';
import adminBroadcastsRouter from './routes/admin/broadcasts';
import newsRouter            from './routes/news';
import rssProxyRouter        from './routes/rssProxy';
import marketDataRouter      from './routes/marketData';
import workspacesRouter      from './routes/workspaces';
import documentAIRouter      from './routes/documentAI';
import askbRouter            from './routes/askb';

const app = express();

// Trust the first proxy hop (HuggingFace Spaces / nginx)
// Required for express-rate-limit to read X-Forwarded-For correctly
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled for dev; enable in prod with proper CSP
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // Allow Google OAuth popup to access window.closed
}));

// CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://bloom-terminal.vercel.app',
    ].filter(Boolean) as string[]
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // permissive in dev — tighten in prod
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — global
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
}));

// Stricter rate limit for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many auth attempts. Try again in 15 minutes.' } },
}));

app.use(json({ limit: '2mb' }));

// ─── Public ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth',   authRouter);

// ─── Authenticated ────────────────────────────────────────────────────────────
app.use('/api/users',      requireAuth, usersRouter);
app.use('/api/orders',     requireAuth, ordersRouter);
app.use('/api/market',     requireAuth, marketRouter);
app.use('/api/chat',       requireAuth, chatRouter);
app.use('/api/documents',  requireAuth, documentsRouter);
app.use('/api/risk',       requireAuth, riskRouter);
app.use('/api/contacts',   requireAuth, contactsRouter);
app.use('/api/broadcasts', requireAuth, broadcastsRouter);
app.use('/api/news',        newsRouter);         // public — market news
app.use('/api/rss-proxy',  rssProxyRouter);      // public — RSS feed proxy
app.use('/api/market-data', marketDataRouter);    // public — market data aggregation
app.use('/api/workspaces', requireAuth, workspacesRouter);
app.use('/api/document-ai', requireAuth, documentAIRouter);
app.use('/api/askb',       requireAuth, askbRouter);

// ─── Admin (own auth layer inside each router) ────────────────────────────────
app.use('/api/admin/auth',        adminAuthRouter);
app.use('/api/admin/members',     adminMembersRouter);
app.use('/api/admin/performance', adminPerfRouter);
app.use('/api/admin/chat',        adminChatRouter);
app.use('/api/admin/security',    adminSecurityRouter);
app.use('/api/admin/ai',          adminAiRouter);
app.use('/api/admin',             adminBroadcastsRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler (must be last middleware)
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = err as { status?: number; statusCode?: number; message?: string; code?: string; stack?: string };
  const status = error.status ?? error.statusCode ?? 500;
  const message = error.message ?? 'Internal server error';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}`, {
    message,
    userId: (req as { user?: { id: string } }).user?.id,
    ...(process.env.NODE_ENV !== 'production' ? { stack: error.stack } : {}),
  });

  res.status(status).json({
    error: {
      code: error.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: status === 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : message,
    },
  });
});

export default app;
