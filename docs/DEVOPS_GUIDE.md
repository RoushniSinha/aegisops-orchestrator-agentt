# AegisOps DevOps & Cloud Infrastructure Operational Guide
**Production Deployment, Containerization Strategy, Serverless Scaling & Cloud Security**

---

## 1. Containerization & Dockerfile Architecture

### 1.1 Multi-Stage Build Pipeline
To achieve minimal container footprint (<120MB) and reduce potential attack vectors, AegisOps utilizes a 3-stage build pipeline separating dependencies, static asset compilation, and the minimal production runtime.

```dockerfile
# ==========================================
# STAGE 1: Dependency Installation & Linting
# ==========================================
FROM node:20-alpine AS dependencies
WORKDIR /app

RUN apk update && apk upgrade && apk add --no-cache libc6-compat

COPY package.json bun.lock* package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run lint

# ==========================================
# STAGE 2: Frontend Asset Compilation (Vite)
# ==========================================
FROM dependencies AS builder
WORKDIR /app
ENV NODE_ENV=production
RUN npm run build

# ==========================================
# STAGE 3: Minimal Production Runtime
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S aegisops && adduser -S -G aegisops -u 10001 aegisuser

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder --chown=aegisuser:aegisops /app/dist ./dist
COPY --chown=aegisuser:aegisops server.ts ./server.ts

USER aegisuser

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

---

## 2. Google Cloud Run Deployment

```bash
# Build production container image
docker build -t gcr.io/aegisops-prod/aegisops-orchestrator:latest .

# Deploy to Cloud Run
gcloud run deploy aegisops \
  --image gcr.io/aegisops-prod/aegisops-orchestrator:latest \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```
