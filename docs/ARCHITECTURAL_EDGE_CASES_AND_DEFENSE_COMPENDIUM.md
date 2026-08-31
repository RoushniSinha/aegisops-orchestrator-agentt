# PARCELPILOT ARCHITECTURAL AUDIT, EDGE-CASE RESOLUTIONS & DEFENSE DOSSIER
**Autonomous Support & Operations Engine — Comprehensive Technical Resolutions for All Edge Cases and Architectural Defense Criteria**

---

# DELIVERABLE 1: THE UNEXPLORED EDGE-CASE QUESTION PACK (EXHAUSTIVE RESOLUTIONS)

---

## 1. Data Contradiction & Source Poisoning Edge Cases

### Q1.1 — Executive Override Contradicting Both Tiers: Formal Process-Level Escape Hatch
#### 1. Problem & Context
Historical ticket notes (such as TKT-450) are strictly quarantined as untrusted context. However, in enterprise B2B operations, situations arise where a C-level executive or Vice President of Customer Operations negotiates a verbal or email-based one-time commercial exception (e.g., custom fee waivers or non-standard credit terms). If the architecture treats all ticket notes as untrusted, how does a legitimate executive commitment become legally and computationally binding without requiring a full software release/re-deployment?

#### 2. Architectural Escape Hatch & Ingestion Pipeline
Verbal commitments and ticket comments are structurally banned from direct ingestion into `CLAUSE_SUMMARY_INDEX` and `FULL_DOCUMENT_PDF_CHUNKS`. To make an executive override binding, ParcelPilot implements an **Addendum Ingestion & Attestation Pipeline**:

```
[Executive Exception Signed / Approved]
                   │
                   ▼
     [Formal Contract Addendum PDF]
(e.g., "05_Northstar_Logistics_Addendum_2026_08.pdf")
                   │
                   ▼
  [Cryptographic Hash & Officer Attestation]
  - Signed by VP/General Counsel
  - Stored in Cloud Storage: gs://parcelpilot-contract-vault/addendums/
                   │
                   ▼
      [Tier 1 Ingestion Service]
  - Parsed into AST with `effective_date`, `expiration_date`, `precedence: TIER_1_ADDENDUM`
  - Injected into `CLAUSE_SUMMARY_INDEX` with explicit override scope
                   │
                   ▼
[Live Model & Tool Engine Evaluation]
```

#### 3. Mutation of `CLAUSE_SUMMARY_INDEX` & Authorization Model
To ingest an executive addendum into `CLAUSE_SUMMARY_INDEX`, the following node is registered:

```typescript
export interface ContractAddendumNode extends ClauseSummaryNode {
  isExecutiveAddendum: true;
  attestationMetadata: {
    signatoryVP: string;
    legalApprovalId: string;
    effectiveDate: string;
    expirationDate: string;
    overrideClauseReference: string; // e.g. "Clause 4.1"
  };
}

// Ingestion via Authorized Admin Service:
export class ContractRegistryAdmin {
  public static ingestExecutiveAddendum(
    addendum: ContractAddendumNode,
    operatorRole: string,
    signatureToken: string
  ): void {
    if (operatorRole !== 'legal_admin' && operatorRole !== 'vp_operations') {
      throw new TenantAuthorizationError('SYSTEM', 'CONTRACT_VAULT', 'INGEST_ADDENDUM');
    }
    // Verify cryptographic signature token against Legal Public Key
    CryptoService.verifyAttestation(addendum, signatureToken);
    
    // Ingest into dynamic index with highest Tier 1 priority boost
    DynamicClauseRegistry.registerNode(addendum);
  }
}
```
**Who is authorized**: Only users authenticated with the `legal_admin` or `vp_operations` custom claims in Firebase Auth can authorize addendum registration. Standard CSMs, support agents, and AI agents cannot unilaterally convert ticket commentary into binding contractual rules.

---

### Q1.2 — Conflicting Telemetry vs. Self-Reported Customer Claim: Trust Ordering & Disputed State
#### 1. Problem & Context
A carrier driver hardware scan indicates `DRIVER_PICKED_UP` at 09:35, but an inbound customer support ticket at 09:40 asserts: *"Driver never arrived, warehouse is empty."* Currently, `validateTelemetryGuard` only audits against unrecorded pickups (driver picked up while DB says `BOOKED`). When human claims contradict physical telemetry, a naive "first-writer-wins" or blind webhook trust creates severe operational failure modes.

