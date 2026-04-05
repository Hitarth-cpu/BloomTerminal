title: BloomTerminal API
emoji: 📈
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
app_port: 7860

# QuantDesk — Bloomberg-Inspired Quant Terminal

An institutional-grade, AI-powered quantitative data analysis terminal. Built with React, TypeScript, and Node.js, QuantDesk mirrors the depth and density of the Bloomberg Terminal — combining real-time market data, AI research, encrypted institutional messaging, risk management, and document analysis in a unified dark-themed interface.

---

## Features

- **Trading Terminal** — Live quotes, order book, candlestick charts, and trade execution workflow
- **ASKB AI Research Assistant** — Streaming Claude-powered research with web-augmented responses
- **Institutional Chat** — End-to-end encrypted messaging with team management
- **Risk Management Dashboard** — Portfolio risk analytics and performance snapshots
- **Market Data** — Real-time WebSocket price feeds via Finnhub, historical OHLCV charts
- **News Feed** — RSS aggregation with AI sentiment tagging
- **Document Research Workspace** — Upload, index, and query financial documents with pgvector search
- **Admin Panel** — User management, org/team administration, MFA enforcement, broadcast messaging

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, custom terminal CSS variables |
| State | Zustand (global), TanStack Query v5 (server state) |
| Charts | Recharts, D3.js |
| Tables | TanStack Table v8 (virtualized) |
| Real-time | Socket.IO client, WebSocket |
| Auth | Firebase Authentication |

### Backend (`apps/api`)
| Layer | Technology |
|---|---|
| Runtime | Node.js 20, Express, TypeScript |
| Database | PostgreSQL (Neon), Redis |
| AI | Anthropic Claude API (claude-sonnet) |
| Vector Search | pgvector on PostgreSQL |
| Auth | JWT + refresh tokens, role-based (Trader / Analyst / Risk Officer / Admin) |
| Jobs | BullMQ workers, cron jobs |

### Infrastructure
| Layer | Technology |
|---|---|
| Frontend deploy | Vercel |
| API deploy | Docker (Hugging Face Spaces / self-hosted) |
| Containerization | Multi-stage Dockerfile, docker-compose |

---

## Project Structure

```
quantdesk/
├── src/                    # React frontend
│   ├── components/         # UI modules: market, trading, ai, charts, risk, news, ...
│   ├── pages/              # Route-level pages + admin panel
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand stores
│   ├── services/           # API client, Firebase, WebSocket
│   └── types/              # Shared TypeScript types
└── apps/
    └── api/
        └── src/
            ├── routes/     # REST endpoints (market, orders, chat, risk, admin, ...)
            ├── migrations/  # 27+ versioned SQL migrations
            ├── services/   # Business logic
            ├── workers/    # Background job processors
            └── websocket/  # Real-time price feed handlers
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or a [Neon](https://neon.tech) connection string)
- Redis
- Firebase project
- Anthropic API key
- Finnhub API key

### Frontend

```bash
cd quantdesk
npm install
cp .env.example .env.local   # fill in API keys
npm run dev
```

### API

```bash
cd quantdesk/apps/api
npm install
cp .env.example .env         # fill in all required env vars
npm run dev
```

### Docker (full stack)

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up --build
```

### Environment Variables

Key variables required (see `.env.example` for the full list):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `FINNHUB_API_KEY` | Finnhub market data key |
| `ADMIN_MFA_KEY` | 32-byte hex key for MFA secret encryption (required in production) |
| `VITE_FIREBASE_*` | Firebase project config |
| `VITE_WS_URL` | WebSocket server URL |
| `VITE_API_URL` | API base URL |

---

## Database Migrations

Migrations are applied in order from `apps/api/src/migrations/`. To run:

```bash
cd quantdesk/apps/api
npm run migrate
```

---

## Security

- All MFA secrets are AES-256-GCM encrypted at rest using `ADMIN_MFA_KEY`
- Institutional chat messages are end-to-end encrypted (ECDH key exchange)
- JWT access tokens + rotating refresh tokens
- Role-based access control enforced at the API layer

---

## Target Users

Quant analysts, buy-side/sell-side traders, equity researchers, fixed income professionals, risk officers, and portfolio managers.
