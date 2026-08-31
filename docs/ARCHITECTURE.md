# AegisOps System Architecture Specification
**Autonomous B2B Logistics Support & Operations Engine — Agentic HITL Lifecycle, Firestore Immutable Ledger, RBAC Tenant Isolation & OpenTelemetry Tracing**

---

## 1. Executive System Topology & Architectural Overview

**AegisOps** is a deterministic, enterprise-grade Autonomous Support & Operations Engine built for mission-critical logistics networks. It bridges non-deterministic Large Language Model (LLM) reasoning with strictly deterministic operational and billing ledgers.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT / OPERATOR WEB LAYER                               │
│  - Multi-Tenant Header & Account Switcher (Northstar, LumenWorks, Beacon, Axis Labs)    │
│  - Role Selector (Customer Portal vs. Internal Ops) with Anti-Snoop Protection           │
│  - Real-Time Dual-Currency Formatter ($ USD / ₹ INR @ ₹84/$1)                              │
│  - Conversational Agent Workspace & Ops Anomaly Radar Feed (SEV-0/1 Incidents)           │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ User Action / Prompt / Telemetry Ingestion
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             AGENTIC DETERMINISTIC TOOL ENGINE                            │
│  - Strict JSON Schema Validation (Draft 2020-12) & Injection Shield                      │
│  - Tenant-Boundary Interceptor (Data-Layer Multi-Tenant Scoping)                         │
│  - Deterministic Temporal Difference Engine (Anchored to Master Reference Time)          │
│  - 3-Tier Precedence Engine (Tier 1 Overrides > Tier 2 Active SOPs > Tier 3 Quarantined) │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ Staged Mutation Proposal
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           2-PHASE HUMAN-IN-THE-LOOP (HITL) GATE                          │
│  Phase 1: Deterministic Multi-Action Staging (STAGED_AWAITING_CONFIRMATION)              │
│  - Visual Amber Approval Gate Component with Radial Progress Rings & Action Switcher Tabs│
│  - Explicit Document & Clause Citation with Precedence Tier Verification                 │
│  - "Stage All" Quick-Action Integration from Ops Anomaly Radar Clusters                  │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ Operator "Confirm & Execute" / "Confirm All"
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                        IMMUTABLE CLOUD FIRESTORE LEDGER LAYER                            │
│  - syncActionToFirestore (`addDoc` to `ledger_entries` collection, sequential batch)     │
│  - Secondary Write: voidTransactionInFirestore (Rollback flag `VOIDED` with audit trail) │
│  - Operator Attribution (UID, Email), Transaction Hash, Dual-Currency Amounts             │
│  - Real-Time Reactive Stream (`onSnapshot` via `subscribeToLiveLedgerEntries`)           │
│  - Committed Ledger Modal with Multi-Field Search, Facet Filters & Deep Audit Inspection │
│  - Real-Time Firestore Quota & Runaway Billing Circuit Breaker ($/₹ Live Estimation)     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agentic Human-in-the-Loop (HITL) Workflow & Multi-Action Staging

To prevent autonomous AI agents from unilaterally committing irreversible financial transactions, unauthorized cancellations, or invalid dispatch changes, AegisOps enforces an enhanced **Two-Phase Commit State Machine** supporting both individual and multi-action batch queueing:

```
[Customer Query / Incident Alert / Ops Radar Anomaly Cluster]
              │
              ▼
[Autonomous Analysis & Verification]
  ├─ 1. `lookup_order_data` (Verify shipment status, routes, timestamps)
  ├─ 2. `audit_policy_entitlements` (Evaluate Tier 1/2 contract clauses)
  └─ 3. `stage_state_action` (Emit structured mutation proposal or batch queue)
              │
              ▼
[PHASE 1: PREPARE (Multi-Action Staged Queue)]
  - `stagedActions: StagedStateAction[]` queue populated in memory
  - Zero database writes occur
  - `AmberApprovalGate.tsx` rendered with:
      * Top Batch Summary Bar (total queued items, cumulative credits, assessed fees)
      * Tabbed Action Switcher (`#1 ORD-1001`, `#2 ORD-2002`, etc.)
      * Exact Clause Citation, Precedence Tier, and Calculation Proof per item
              │
              ├── [Operator "Dismiss" / "Discard All"] ──▶ Discarded cleanly (0 side-effects)
              │
              ▼