#### 2. Domain State Design: `DisputedTelemetryState`
To prevent automated mutations under conflicting evidence, we introduce `DisputedTelemetryState` as an explicit sub-state in `src/models/OrderState.ts`:

```typescript
export class DisputedTelemetryState implements IOrderState {
  public readonly status = 'DISPUTED_TELEMETRY';

  constructor(
    public readonly reportedPhysicalStatus: OrderLifecycleStatus,
    public readonly disputeReason: string,
    public readonly disputedAt: string,
    public readonly ticketId: string
  ) {}

  public canCancel(): boolean {
    // Block automated cancellation while telemetry is under formal carrier dispute
    return false;
  }

  public canIssueCredit(): boolean {
    // Block automatic service credit calculation until root-cause arbitration resolves
    return false;
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'CANCELLED' || target === 'PICKED_UP' || target === 'DELAYED') {
      // Allowed ONLY via human carrier-arbitration supervisor override
      order.setStatus(target);
    } else {
      throw new InvalidStateTransitionError(
        order.id,
        this.status,
        target,
        `Order is locked in DISPUTED_TELEMETRY. Requires Carrier Supervisor Resolution.`
      );
    }
  }

  public validateTelemetryGuard(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    return {
      hasInconsistency: true,
      code: 'TELEMETRY_STATUS_MISMATCH',
      details: `Active human dispute ticket ${this.ticketId} conflicts with driver scan: ${this.disputeReason}`,
    };
  }
}
```

#### 3. Default Trust Ordering Matrix
When telemetry and human assertions collide:
1. **Financial & Mutative Safety**: Financial operations (`stage_state_action` for credits or fee waivers) are **immediately halted** (fail-safe posture).
2. **Deterministic Evidence Triage**:
   - Level A: GPS Geofence & Hardware Scans (Driver device within 50m of warehouse geofence at timestamp).
   - Level B: Warehouse CCTV / Dispatch Dock Telemetry (Signed gate pass or signature image).
   - Level C: Customer Support Ticket freeform text.
3. **Arbitration Workflow**: If Level A exists, the system flags the ticket for *Carrier Supervisor Review* before any state change. Neither source silently overwrites the other.

---

### Q1.3 — Cross-Tier Textual Collision: Mathematical Proof of Precedence Guarantee
#### 1. Problem & Context
In keyword-scoring heuristics, if a Tier 2 SOP matches 6 overlapping keywords ($6 \times 0.2 = 1.2$) while a Tier 1 contract clause matches 2 keywords ($2 \times 0.2 = 0.4$), an unweighted scoring algorithm might mistakenly rank the generic Tier 2 SOP higher than the authoritative Tier 1 Enterprise Agreement.

#### 2. Mathematical Proof of Precedence
To ensure Tier 1 strictly dominates Tier 2 across all query permutations, we establish a **Lexicographic Tier Weighting Formula**:

$$\text{FinalScore}(C) = W_{\text{tier}}(C) \times 10^3 + W_{\text{account}}(C) \times 10^2 + \text{BM25Similarity}(Q, C)$$

Where:
- $W_{\text{tier}}(\text{Tier 1}) = 1.0$
- $W_{\text{tier}}(\text{Tier 2}) = 0.5$
- $W_{\text{tier}}(\text{Tier 3}) = -\infty$ (physically banned/quarantined)
- $W_{\text{account}}(\text{Account Exact Match}) = 1.0$ (otherwise $0.0$)
- $\text{BM25Similarity}(Q, C) \in [0.0, 10.0]$

**Proof by Inequality**:
Let $C_1$ be any Tier 1 clause for `ACCT-001` with minimum query overlap ($\text{BM25} = 0.1$).
$$\text{FinalScore}(C_1) = (1.0 \times 1000) + (1.0 \times 100) + 0.1 = 1100.1$$

Let $C_2$ be any Tier 2 SOP clause with theoretical maximum query overlap ($\text{BM25} = 10.0$):
$$\text{FinalScore}(C_2) = (0.5 \times 1000) + (0.0 \times 100) + 10.0 = 510.0$$

