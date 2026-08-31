# ParcelPilot Architecture Note

## 1. System Architecture Overview

ParcelPilot is an autonomous B2B Support & Operations Engine designed for mission-critical logistics networks. It bridges conversational AI with deterministic operational and billing ledgers, ensuring strict policy compliance, zero-hallucination entitlement evaluations, and safe transactional state mutations.

```
                  +-------------------------------------------------------------+
                  |                  Client / Operator Web UI                   |
                  |     (Role Dropdown, Account Switcher, Dual Currency)        |
                  +------------------------------+------------------------------+
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |                 Data-Layer RBAC Enforcement                 |
                  |           (Strict Tenant Scoping vs Global Ops)             |
                  +------------------------------+------------------------------+
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |               3-Tier Policy Precedence Engine               |
                  |     Tier 1: Enterprise Agreements (Binding Override)        |
                  |     Tier 2: Active Operating SOPs (v3/v4)                   |
                  |     Tier 3: Deprecated v2 & Past Notes (STRICTLY BANNED)    |
                  +------------------------------+------------------------------+
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |       2-Phase Multi-Action Human-in-the-Loop Gate           |
                  |     Phase 1: STAGED_AWAITING_CONFIRMATION (Amber Gate)      |
                  |     Phase 2: Atomic Batch Confirmation & Firestore Commit   |
                  +------------------------------+------------------------------+
                                                 |
                                                 v
                  +-------------------------------------------------------------+
                  |            Real-Time Telemetry & Billing Monitor            |
                  |     - Ops Anomaly Radar (Carrier Delay Clusters >= 2h)      |
                  |     - Firestore Quota & Runaway Cost Circuit Breaker        |
                  |     - OpenTelemetry Distributed Trace Spans                 |
                  +-------------------------------------------------------------+
```

---

## 2. 3-Tier Document Precedence Engine

Logistics organizations frequently suffer from conflicting policy documentation, outdated SOPs, and bespoke enterprise customer clauses. ParcelPilot strictly enforces a deterministic hierarchy:

### Tier 1: Customer Enterprise Agreements (Binding Overrides)
* **Precedence Rank**: **Highest (Rank 1)**
* **Documents**: `05_Northstar_Logistics_Enterprise_Agreement.pdf`, `06_LumenWorks_Service_Agreement.pdf`
* **Rule**: Directly supersedes all standard SOPs, fee matrices, and SLA credit limits for negotiated clauses:
  * **Northstar Logistics**: Clause 4.1 waives cancellation fees to **$0.00** if notice is $\ge 2.0\text{h}$; Clause 4.2 grants **100% service credit** for carrier-fault delays $\ge 2.0\text{h}$.
  * **LumenWorks**: Clause 3.4 grants **50% service credit** for carrier-fault delays $\ge 3.0\text{h}$.

### Tier 2: Active Operating SOPs
* **Precedence Rank**: **Standard (Rank 2)**
* **Documents**: `01_Support_Policy_v3_CURRENT.pdf`, `03_Cancellation_and_Service_Credit_SOP_v4.pdf`, `04_Product_Operations_Guide_and_Known_Issues.pdf`
* **Rule**: Applies to standard tier accounts (Beacon Retail, Axis Labs) and non-overridden terms for Enterprise accounts:
  * **Cancellation Fee**: Standard **$50.00 / ₹4,200** fee applies if cancellation notice is $<24\text{h}$ and order is not yet picked up.
  * **Delay Credit**: **25% credit** applies only if carrier-fault delay is $\ge 4.0\text{h}$.

### Tier 3: Deprecated Documents & Historical Precedents (Strictly Banned)
* **Precedence Rank**: **Prohibited / Banned (Rank 3)**
* **Documents**: `02_Support_Policy_v2_DEPRECATED.pdf`, legacy ticket resolution notes.
* **Rule**: Hard-coded prohibition. The engine actively filters out and rejects legacy guidelines (such as unverified 10% goodwill credits or obsolete flat fee structures).

---

## 3. Data-Layer Multi-Tenant RBAC Scoping

To guarantee data protection across competing B2B enterprises, access control is enforced at the data retrieval layer:

```typescript
function lookup_order_data(orderId: string, sessionAccountId: string, role: 'customer' | 'internal_ops') {
  const order = fetchOrderFromLedger(orderId);
  if (!order) return { error: `Order ${orderId} not found.` };

  // Tenant Isolation Enforcement
  if (role === 'customer' && order.account_id !== sessionAccountId) {
    return {
      error: `RBAC_VIOLATION: Access Denied. Order ${orderId} belongs to tenant ${order.account_id}. Session is locked to ${sessionAccountId}.`,
      isRBACError: true
    };
  }

  return order;
}
```

* **Customer Portal Role (`customer`)**: Strictly locked to the active session `account_id`. Cross-tenant record lookups return a security alert and abort execution.
* **Internal Operations Role (`internal_ops`)**: Authorized for global fleet lookups, systemic carrier anomaly triage, and cross-account escalations.

---

## 4. Enhanced Multi-Action Two-Phase Commit (2PC) Architecture

To prevent autonomous AI hallucinations from committing unauthorized financial transactions or invalid fleet dispatches, ParcelPilot implements an enhanced 2-phase staging lifecycle supporting both individual and batch operations:

1. **Phase 1: Deterministic Staging (`stage_state_action`)**:
   - The engine evaluates policy entitlements and emits structured staged payloads into the **Amber Approval Gate**.
   - Multiple actions can be staged simultaneously from the chat or with one-click **"Stage All"** controls in the Ops Anomaly Radar.
   - The Amber Gate displays:
     - Batch summary bar (total pending actions, cumulative credits, and assessed fees).
     - Action switcher tabs (`#1 ORD-1001`, `#2 ORD-2002`, etc.) with individual citation proofs.
     - Single-action dismissal and full-batch discard options.
2. **Phase 2: Human Operator Confirmation**:
   - **Confirm & Execute (Single Action)**: Commits a single action to Firestore.
   - **Confirm All (Batch Transaction)**: Atomically executes all queued actions in sequence, commits `ledger_entries` to Cloud Firestore with unique transaction hashes (`TXN-...`), updates operational fleet statuses, and logs a comprehensive batch audit trail.

---

## 5. Cloud Firestore Telemetry & Runaway Billing Prevention

To ensure enterprise stability and budget predictability, ParcelPilot incorporates an active **Firestore Billing & Runaway Prevention Monitor**:
- **Operation Counting**: Tracks live document reads, writes, and deletes against daily quotas.
- **Cost Estimation**: Dual-currency real-time spend estimation ($ USD and ₹ INR) based on Google Cloud Firestore pricing.
- **Runaway Circuit Breaker**: Throttles queries and alerts operators if consumption crosses pre-configured safety thresholds (Safe $\to$ Warning $\to$ Critical Breaker).

---

## 6. OpenTelemetry Distributed Observability

All tool executions, policy evaluations, and Human-in-the-Loop confirmations are wrapped in OpenTelemetry spans (`tracer.startActiveSpan`):
* `lookup_order_data`: Logs target order, tenant ID, and RBAC status.
* `audit_policy_entitlements`: Logs applied precedence tier, governing document, and computed credit/fee values.
* `amber_approval_gate.confirm_all_batch`: Logs batch size, batch transaction ID, and operator email for full distributed tracing across microservices.
