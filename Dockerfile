# ==============================================================================
# AegisOps — Autonomous B2B Logistics Multi-Step Orchestrator
# Multi-Stage Production Dockerfile for Google Cloud Run Deployment
# ==============================================================================

# Stage 1: Build & Bundle
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code and assets
COPY . .

# Build Vite frontend & Bundle Express backend into dist/server.cjs
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy compiled bundles and static assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Expose standard port 3000 for Google Cloud Run
EXPOSE 3000

# Start autonomous server orchestrator
CMD ["node", "dist/server.cjs"]