Since $1100.1 > 510.0$ strictly, $\forall Q, \text{Score}(C_1) > \text{Score}(C_2)$.
Hence, **Tier 1 clauses are mathematically guaranteed to outrank Tier 2 SOPs regardless of keyword frequency.**

---

### Q1.4 — Deprecated-Policy Resurrection via Full-Document Fallback: Structural Invariant Guard
#### 1. Problem & Context
If a future maintainer inadvertently includes a chunk from `02_Support_Policy_v2_DEPRECATED.pdf` into `FULL_DOCUMENT_PDF_CHUNKS`, relying on `chunks[0]` as a blind fallback could resurrect deprecated policy in production.

#### 2. Code-Level Invariant Enforcement
We insert a strict runtime metadata filter and a fail-closed validator directly into `searchFullDocumentChunks`:

```typescript
export function searchFullDocumentChunks(query: string, accountId: string): DocumentChunkResult {
  // 1. Mandatory Code-Level Quarantine Filter
  const sanitizedChunks = FULL_DOCUMENT_PDF_CHUNKS.filter(chunk => {
    const isDeprecatedDoc = 
      chunk.documentName.includes('02_Support_Policy_v2') ||
      chunk.documentName.toLowerCase().includes('deprecated') ||
      chunk.tierLevel === 'Tier 3';
    
    if (isDeprecatedDoc) {
      // Emit security alert to Cloud Logging
      console.error(`[SECURITY ALERT] Blocked retrieval attempt on quarantined Tier 3 document: ${chunk.documentName}`);
      return false;
    }
    return true;
  });

  if (sanitizedChunks.length === 0) {
    throw new ContractPrecedenceViolationError('ALL_CHUNKS_QUARANTINED', accountId);
  }

  // 2. Account-Aware Matching
  const matches = sanitizedChunks.filter(c => c.applicableAccountId === accountId);
  if (matches.length > 0) {
    return { chunk: matches[0], matchScore: 1.0, retrievalStrategy: 'FULL_DOCUMENT_DEEP_SCAN' };
  }

  // 3. Fallback exclusively to Active Standard SOP v3
  const standardFallback = sanitizedChunks.find(c => c.documentName.includes('01_Support_Policy_v3'));
  if (!standardFallback) {
    throw new ContractPrecedenceViolationError('ACTIVE_SOP_V3_MISSING', accountId);
  }

  return { chunk: standardFallback, matchScore: 0.5, retrievalStrategy: 'FULL_DOCUMENT_DEEP_SCAN' };
}
```

#### 3. Automated CI Regression Test
```typescript
describe('CI/CD Precedence Security Guard', () => {
  it('MUST NEVER return or index any chunk originating from 02_Support_Policy_v2', () => {
    const deprecatedKeywords = ['INR 250 fee after 30 minutes', 'Support Policy v2', 'DEPRECATED'];
    for (const kw of deprecatedKeywords) {
      const result = searchFullDocumentChunks(kw, 'ACCT-001');
      expect(result.chunk.documentName).not.toContain('02_Support_Policy_v2');
      expect(result.chunk.tierLevel).not.toBe('Tier 3');
    }
  });
});
```

---

### Q1.5 — Intra-Tier Conflict Detection Between Two Same-Account Clauses
#### 1. Problem & Context
If an enterprise agreement contains two conflicting clauses within Tier 1 (e.g., Clause 4.2 granting 100% credit at $\ge 2.0\text{h}$ vs. an amended Force Majeure Clause 9.1 denying credit during regional weather emergencies), an unguided index could return an arbitrary clause.