[PHASE 2: COMMIT (Attestation & Batch Execution)]
  - Operator clicks "Confirm & Execute" (Single Item) or "Confirm All (N)" (Batch)
  - Radial progress ring displays real-time execution feedback
  - Sequentially commits `syncActionToFirestore` for each staged payload
  - Unique transaction hashes generated & appended to permanent ledger
  - Local state derived reactively from confirmed ledger events with OpenTelemetry tracing
              │
              ▼
[SECONDARY WRITE: REVERT / VOID WORKFLOW]
  - Operator can trigger "Revert Last Batch" in the Committed Ledger Modal
  - Executes `voidTransactionInFirestore` to update document status to `VOIDED`
  - Stores `voidedAt`, `voidReason`, and operator attribution for complete audit compliance
```

---

## 3. Firestore-Backed Immutable Ledger Architecture (`firebaseLedger.ts`)

In production enterprise deployments, transient client-side state is insufficient for financial compliance and multi-operator collaboration. AegisOps transitions all state mutations to a durable, audit-compliant Cloud Firestore database.

### 3.1 Persistence Service (`syncActionToFirestore`)
When a staged action is confirmed, `syncActionToFirestore` commits a structured document to the `ledger_entries` collection using `addDoc`:

```typescript
export async function syncActionToFirestore(
  stagedAction: StagedStateAction,
  options?: SyncActionOptions
): Promise<CommittedExecutionLog> {
  const txHash = options?.txHashOverride || 
    `TXN-${stagedAction.target_id.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestampStr = new Date().toLocaleTimeString();
  const isoCreatedAt = new Date().toISOString();
  const batchId = options?.batchId || `BATCH-${Date.now()}`;

  const firestorePayload: Record<string, any> = {
    action_type: stagedAction.action_type,
    target_id: stagedAction.target_id,
    account_id: stagedAction.account_id,
    timestamp: timestampStr,
    citation: stagedAction.citation,
    txHash: txHash,
    details: stagedAction.reason,
    documentName: stagedAction.documentName || 'Operating Policy',
    tierLevel: stagedAction.tierLevel || 'Standard',
    operatorUid: options?.operatorUid || 'system_operator',
    operatorEmail: options?.operatorEmail || 'operator@parcelpilot.internal',
    createdAt: isoCreatedAt,
    status: 'COMMITTED',
    batchId
  };

  if (stagedAction.amountUSD !== undefined) firestorePayload.amountUSD = stagedAction.amountUSD;
  if (stagedAction.amountINR !== undefined) firestorePayload.amountINR = stagedAction.amountINR;
  if (stagedAction.percentage !== undefined) firestorePayload.percentage = stagedAction.percentage;
  if (stagedAction.cancellation_fee_USD !== undefined) firestorePayload.feeUSD = stagedAction.cancellation_fee_USD;
  if (stagedAction.cancellation_fee_INR !== undefined) firestorePayload.feeINR = stagedAction.cancellation_fee_INR;

  const docRef = await addDoc(collection(db, 'ledger_entries'), firestorePayload);

  return {
    id: docRef.id,
    action_type: stagedAction.action_type,
    target_id: stagedAction.target_id,
    account_id: stagedAction.account_id,
    timestamp: timestampStr,
    amountUSD: stagedAction.amountUSD,
    amountINR: stagedAction.amountINR,
    percentage: stagedAction.percentage,
    feeUSD: stagedAction.cancellation_fee_USD,
    feeINR: stagedAction.cancellation_fee_INR,
    citation: stagedAction.citation,
    txHash: txHash,
    details: stagedAction.reason,
    documentName: stagedAction.documentName,
    tierLevel: stagedAction.tierLevel,
    operatorEmail: options?.operatorEmail || 'operator@parcelpilot.internal',
    status: 'COMMITTED',
    batchId,
    createdAt: isoCreatedAt
  };
}
```

### 3.2 Secondary Void Reversal Service (`voidTransactionInFirestore`)
```typescript
export async function voidTransactionInFirestore(
  targetDocId: string,
  txHash: string,
  options?: { operatorEmail?: string; voidReason?: string }
): Promise<{ success: boolean; voidedAt: string; txHash: string }> {
  const voidedAt = new Date().toISOString();
  const voidReason = options?.voidReason || 'Reverted by operator via Ledger Audit Modal';
  const operatorEmail = options?.operatorEmail || 'operator@parcelpilot.internal';

  if (db && targetDocId && !targetDocId.startsWith('doc_local_')) {
    const docRef = doc(db, 'ledger_entries', targetDocId);
    await updateDoc(docRef, {
      status: 'VOIDED',
      voidedAt,
      voidReason,
      voidedBy: operatorEmail
    });
  }
  return { success: true, voidedAt, txHash };
}
```

---

## 4. Multi-Tenant RBAC Isolation Model

In multi-tenant B2B logistics ecosystems, unauthorized cross-tenant data leakage is a catastrophic security breach. AegisOps enforces isolation at the **data retrieval and tool execution layer**, never relying on soft prompt instructions.

### 4.1 Dual-Role Architecture
1. **Customer Portal Role (`customer`)**:
   - Strictly scoped to the authenticated user's `sessionAccountId` (e.g., `ACCT-001` Northstar).
   - Account switcher is locked (`🔒 Locked to Tenant Context`) and disabled in the UI.
   - Any query attempting to inspect or mutate records of other tenants (e.g., LumenWorks `ORD-2001`) immediately aborts with `TenantAuthorizationError` (HTTP 403) and displays the `RbacErrorCard` (`403: SECURITY BOUNDARY INTERCEPT — DATA ISOLATION GUARD`) with zero metadata leakage.
   - The Amber Approval Gate only displays staged actions corresponding to the active tenant.
   - The cross-tenant Ops Anomaly Radar is hidden to maintain strict tenant privacy boundaries.
2. **Internal Operations Role (`internal_ops`)**:
   - Authorized for cross-tenant fleet monitoring, systemic carrier anomaly detection, and cross-account ticket routing.
   - Full access to the Ops Anomaly Radar global incident feed, batch staging workflows, and cross-account switching.

---

## 5. 3-Tier Precedence Engine & Temporal Anchoring

### 5.1 The 3-Tier Precedence Hierarchy
* **Tier 1: Customer Enterprise Agreements (Binding Overrides — Highest Rank)**
  - Documents: `05_Northstar_Logistics_Enterprise_Agreement.pdf`, `06_LumenWorks_Service_Agreement.pdf`
  - Overrides general SOPs for specific clauses (e.g., Northstar $0 cancellation fee when notice $\ge 2.0\text{h}$; 100% delay credit for carrier fault delay $\ge 2.0\text{h}$).
* **Tier 2: Active Operating SOPs (Standard Baseline)**
  - Documents: `01_Support_Policy_v3_CURRENT.pdf`, `03_Cancellation_and_Service_Credit_SOP_v4.pdf`, `04_Product_Operations_Guide_and_Known_Issues.pdf`
  - Applies to standard accounts (Beacon Retail, Axis Labs) and non-overridden terms.
* **Tier 3: Deprecated Documents & Historical Precedents (Strictly Banned)**
  - Documents: `02_Support_Policy_v2_DEPRECATED.pdf`, legacy raw ticket resolutions (`TKT-450`, `TKT-451`).
  - **Quarantined**: Physically excluded from the searchable index to prevent hallucination.

### 5.2 Deterministic Temporal Anchoring
To prevent hallucinated timestamps and time-drift errors:
- Master Reference Snapshot: `2026-08-16 11:00 Asia/Kolkata` (`2026-08-16T05:30:00Z`)
- All notice windows, delay hours, and SLA breach thresholds are calculated using deterministic epoch millisecond arithmetic:
  $$\text{DelayHours} = \frac{\text{REF\_TIMESTAMP} - \text{ScheduledPickupTime}}{3.6 \times 10^6\text{ ms}}$$

---

## 6. OpenTelemetry Distributed Tracing & Instrumentation (`tracer.ts`)

To guarantee strict operational auditability, performance profiling, and reliability debugging across the two-phase HITL lifecycle, AegisOps implements standard **OpenTelemetry (OTel)** tracing across the UI gate and storage service layers.

### 6.1 Semantic Attributes
* `service.name`: `aegisops-autonomous-engine`
* `telemetry.sdk.language`: `typescript`
* `aegisops.action_type`: `CREDIT` | `CANCEL_SHIPMENT` | `ESCALATE_TICKET` | `FEE_WAIVER`
* `aegisops.target_id`: Resource ID (e.g. `ORD-1001`, `TCK-501`)
* `aegisops.account_id`: Tenant ID (`ACCT-001`, `ACCT-002`, etc.)
* `aegisops.tx_hash`: Unique immutable transaction identifier (`TXN-ORD1001-XXXX`)
* `aegisops.tier_level`: `Tier 1: Enterprise Agreement` | `Tier 2: Current SOP`
* `db.system`: `firestore`, `db.collection.name`: `ledger_entries`
* `db.operation`: `addDoc` | `updateDoc`
