# syntax=docker/dockerfile:1.7
# Multi-stage build for the NestJS API + workers.
#
# Usage:
#   docker build -t logikmarket-api --target api backend/
#   docker build -t logikmarket-email-worker --target email-worker backend/
#   docker build -t logikmarket-scraper-worker --target scraper-worker backend/
#   docker build -t logikmarket-linkedin-worker --target linkedin-worker backend/
#
# The builder stage installs + compiles once; runtime stages re-use the
# compiled dist + only production node_modules.

ARG NODE_VERSION=20

############################
# 1. install dependencies  #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

############################
# 2. build TypeScript      #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
    && npm run build

############################
# 3. prod-only deps        #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx prisma generate

############################
# 4. API runtime           #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]

############################
# 5. Email worker runtime  #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS email-worker
ENV NODE_ENV=production WORKER_KIND=email
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
CMD ["node", "dist/workers/email-worker.js"]

############################
# 6. Scraper worker        #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS scraper-worker
ENV NODE_ENV=production WORKER_KIND=scraper
# Chromium (via Playwright) needs a handful of OS packages.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
       libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 \
       libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
       libxdamage1 libxext6 libxfixes3 libxrandr2 libxkbcommon0 wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
RUN npx playwright install chromium --with-deps || npx playwright install chromium
CMD ["node", "dist/workers/scraper-worker.js"]

############################
# 7. LinkedIn worker       #
############################
FROM node:${NODE_VERSION}-bookworm-slim AS linkedin-worker
ENV NODE_ENV=production WORKER_KIND=linkedin
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
       libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 \
       libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
       libxdamage1 libxext6 libxfixes3 libxrandr2 libxkbcommon0 wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
RUN npx playwright install chromium --with-deps || npx playwright install chromium
CMD ["node", "dist/workers/linkedin-worker.js"]