#### 2. Intra-Tier Conflict Resolution Engine
```typescript
export interface IntraTierConflictResolution {
  hasConflict: boolean;
  competingClauses?: ClauseSummaryNode[];
  resolutionAction: 'APPLY_SPECIFIC_CARVEOUT' | 'ESCALATE_TO_LEGAL' | 'LATEST_ADDENDUM_WINS';
  resolvedClause?: ClauseSummaryNode;
}

export class IntraTierConflictDetector {
  public static detectAndResolve(
    candidates: ClauseSummaryNode[],
    context: { isForceMajeure: boolean; incidentDate: string }
  ): IntraTierConflictResolution {
    const tier1Nodes = candidates.filter(c => c.tierLevel === 'Tier 1');
    
    if (tier1Nodes.length <= 1) {
      return { hasConflict: false, resolvedClause: tier1Nodes[0] };
    }

    // Check for Specificity Carve-Out (Specialia generalibus derogant)
    const specificCarveOut = tier1Nodes.find(n => n.topic === 'force_majeure' && context.isForceMajeure);
    if (specificCarveOut) {
      return {
        hasConflict: true,
        competingClauses: tier1Nodes,
        resolutionAction: 'APPLY_SPECIFIC_CARVEOUT',
        resolvedClause: specificCarveOut,
      };
    }

    // Check for Temporal Succession (Later Amendment overrides earlier contract)
    tier1Nodes.sort((a, b) => new Date(b.effectiveDate || 0).getTime() - new Date(a.effectiveDate || 0).getTime());
    
    return {
      hasConflict: true,
      competingClauses: tier1Nodes,
      resolutionAction: 'LATEST_ADDENDUM_WINS',
      resolvedClause: tier1Nodes[0],
    };
  }
}
```

---

## 2. Multi-Step Execution & State Boundary Traps

### Q2.1 — Stage/Commit Race Condition on Cancellation: Optimistic Concurrency Control (OCC)
#### 1. Problem & Trace
- **T0 (09:00)**: Customer opens UI for `ORD-1001` (status: `BOOKED`).
- **T1 (09:01)**: Agent stages `CANCEL_SHIPMENT` in local React state.
- **T2 (09:02)**: Driver arrives at dock; carrier webhook executes `PATCH /api/orders/ORD-1001` setting status to `PICKED_UP` and updating `version: 2`.
- **T3 (09:03)**: Customer clicks *"Confirm & Execute"* in `AmberApprovalGate.tsx`.
- **Vulnerability**: `handleConfirmStagedAction` commits the cancellation against the stale in-memory snapshot, canceling a physically in-transit shipment.

#### 2. Architectural Remedy: Atomic Version-Checked Mutation
We enforce Optimistic Concurrency Control (OCC) within a Firestore/Database transaction:

```typescript
export async function executeAtomicStateCommit(
  stagedAction: StagedStateAction,
  expectedOrderVersion: number
): Promise<{ success: boolean; txId: string }> {
  const db = getFirestore();
  const orderRef = doc(db, 'orders', stagedAction.target_id);
  const ledgerRef = collection(db, 'ledger_entries');

  return await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Order ${stagedAction.target_id} does not exist.`);
    }

    const liveOrder = orderSnap.data() as OrderOperationalRecord;

    // 1. Invariant: Status Version Check
    if (liveOrder.version !== expectedOrderVersion) {
      throw new ConflictException(
        `CONCURRENCY_RACE: Order ${liveOrder.order_id} was modified concurrently (Version: ${liveOrder.version}, Expected: ${expectedOrderVersion}). Current status is '${liveOrder.status}'.`
      );
    }

    // 2. Invariant: Domain State Check
    const stateInstance = OrderStateFactory.fromStatus(liveOrder.status);
    if (!stateInstance.canCancel()) {
      throw new InvalidStateTransitionError(
        liveOrder.order_id,
        liveOrder.status,
        'CANCELLED',
        `Physical pickup occurred while action was pending review.`
      );
    }

    // 3. Atomic Updates
    transaction.update(orderRef, {
      status: 'CANCELLED',
      version: liveOrder.version + 1,
      updated_at: new Date().toISOString(),
    });

    const ledgerDocRef = doc(ledgerRef);
    transaction.set(ledgerDocRef, {
      id: ledgerDocRef.id,
      order_id: liveOrder.order_id,
      account_id: stagedAction.account_id,
      action_type: stagedAction.action_type,
      cancellation_fee_INR: stagedAction.cancellation_fee_INR,
      status: 'EXECUTED',
      timestamp: new Date().toISOString(),
    });

    return { success: true, txId: ledgerDocRef.id };
  });
}
```

---

### Q2.2 — Partial Commit Across Dual Writes: Two-Phase Transactional Boundary
#### 1. Problem & Context
An operation requires updating both (a) Ticket status to `ESCALATED` and (b) Ledger entries with an audit credit record. If step (b) succeeds but React local state crashes or the browser tab is closed, state becomes desynchronized.

#### 2. Architecture: Single-Source Ledger Event Sourcing
Rather than managing multi-table distributed transactions across heterogeneous React states, ParcelPilot adopts an **Event-Sourced Ledger Architecture**:

```
[Confirm & Execute]
        │
        ▼
