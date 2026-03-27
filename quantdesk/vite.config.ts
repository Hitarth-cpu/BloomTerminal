import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load env vars (including non-VITE_ ones for server-side use)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      strictPort: false,
      proxy: {
        // Google Gemini API — NEVER expose key to browser; inject here in Node context
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
          headers: {
            'x-goog-api-key': env.GEMINI_API_KEY ?? '',
          },
        },
        // Finnhub REST — proxied to hide key from network tab in prod
        '/api/finnhub': {
          target: 'https://finnhub.io/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/finnhub/, ''),
        },
        // Alpha Vantage — proxied
        '/api/alphavantage': {
          target: 'https://www.alphavantage.co',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/alphavantage/, ''),
        },
        // CoinGecko — public crypto data
        '/api/coingecko': {
          target: 'https://api.coingecko.com/api/v3',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/coingecko/, ''),
        },
        // Yahoo Finance — market quotes proxy
        '/api/yahoo': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
        // Backend API — must be last (least specific path wins)
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
