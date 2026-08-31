# PARCELPILOT DEVOPS & CLOUD INFRASTRUCTURE ARCHITECTURE COMPENDIUM
**Autonomous Support & Operations Engine — Comprehensive 80-Question Production Infrastructure Guide**

---

## Track 1: Docker & Containerization Best Practices

### 1. Multi-Stage Dockerfile for Vite + Node/Express
```dockerfile
# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy runtime server dependencies & compiled assets
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=frontend-builder /app/dist ./dist
COPY server.ts ./server.ts

# Non-root user execution
USER node
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```
**Why this matters**:
- **Image Size Reduction**: Drops image footprint from ~1.2 GB (containing full dev tooling, compiler caches, and node_modules) to under ~110 MB.
- **Attack Surface Minimization**: Eliminates compiler binaries (`tsc`, `vite`, `esbuild`), source code definitions, package managers, and development dependencies with potential CVEs from the production runtime container.

---

### 2. Base Image Hardening (`node:20` to `node:20-slim` / Distroless)
- **Potential Native Binding Breakages**: Libraries like `html2canvas`, `jspdf`, `canvg`, or `canvas` in Node runtimes often link to `libcairo`, `libgif`, `libjpeg`, `libpango`, or native font rasterizers. In Alpine/Slim, missing `fontconfig` or `cairo` shared objects can cause silent export crashes or headless font corruption.
- **Pre-Shipment Detection Strategy**:
  - Add an automated smoke-test step in the multi-stage build that runs a headless PDF generation script:
  ```dockerfile
  RUN node -e "const { jsPDF } = require('jspdf'); const doc = new jsPDF(); doc.text('test', 10, 10); doc.output();"
  ```
  - Use `ldd` checks or container scanning tools (`trivy`, `grype`) to verify dynamic shared library linkage.

---

### 3. Non-Root User & Filesystem Security
- **Minimal User Setup**:
  ```dockerfile
  RUN addgroup -S parcelpilot && adduser -S -G parcelpilot -u 10001 pilotuser
  USER pilotuser
  ```
- **The `--chown` Rule**:
  ```dockerfile
  COPY --chown=pilotuser:parcelpilot --from=frontend-builder /app/dist ./dist
  ```
- **Consequences of Forgetting `--chown`**: Files copied into the container default to ownership by `root:root` (0:0) with read-only default masks. If the app needs to write temporary runtime caches (or Node tries to write diagnostic dumps/sockets), the non-root process crashes with `EACCES: permission denied`.

---

### 4. Preventing Accidental Dev-Server Behavior in Production
1. **Explicit Build Envs**: Ensure `NODE_ENV=production` is set in the Docker build args.
2. **Vite Production Bundling**: Ensure Vite runs `vite build` which automatically produces static chunks and tree-shakes HMR web socket listeners.
3. **Source Map Elimination**: Set `build: { sourcemap: false }` in `vite.config.ts` during production builds to avoid exposing internal source paths.

---

### 5. Production `.dockerignore` Specification
```dockerignore
node_modules
dist
.env*
!*.env.example
.git
.github
*.md
firebase-applet-config.json
firebase-blueprint.json
firestore.rules
coverage
.cache
.vscode
```
**Rationale**: Prevents massive build context transfer times, blocks leaking credentials and secrets into image layers, and excludes unneeded documentation.

---

### 6. Enforcing Type-Checking at Docker Build Time
```dockerfile
FROM node:20-alpine AS type-checker
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run lint
# Fails docker build immediately if tsc --noEmit discovers type mismatches
```

---

### 7. Verifying Native/Canvas Dependencies in Slim Images
- In the build stage, run an integration check that exercises canvas bindings and renders mock output.
- If dependencies rely on `node-gyp`, install `python3`, `make`, `g++`, `cairo-dev`, `pango-dev` in a dedicated build stage, compile the native addon, and copy the `.node` binary into the slim runner.

---

### 8. Graceful SIGTERM Handling in Node/Express
```typescript
import http from 'http';
const server = http.createServer(app);

const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });

  // Force close after 10s timeout to avoid zombie containers
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

### 9. Docker Layer-Caching Strategy for Fast Rebuilds
```dockerfile
# Copy dependency manifests FIRST
COPY package.json bun.lock* package-lock.json* ./
# This layer is cached unless package.json / bun.lock changes
RUN npm ci