[Firestore Atomic Transaction]
  ├─ 1. Write `ledger_entries` record (Authoritative Source of Truth)
  └─ 2. Write `ticket_mutations` record
        │
        ▼
[Firestore onSnapshot / Event Stream]
  └─ Real-time listener reconciles UI views (Tickets, Orders, Radar)
     strictly derived from confirmed Ledger Records.
```
If the network connection drops mid-operation, the background listener reconciles the frontend on reconnect, guaranteeing eventual consistency.

---

### Q2.3 — Double-Confirmation Race (Chat Text + Button Click)
#### 1. Problem & Context
The chat engine processes words like *"yes/approve"* as confirmation triggers, while `AmberApprovalGate.tsx` has a button. If an operator types *"yes"* and simultaneously clicks the button on a high-latency link, two requests fire with identical payloads.

#### 2. Deterministic Idempotency Key Gate
```typescript
const inFlightConfirmations = new Set<string>();

export async function handleConfirmStagedActionSafe(stagedAction: StagedStateAction): Promise<void> {
  const idempotencyKey = `CONFIRM_${stagedAction.id}_${stagedAction.target_id}`;

  if (inFlightConfirmations.has(idempotencyKey)) {
    console.warn(`[IDEMPOTENCY] Blocked duplicate concurrent execution for ${idempotencyKey}`);
    return;
  }

  inFlightConfirmations.add(idempotencyKey);
  try {
    await executeAtomicStateCommit(stagedAction, stagedAction.expectedVersion);
  } finally {
    // Retain lock for 10 seconds to swallow delayed network retries
    setTimeout(() => inFlightConfirmations.delete(idempotencyKey), 10000);
  }
}
```

---

### Q2.4 — Expired Staged Action Validation (TTL Enforcement)
#### 1. Problem & Context
A staged proposal created at 09:00 remains open in the operator's browser until 14:00. By 14:00, shipment conditions and delay metrics have changed significantly.

#### 2. Code-Level TTL Enforcement
In `AmberApprovalGate.tsx` and `handleConfirmStagedAction`:

```typescript
export function validateStagedActionExpiry(stagedAction: StagedStateAction): void {
  const now = Date.now();
  const createdAt = new Date(stagedAction.timestamp).getTime();
  const ttlMs = (stagedAction.ttlMinutes || 15) * 60 * 1000;

  if (now > createdAt + ttlMs) {
    const expiredAt = new Date(createdAt + ttlMs).toISOString();
    throw new StagedActionExpiredException(stagedAction.id, expiredAt);
  }
}
```
When `StagedActionExpiredException` fires, the UI automatically invalidates the amber card, displays a notification (*"Proposal Expired — Shipment State Re-evaluated"*), and prompts the operator to generate a fresh calculation.

---

### Q2.5 — Cross-Tab Staged Action Divergence: Centralized `staged_mutations` Collection
#### 1. Problem & Context
If an operator opens two tabs and stages different actions for `ORD-1001` (Tab 1: Cancel; Tab 2: Issue Service Credit), in-memory React state allows conflicting proposals.

#### 2. Distributed Firestore Lock Schema
```
Collection: staged_mutations
Document ID: `LOCK_${order_id}`
{
  "orderId": "ORD-1001",
  "activeMutationId": "STG-MUT-981",
  "stagedBySession": "SES-8821",
  "mutationType": "CANCEL_SHIPMENT",
  "status": "PENDING_REVIEW",
  "expiresAt": "2026-08-16T11:15:00Z"
}
```
When a tab attempts to stage an action, it attempts a conditional write on `staged_mutations/LOCK_ORD-1001`. If an active lock exists from another session/tab, the operation is rejected with `ConcurrentStagingConflictError`.

---

## 3. Temporal Snapshot & Timezone Ambiguity

### Q3.1 — Inconsistent Reference Clocks: Single Authoritative Operational Timestamp
#### 1. Problem & Context
The dataset references two timestamps:
- Codebase constant: `2026-03-01T00:00:00Z` (UTC)
- Dataset operational context: `2026-08-16 11:00 Asia/Kolkata` (IST, UTC+05:30)

#### 2. Canonical Clock Specification
To ensure 100% deterministic SLA calculations, the system establishes a single **Master Temporal Reference**:

$$\text{T}_{\text{ref}} = \text{"2026-08-16T11:00:00+05:30"} \equiv \text{"2026-08-16T05:30:00Z"}$$

All timestamps parsed from carrier feeds without explicit offsets are treated under the domain's default operational timezone (`Asia/Kolkata` / UTC+05:30) via a strict ISO-8601 parser:

```typescript
export function parseOperationalTimestamp(raw: string): number {
  if (raw.endsWith('Z') || raw.includes('+')) {
    return new Date(raw).getTime();
  }
  // Coerce naive local strings to canonical IST (+05:30)
  return new Date(`${raw}+05:30`).getTime();
}
```

---

### Q3.2 — Boundary Semantics of Pickup Windows
#### 1. Problem & Context
For a pickup window scheduled between 10:30 and 11:30, if evaluation occurs at 11:15, is the carrier in breach?

#### 2. Domain Rule Specification
- **During Window (10:30–11:30)**: Status is `SCHEDULED_IN_WINDOW`. Delay is mathematically **0.0 hours**.
- **Post Window End ($T > 11:30$)**: Delay begins accumulating from `pickup_window_end` (11:30), **not** `pickup_window_start` (10:30).
- **At 11:15**: Carrier is **not in breach**. The automated response to the customer clarifies:
  *"Shipment ORD-1001 is within its committed pickup window (10:30–11:30 IST). The carrier has 15 minutes remaining before an SLA delay occurs."*

---

### Q3.3 — Notice-Period Anchor Ambiguity: Anchoring to Request Time
#### 1. Problem & Context
If an order was booked at 09:00 for a 12:00 pickup, and the customer filed a cancellation ticket at 09:30 (2.5h notice), but support processes the ticket at 11:00 (1.0h notice), anchoring notice calculation to evaluation time would unfairly penalize the customer.

#### 2. Mathematical Rule
$$\text{NoticeHours} = \frac{\text{Timestamp}(\text{pickup\_window\_start}) - \text{Timestamp}(\text{cancellation\_requested\_at})}{3.6 \times 10^6\text{ ms}}$$

**Rule**: The notice period is permanently anchored to `cancellation_requested_at` (the customer's logged timestamp), **never** to the agent's review time (`SYSTEM_REFERENCE_TIME`).

---

### Q3.4 — DST-Adjacent Date Math: UTC Epoch Millisecond Arithmetic
To prevent Daylight Saving Time (DST) shifts from corrupting delay intervals across international carrier routes:
- All timestamp calculations convert immediately to **Epoch Milliseconds (UTC)**.
- Interval arithmetic is computed on scalar integers ($h = \Delta\text{ms} / 3,600,000$), completely bypassing local wall-clock calendar variations.

---

## 4. RBAC & Data-Layer Infiltration

### Q4.1 — Enumeration via Error-Message Asymmetry: Constant-Time Redaction
#### 1. Problem & Vulnerability
Returning `Order 'X' not found` for non-existent IDs vs. `RBAC_VIOLATION` for cross-tenant IDs allows an attacker to enumerate all valid order IDs across the enterprise.

#### 2. Unified Blind Error Response Contract
```typescript
export function verifyTenantOrderAccess(order: OrderOperationalRecord | undefined, sessionAccountId: string, role: string): OrderOperationalRecord {
  const isAccessible = order && (role === 'internal_ops' || order.account_id === sessionAccountId);
  
  if (!isAccessible) {
    // Constant-time execution path: return identical generic message
    throw new OrderNotFoundOrUnauthorizedError(
      `Order reference does not exist or is not accessible within your current tenant authorization scope.`
    );
  }
  return order;
}
```

---

### Q4.2 — Ops Anomaly Radar Cross-Tenant Redaction
#### 1. Problem & Architecture
`radar_anomaly_scan` provides global fleet analytics to `internal_ops`. When aggregate insights are communicated to a customer-role user, cross-tenant data must be redacted.

#### 2. Tenant-Scoped Redaction Filter
```typescript
export function getRadarMetricsForRole(radarResult: RadarScanResult, userRole: string, userAccountId: string): RadarScanResult {
  if (userRole === 'internal_ops') {
    return radarResult; // Full operational visibility
  }

  // Redact customer view: include only the tenant's own affected shipments
  return {
    carrierCounts: radarResult.carrierCounts, // High-level network carrier status
    affected_shipments_count: radarResult.carrierDelayedOrders.filter(o => o.account_id === userAccountId).length,
    carrierDelayedOrders: radarResult.carrierDelayedOrders.filter(o => o.account_id === userAccountId),
    highPrioritySla: radarResult.highPrioritySla.filter(t => t.account_id === userAccountId),
    incidentBanner: radarResult.incidentBanner,
  };
}
```

---

### Q4.3 — Centralized Authorization Interceptor Layer
#### 1. Problem & Context
Enforcing RBAC inside individual tool functions risks omission when new tools are added.

#### 2. Dispatch Middleware Pattern
```typescript
export class ToolAuthorizationMiddleware {
  public static async executeWithAuth<TParams, TResult>(
    toolName: string,
    params: TParams,
    context: { role: string; accountId: string },
    handler: (params: TParams) => Promise<TResult>
  ): Promise<TResult> {
    // 1. Centralized RBAC Guard
    if (context.role !== 'internal_ops') {
      const requestedAccountId = (params as any).account_id;
      if (requestedAccountId && requestedAccountId !== context.accountId) {
        throw new TenantAuthorizationError(context.accountId, requestedAccountId, toolName);
      }
    }

    // 2. Audit Logging
    AuditLogger.logToolAccess(toolName, context);

    // 3. Delegate to Tool Handler
    return await handler(params);
  }
}
```

---

### Q4.4 — Defense-in-Depth Against Client-Side Account-Switcher Tampering
Even if a malicious user uses browser developer tools to modify React state (`activeAccountId = 'ACCT-001'`), all API requests validate the JWT bearer token claims verified by Firebase Auth on the server. If the token's embedded `accountId` claim does not match the requested resource, the server rejects the request with HTTP 403 Forbidden.

---

# DELIVERABLE 2: ARCHITECTURAL DEFENSE & JUSTIFICATION DOSSIER (SUMMARY TABLE)

| # | Architectural Pillar | Chosen Design Pattern | Alternative Rejected | Core Justification & Trade-off |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Dual-Role RBAC** | Deterministic Tool Boundary Interceptor | Prompt-Based System Instructions | Prompt instructions are vulnerable to injection; deterministic code-level checks cannot be bypassed by prompt manipulation. |
| **2** | **3-Tier Precedence Engine** | Lexicographic Tier Ingestion & Physical Quarantine | Semantic Vector Embedding RAG | Vector search ranks by similarity rather than legal hierarchy, leading to hallucinated or deprecated policy citations. |
| **3** | **Two-Phase Commit HITL** | Staged Proposal $\to$ Amber Gate $\to$ Ledger Commit | Single-Turn Autonomous Tool Execution | Prevents unreviewed financial writes and ensures full operator auditability. |
| **4** | **Temporal Anchoring** | Fixed Operational Reference Timestamp ($\text{T}_{\text{ref}}$) | LLM-Calculated Time/Intervals | Eliminates LLM arithmetic errors on date intervals and timezone offsets. |
| **5** | **Ops Anomaly Radar** | Systemic Carrier Delay Clustering | Reactive Ticket-by-Ticket Triage | Converts disparate support tickets into actionable, fleet-wide carrier hub escalations. |
| **6** | **Primary Evaluation Metric** | First-Contact Entitlement Accuracy (FCEA) | CSAT / LLM Perplexity | Evaluates exact contractual compliance, tier adherence, and financial precision rather than user sentiment. |
