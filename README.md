---
title: BloomTerminal API
emoji: 📈
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
app_port: 7860
---

# BloomTerminal

An institutional-grade trading terminal built with React, TypeScript, and Node.js.

## Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, PostgreSQL, Redis, MongoDB
- **AI**: Google Gemini 2.0 Flash (ASKB Research Assistant)
- **Auth**: Firebase Authentication
- **Market Data**: Finnhub WebSocket + REST

## Modules
- Trading Terminal (live quotes, order book, charts)
- ASKB AI Research Assistant (streaming chat)
- Institutional Chat (E2E encrypted)
- Risk Management Dashboard
- News Feed with AI sentiment tagging
- Document Research Workspace

## Getting Started
```bash
cd quantdesk
npm install
cp .env.example .env.local   # fill in API keys
npm run dev
```