# Copy application source AFTER dependency installation
COPY src/ ./src/
COPY index.html vite.config.ts tsconfig.json ./
# Source changes rebuild only from this step onward
RUN npm run build
```

---

### 10. Bun vs. Node/npm in Production Containers
- **Bun**: Ultra-fast install times (2–5x faster) and fast cold-start script execution.
- **Node/npm**: Decades of proven production reliability, 100% native C++ addon ABI compatibility, and comprehensive monitoring/debugging toolchain support (APM, heap profilers).
- **Enforcement**: Pin package manager via `packageManager: "bun@1.1.0"` in `package.json` or use `corepack enable` in Dockerfile.

---

## Track 2: Serverless & Google Cloud Run Architecture

### 11. LLM Tool-Calling Latency & Timeout Configuration
- **Cloud Run Request Timeout**: Default is 300s (5 minutes); maximum is 3600s (60 minutes).
- **Configuration**: For LLM tool-calling loops with human validation gates, configure a timeout of **900s (15 minutes)**:
  ```bash
  gcloud run deploy parcelpilot --timeout=900s
  ```
- **Rationale**: Accommodates multi-step RAG document vector searches, tool orchestrations, and operator review buffering without abrupt HTTP 504 Gateway Timeouts.

---

### 12. Cold-Start Latency Optimization
1. **Container Shrinking**: Slim Alpine image (<120MB) loads into memory in <400ms.
2. **Lazy SDK Initialization**: Do not initialize Firebase Admin or AI SDKs globally at module load time; initialize them lazily on first request or asynchronously in the background.
3. **Minimum Instances**: Configure `min-instances=1` for critical operational hours:
   - *Cost Trade-off*: ~$15–$25/month for 1 idle instance (allocated vCPU/RAM) vs. eliminating 3–5 second cold starts for operators.

---

### 13. Concurrency Settings for LLM Streaming
- **Setting**: Set `concurrency=40` (rather than default 80).
- **Why**: LLM streaming holds HTTP connections open for extended durations. High concurrency (80+) on a single vCPU can lead to event-loop thread starvation, socket stalls, and degraded client streaming throughput.

---

### 14. Scale-to-Zero vs. <3s SLA
- Use **CPU Allocation during request processing only** (`cpu-throttling=true`).
- Keep image size under 100MB.
- Use Startup CPU Boost:
  ```bash
  gcloud run deploy parcelpilot --cpu-boost
  ```
  Provides 200% temporary vCPU during container boot, cutting initialization time to under 1.8 seconds.

---

### 15. Server-Sent Events (SSE) on Cloud Run
- Cloud Run natively supports SSE streaming over HTTP/1.1 and HTTP/2.
- **Critical Configuration**:
  - Response header: `X-Accel-Buffering: no` (disables intermediate reverse-proxy buffering).
  - Periodic heartbeat ping every 15s (`: ping\n\n`) to prevent Cloud Run proxy from dropping idle connections.

---

### 16. Long-Running Bulk Tasks Architecture (TKT-502)
- Cloud Run throttles CPU after the HTTP response closes.
- **Architecture**:
  - Client uploads CSV $\to$ Backend writes file to Cloud Storage $\to$ Enqueues task in **Google Cloud Tasks** (or publishes to **Pub/Sub**) $\to$ Dedicated Cloud Run Worker instance executes chunked processing with automatic retry and rate-limiting.

---

### 17. CPU and Memory Sizing for PDF Ledger Exports
- **Recommended**: **2 GiB Memory, 2 vCPU**.
- **Reasoning**: `html2canvas` DOM rasterization and PDF compilation generate large in-memory bitmap arrays. Under 1 GiB, concurrent multi-page PDF exports trigger Linux kernel OOM-killer (`Exit code 137`).

---

### 18. Canary Traffic Splitting for Prompt / Tool Schema Updates
```bash
# 1. Deploy new revision without routing traffic
gcloud run deploy parcelpilot --image=gcr.io/proj/pilot:v2 --no-traffic --tag=canary

# 2. Shift 5% traffic to canary revision
gcloud run services update-traffic parcelpilot --to-revisions=parcelpilot-v1=95,parcelpilot-v2=5

