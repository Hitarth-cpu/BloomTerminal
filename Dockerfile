FROM node:20-alpine AS builder

WORKDIR /app

# Copy only the API package files first for layer caching
COPY quantdesk/apps/api/package*.json ./
RUN npm ci

COPY quantdesk/apps/api/tsconfig.json ./
COPY quantdesk/apps/api/src ./src

RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY quantdesk/apps/api/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 7860

ENV PORT=7860

CMD ["node", "dist/server.js"]