# 3. Monitor error rates & latency; shift 100% on validation
gcloud run services update-traffic parcelpilot --to-latest
```

---

### 19. Long-Lived Human-In-The-Loop (HITL) Timeouts
- **Architecture Pattern**: Decouple the request.
  1. Agent stages the action $\to$ returns staged mutation ID to client (HTTP 200).
  2. Client enters waiting state in UI (Amber Gate).
  3. Operator confirms $\to$ sends independent `POST /api/mutations/{id}/confirm` request.
  - This avoids keeping long-lived HTTP connections open while waiting for human input.

---

### 20. Diagnosing Intermittent Frontend Failures
1. **Cold-Start Timeout**: Look for `HttpRequest.status=504` in Cloud Logging with `container_started_duration_ms > request_timeout`.
2. **Client Abort**: Look for HTTP status 499 or `client closed connection before response headers returned`.
3. **Resource Contention**: Check Cloud Monitoring metrics for `container/cpu/utilization` reaching 100% or `container/memory/utilization` near limits.

---

## Track 3: CI/CD Pipelines & Automated Deployments

### 21. GitHub Actions PR Workflow
```yaml
name: PR Validation
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install Dependencies
        run: npm ci
      - name: TypeScript Lint & Typecheck
        run: npm run lint
      - name: Production Vite Build
        run: npm run build
```

---

### 22. Package Manager Consistency Enforcement
- If CI uses `npm` while local uses `bun`, lockfile divergence (`package-lock.json` vs `bun.lock`) causes subtle dependency version mismatches.
- **Fix**: Use `corepack` or `setup-bun` in GitHub Actions to ensure identical lockfile resolution across development, CI, and production container builds.

---

### 23. Firestore Emulator Integration Testing in CI
```yaml
- name: Run Firestore Emulator Tests
  run: |
    npm install -g firebase-tools
    firebase emulators:exec --only firestore "npm run test:integration"
```
- Completely isolates CI runs from production data while executing tests against real Firestore security rules and query syntax.

---

### 24. Zero-Downtime Deployment & Rollback Criteria
- Deploy new Cloud Run revision with `--no-traffic`.
- Run automated post-deploy integration checks against tag URL (`https://canary---parcelpilot-*.a.run.app`).
- Shift 100% traffic to the new revision.
- **Rollback Trigger Criteria**: Error rate (5xx) exceeds 0.5% over 2 minutes, or p99 latency spikes above 3000ms.

---

### 25. Automated Policy Precedence Regression Checks
- CI test suite executes a dedicated test asserting that any query with Tier 3 keywords or deprecated citations (`02_Support_Policy_v2`) raises `ContractPrecedenceViolationError` and fails the test if any Tier 3 policy is returned.

---

### 26. Secret Scanning & Firebase API Key Triage
- **Tooling**: Run `gitleaks` or `trufflehog` on every commit.
- **Triage Matrix**:
  - `apiKey` in `firebase-applet-config.json`: Public client-side identifier for Firebase project routing; secured by Firestore Security Rules.
  - `GEMINI_API_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`: Server secrets; MUST be blocked from commits with zero exceptions.

---

### 27. Automated Visual & Component Regression Testing
- Integrate **Playwright** component tests running headless in GitHub Actions.
- Capture baseline screenshots of `AmberApprovalGate` and compare pixel diffs on every PR before merge.

---

### 28. Branch Protection Policy for `main`
- **Blocking Requirements**:
  1. All PR checks green (`tsc --noEmit`, `vite build`, `gitleaks`).
  2. Integration tests passed on Firestore emulator.
  3. At least 1 code owner review approval.
  4. Branch strictly up-to-date with `main`.
- **Non-Blocking**: Code coverage reports, bundle size delta warnings.

---

### 29. Blocking Open `firestore.rules` Deployments
```javascript
// Test in CI using @firebase/rules-unit-testing
test("Reject unauthenticated public write access to ledger", async () => {
  const unauthedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthedDb.collection("ledger_entries").add({ amount: 100 }));
});
```
- If test suite fails, CI blocks the deployment.

---

### 30. Post-Deploy Smoke-Test Step
- A synthetic test runner authenticates as a dedicated test service account, stages a mock `TEST_SMOKE` credit mutation, confirms execution, verifies the ledger write in Firestore, and removes the test record.

---

## Track 4: Cloud Networking & Security

### 31. Serverless VPC Access & Egress Restriction
```
[Cloud Run Backend]
        │ (Direct VPC Egress / Connector)
        ▼
[VPC Subnet] ───► [Cloud NAT] ───► [Internet: Gemini API / Whitelisted Endpoints]
        │
        └───► [Private Google Access] ───► [Firestore / Cloud APIs]
```
- Route all egress through a Serverless VPC Access Connector with Firewall rules blocking unwhitelisted external IPs.

---

### 32. Hardening `firestore.rules` for Production
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /ledger_entries/{entryId} {
      allow read: if request.auth != null && 
        (request.auth.token.role == 'internal_ops' || resource.data.accountId == request.auth.token.accountId);
      allow write: if request.auth != null && request.auth.token.role == 'internal_ops';
    }
  }
}
```

---

### 33. Ingress Restriction via Cloud Armor & CORS
- Set Cloud Run ingress to `internal-and-cloud-load-balancing`.
- Mount Cloud Armor Security Policy on HTTPS Load Balancer with origin header whitelisting and rate-limiting rules.

---

### 34. HTTPS/TLS Custom Domain Management
- Managed SSL certificates provisioned via Google Cloud Certificate Manager.
- Automated rotation 30 days prior to expiration.
- Emergency runbook: DNS-01 challenge fallback if HTTP-01 verification fails.

---

### 35. Cloud Armor WAF Rule Set
- Enable OWASP Top 10 pre-configured rules:
  - `evaluatePreconfiguredExpr('sqli-v33-stable')`
  - `evaluatePreconfiguredExpr('xss-v33-stable')`
  - `evaluatePreconfiguredExpr('rce-v33-stable')`
  - Rate-limiting: Max 100 requests per minute per IP on `/api/*` routes.

---

### 36. Securing Firestore `onSnapshot` Subscriptions
- Use query-constrained listeners matching user tenant ID:
  ```typescript
  query(collection(db, 'ledger_entries'), where('accountId', '==', userAccountId));
  ```
- Combined with hardened Firestore rules, clients attempting full collection queries receive `permission-denied` immediately.

---

### 37. DDoS Protection for Webhook Ingestion
1. **Cloud Armor Layer**: Token Bucket Rate Limiting (e.g., 50 req/sec per carrier IP block).
2. **Application Layer**: HMAC signature verification (`X-Carrier-Signature`) executed before body parsing.

---

### 38. Network Isolation: Customer vs. Internal Ops
- Separate into two Cloud Run services:
  - `parcelpilot-customer-portal`: Public ingress, restricted customer permissions.
  - `parcelpilot-ops-engine`: Internal/IAP (Identity-Aware Proxy) ingress, corporate SSO only.

---

### 39. Secure Cloud SQL Connection from Cloud Run
- Use the **Cloud SQL Auth Proxy** built into Cloud Run:
  ```bash
  gcloud run deploy parcelpilot --add-cloudsql-instances=PROJECT:REGION:INSTANCE --vpc-egress=private-ranges-only
  ```
- Uses Unix domain sockets (`/cloudsql/PROJECT:REGION:INSTANCE`) over private Google networking without public IPs.

---

### 40. Responding to API Key Exposure (TKT-505 Incident)
1. **Detection**: Cloud Logging alert for sudden geographic anomalies or elevated request rates.
2. **Immediate Containment**: Revoke exposed key in Google Cloud Console / AI Studio within 60 seconds.
3. **Remediation**: Issue rotated secret to Secret Manager; Cloud Run automatically fetches new secret on next request.

---

## Track 5: Secrets Management & Environment Configuration

### 41. Secret Manager Mounting on Cloud Run
```bash
gcloud run deploy parcelpilot \
  --set-secrets=GEMINI_API_KEY=projects/PROJECT_NUM/secrets/GEMINI_API_KEY:latest
```
- Injected as environment variable `process.env.GEMINI_API_KEY` in memory at container runtime. Secret is never baked into the container image.

---

### 42. Client-Side vs. Server-Side Secret Classification
- **Client-Side (Safe)**: `apiKey`, `appId`, `projectId` in Firebase config (identify public cloud endpoints, secured by IAM & Firestore rules).
- **Server-Side (Critical Secret)**: `GEMINI_API_KEY`, `FIREBASE_ADMIN_SDK_JSON`, `JWT_SIGNING_SECRET` (provide full API authorization; exposure leads to complete system compromise).

---

### 43. Zero-Downtime Secret Rotation
1. Add new secret version to Google Secret Manager.
2. Update Cloud Run service to pin `:latest` or new version number.
3. Cloud Run executes rolling deployment, booting new instances with the new key while legacy instances drain existing connections.
4. Disable old secret version after draining completes.

---

### 44. Least-Privilege IAM for Secret Manager
- Grant `roles/secretmanager.secretAccessor` exclusively to the specific Cloud Run Service Account (`parcelpilot-backend@project.iam.gserviceaccount.com`), restricted to the specific resource name of the `GEMINI_API_KEY` secret.

---

### 45. Local Dev vs. Production Secrets
- **Local Dev**: Use `.env.local` pointing to local Firestore Emulator (`FIRESTORE_EMULATOR_HOST=localhost:8080`) and personal development keys.
- **Production**: Secret Manager injection via Cloud Run IAM. Developers never hold direct read access to production secrets.

---

### 46. Preventing Accidental Secret Commits
- Configure **pre-commit hooks** using `husky` + `detect-secrets`.
- Server-side GitHub push protection blocks commits containing API key patterns even if `git add -f` was used.

---

### 47. Dynamic Environment-Specific Database ID
- Inject `DATABASE_ID` as a runtime environment variable in Cloud Run:
  ```typescript
  const db = getFirestore(app, process.env.VITE_FIRESTORE_DATABASE_ID || '(default)');
  ```

---

### 48. Auditing Build Artifacts for Leaked Secrets
- CI step runs `strings dist/**/*.js | grep -E "(AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{48})"` to ensure server keys were never accidentally embedded into public JS chunks.

---

### 49. Leaked Key Incident Response Runbook
```
1. ROTATE: Generate new key in Secret Manager (add version).
2. REDEPLOY: Force Cloud Run revision update.
3. REVOKE: Delete compromised key version from provider.
4. AUDIT: Review Cloud Audit Logs for unauthorized queries made during the leak window.
5. POST-MORTEM: Document root cause, timeline, and mitigation actions.
```

---

### 50. OAuth Client IDs vs. Sensitive Secrets
- **OAuth Client IDs & reCAPTCHA Site Keys**: Public identifiers embedded in frontend client builds.
- **Client Secrets & Private Keys**: Confidential; must remain in Secret Manager and be accessed exclusively server-side.

---

## Track 6: Cloud Storage & Database Hosting

### 51. Firestore vs. Cloud SQL for Financial Ledgers
- **Firestore**: Excellent real-time listener ergonomics (`onSnapshot`), horizontal scalability, zero maintenance.
- **Cloud SQL (Postgres)**: ACID relational guarantees, strict schema constraints, immutable append-only triggers, cryptographic checksum validation.
- **Recommendation**: Retain Firestore for collaborative state/queues; migrate permanent financial transactions to Cloud SQL for formal accounting immutability.

---

### 52. Firestore Indexing for Ledger Query Patterns
```json
{
  "indexes": [
    {
      "collectionGroup": "ledger_entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "accountId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```
- Deploy indexes via `firebase deploy --only firestore:indexes`. Firestore builds indexes in the background without downtime.

---

### 53. Connection Pooling for Cloud Run $\to$ Cloud SQL
- Use **PgBouncer** or Cloud SQL built-in connection pooler.
- Limit max container pool connections to 5 per Cloud Run instance. With 20 instances, max active connections = 100, well within standard Postgres limits.

---

### 54. Cloud Storage for Static Policy Documents
- Store PDF agreements in Google Cloud Storage bucket (`gs://parcelpilot-contract-vault`).
- Generate short-lived (15 min) Signed URLs for frontend viewing.
- Backend loads and parses text chunks into memory on startup with automatic version invalidation.

---

### 55. Firestore Backup & PITR Strategy
- Enable Firestore **Point-in-Time Recovery (PITR)** (7-day granular rewind window).
- Schedule daily exports to Cloud Storage bucket via Cloud Scheduler + Cloud Functions:
  ```bash
  gcloud firestore export gs://parcelpilot-daily-backups/$(date +%Y-%m-%d)
  ```
- RTO (Recovery Time Objective): < 45 minutes.

---

### 56. Firestore Real-Time Listeners vs. Webhooks at Scale
- Under 2,000 active operators: Firestore `onSnapshot` is cost-effective and responsive.
- Beyond 10,000 active clients: Real-time listeners incur significant read costs ($0.06 per 100k reads). Shift to Server-Sent Events (SSE) backed by Redis Pub/Sub.

---

### 57. Zero-Downtime Firestore Rules Migration
1. Deploy updated rules that accept both legacy and new token formats.
2. Deploy backend service and client app with updated token schemas.
3. Verify via Cloud Monitoring that legacy rule paths drop to 0 executions.
4. Remove legacy rules.

---

### 58. Sync Strategy: `localStorage` vs. Firestore Truth
- Use `localStorage` strictly as an offline write-through cache with a timestamp check (`cacheTimestamp`).
- Always fetch authoritative user profile from Firestore on mount; if local version is older, overwrite `localStorage`.

---

### 59. Ephemeral vs. Cloud Storage PDF Exports
- **Ephemeral Client-Side Generation**: Cost-effective, zero storage footprint, perfect for single-user receipts.
- **Cloud Storage Persistence**: Required for legally binding compliance exports; generated server-side, hashed with SHA-256, and stored with immutable retention policies.

---

### 60. GDPR Right-to-Deletion vs. Financial Immutability
- **Resolution**: Anonymize PII in user records (replace name, email with hash `ANON_USER_99812`), but preserve immutable ledger financial amounts, timestamps, and order references for accounting compliance.

---

## Track 7: Observability, Logging & Distributed Tracing

### 61. OpenTelemetry Trace Propagation
```typescript
import { trace, context, propagation } from '@opentelemetry/api';

const tracer = trace.getTracer('parcelpilot-agent-engine');

export async function executeTool(toolName: string, params: any) {
  return tracer.startActiveSpan(`tool:${toolName}`, async (span) => {
    span.setAttribute('parcelpilot.account_id', params.account_id);
    span.setAttribute('parcelpilot.tool_name', toolName);
    try {
      const result = await toolEngine[toolName](params);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

---

### 62. Structured JSON Logging Specification
```json
{
  "severity": "ERROR",
  "timestamp": "2026-08-25T11:25:00.000Z",
  "message": "Tenant authorization error encountered",
  "serviceContext": { "service": "parcelpilot-backend", "version": "2.4.0" },
  "logging.googleapis.com/trace": "projects/proj/traces/4bf92f3577b34da6a3ce929d0e0e4736",
  "account_id": "ACC-NORTHSTAR",
  "order_id": "ORD-1001",
  "error_code": "RBAC_TENANT_ISOLATION_VIOLATION",
  "http_status": 403
}
```

---

### 63. Cloud Logging Alert for RBAC Violations
- Log query metric:
  ```
  resource.type="cloud_run_revision"
  jsonPayload.error_code="RBAC_TENANT_ISOLATION_VIOLATION"
  ```
- Create alert policy in Cloud Monitoring: Trigger PagerDuty page if count > 5 within a 5-minute rolling window.

---

### 64. Differentiating LLM Latency vs. Code Latency
- Instrument distinct child spans:
  - `span: internal_policy_evaluation` (our code)
  - `span: gemini_api_generate_content` (external LLM provider)
- Dashboard displays p95/p99 breakdown for each span independently.

---

### 65. Alerting on Firestore Query Fallbacks
- Emit structured log `jsonPayload.metric = "FIRESTORE_INDEX_FALLBACK_TRIGGERED"`.
- Alert if metric count > 0, flagging immediate index deployment necessity.

---

### 66. End-to-End User Action Tracing
- Pass client-generated `X-Correlation-ID` from UI through HTTP headers into Firestore document metadata (`_correlationId: 'req-9821'`).
- Query Cloud Logging with `jsonPayload.correlation_id="req-9821"` to see every log line across all systems.

---

### 67. Synthetic Uptime Monitoring
- Configure **Google Cloud Uptime Check**:
  - Target: `https://parcelpilot.app/api/health`
  - Frequency: Every 60 seconds from 5 global regions.
  - Validation: Verifies HTTP 200 and response body `{"status":"ok","firestore":"connected"}`.

---

### 68. Separate SLO Tracking for Customer vs. Internal Ops
- Tag requests with `user_role: "customer" | "internal_ops"`.
- Customer SLO: 99.9% uptime, p95 latency < 1200ms.
- Internal Ops SLO: 99.5% uptime, p95 latency < 3500ms (accommodating complex multi-document RAG operations).

---

### 69. Silent Precedence Degradation Alert
- Cloud Logging Metric Filter:
  ```
  jsonPayload.citation=~".*02_Support_Policy_v2.*" OR jsonPayload.tier="Tier 3"
  ```
- Threshold: $> 0$ triggers a critical alert for policy precedence violation.

---

### 70. Distributed Trace Span Naming Conventions
- `auth:verify_id_token`
- `db:firestore:get_order`
- `llm:gemini:tool_call`
- `mutation:stage_action`
- `db:firestore:write_ledger_entry`

---

## Track 8: Cost Optimization & Cloud Economics

### 71. Cloud Run Monthly Cost Estimation
- **Assumptions**: 5,000 requests/day, 1 vCPU, 2 GiB RAM, average duration 2.5s.
- **Compute Calculation**:
  - Total seconds/month = $5000 \times 30 \times 2.5\text{s} = 375,000\text{ vCPU-seconds}$.
  - Free tier covers 180,000 vCPU-seconds.
  - Billable vCPU = 195,000 seconds $\times \$0.00002400 \approx \$4.68$.
  - Billable Memory = $195,000 \times 2\text{ GiB} \times \$0.00000250 \approx \$0.98$.
  - Total Monthly Cloud Run Compute Cost: **$\approx \$5.66 / \text{month}$**.

---

### 72. Client-Side vs. Server-Side PDF Economics
- **Client-Side (`jspdf`)**: Free compute (uses customer browser CPU/RAM); ideal for standard transaction summaries.
- **Server-Side Shift**: Makes financial sense only when generating >100-page bulk monthly audits or when legal immutability requires signed server certificates.

---

### 73. Circuit Breaker for Third-Party LLM Spend
- Store daily API token usage counter in Redis.
- When daily spend estimate reaches 90% of budget cap ($50/day), activate circuit breaker: reject non-essential calls and fall back to rule-based evaluation.

---

### 74. Right-Sizing Memory & Preventing OOM
- Run load test with `k6` executing 50 concurrent PDF exports.
- Monitor `container/memory/utilization`. If peak memory reaches 1.4 GiB on 2 GiB allocation, maintain 2 GiB to provide 30% headroom during traffic spikes.

---

### 75. Named Firestore Database Cost Considerations
- Multiple named databases under the same GCP project share the same pricing tier ($0.06 per 100k reads, $0.18 per 100k writes).
- Optimize listener costs by unsubscribing inactive React views on component unmount (`useEffect` return cleanup).

---

### 76. Firestore vs. Cloud SQL Cost Crossover Point
- Firestore: Cost grows linearly with read/write operations.
- Cloud SQL (db-f1-micro / db-g1-small): Fixed cost $\approx \$25 - \$50/\text{month}$.
- **Crossover Point**: At $\approx 500,000$ ledger transactions/day (where Firestore operations reach $\approx \$50/\text{month}$), Cloud SQL becomes more cost-effective.

---

### 77. Minimum Instances Economics
- `min-instances=1` (1 vCPU, 2 GiB RAM running 24/7):
  - $730\text{ hours} \times 3600\text{s} = 2,628,000\text{ seconds}$.
  - Idle CPU allocated cost: $\approx \$18.50/\text{month}$.
  - **Verdict**: Justified for enterprise SLAs to eliminate 4-second cold-start delays.

---

### 78. Cost Attribution Strategy
- Apply GCP resource labels:
  - `cost_center: "customer_portal"` vs `cost_center: "internal_ops"`
  - `environment: "production"`
- Export GCP Billing data to BigQuery to visualize cost breakdown per user role.

---

### 79. Frontend Bundle Size & CDN Egress Optimization
- Use dynamic imports (`React.lazy`) for heavy libraries (`jspdf`, `canvas-confetti`, `lucide-react`).
- Enable Gzip / Brotli compression on Cloud CDN, reducing JS bundle transfer from 1.8 MB to under 420 KB, reducing egress bandwidth costs by 75%.

---

### 80. "Bill Shock" 20x Cost Spike Postmortem Runbook
```
1. TRIAGE: Open Cloud Run & Firestore metrics dashboards to locate the spike origin.
2. HYPOTHESIS 1 - Firestore Reconnect Loop: Check for exponential spikes in Firestore read counts (indicates broken onSnapshot listener reconnecting in an infinite loop).
3. HYPOTHESIS 2 - Agentic Loop Runaway: Check Cloud Logging for recursive tool calls executing without termination condition.
4. HYPOTHESIS 3 - Autoscaling Misconfiguration: Verify if max-instances was accidentally increased or min-instances set to high value.
5. REMEDIATE: Deploy hotfix or cap max-instances immediately.
```
