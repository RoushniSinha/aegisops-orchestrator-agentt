# ParcelPilot Product Notes
**Autonomous B2B Logistics Support & Operations Engine — Product Specification, Policy Precedence Hierarchy, Ops Anomaly Radar & Immutable Ledger Operations**

---

## 1. Executive Product Overview & Problem Framing

ParcelPilot transforms enterprise logistics support from reactive, error-prone complaint management into proactive, real-time anomaly detection and deterministic resolution. In multi-tenant B2B supply chains, support teams are frequently overwhelmed by high-volume escalations triggered by carrier network disruptions, conflicting contract addenda, and stale historical precedents.

### 1.1 The Operational Pain Points
1. **Carrier Delay Clusters & Sorting Failures**: Upstream carrier breakdowns (such as the Apex Express Midwest Sorting Hub failure or RoadRunner transit delays) cause clustered shipment delays ($\ge 2.0\text{h}$) across multiple enterprise accounts simultaneously.
2. **Policy Precedence Drift & Hallucination**: Support agents and legacy bots frequently cite deprecated policies (e.g. citing `Support Policy v2` or obsolete ticket notes like `TKT-450`'s fabricated ₹250 fee) instead of binding Enterprise Agreements.
3. **Unchecked Financial Ledger Mutations**: Autonomous systems risk executing unreviewed credits, incorrect fee waivers, or erroneous shipment cancellations without human auditability.

---

## 2. The 3-Tier Policy Precedence Hierarchy

ParcelPilot enforces a strict, deterministic 3-tier precedence engine at the retrieval and ingestion layer, ensuring binding legal terms always supersede general guidelines and completely quarantining deprecated documents:

```
┌────────────────────────────────────────────────────────────────────────┐
│      TIER 1: CUSTOMER ENTERPRISE AGREEMENTS (HIGHEST PRECEDENCE)       │
│  - 05_Northstar_Logistics_Enterprise_Agreement.pdf                     │
│  - 06_LumenWorks_Service_Agreement.pdf                                 │
│  * Strictly overrides standard SOPs and fee matrices.                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Falls through if silent
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             TIER 2: CURRENT SOPS & GUIDES (ACTIVE BASELINE)            │
│  - 01_Support_Policy_v3_CURRENT.pdf                                    │
│  - 03_Cancellation_and_Service_Credit_SOP_v4.pdf                       │
│  - 04_Product_Operations_Guide_and_Known_Issues.pdf                    │
│  * Applies to standard accounts (Beacon/Axis) and non-overridden terms.│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Hard Boundary
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│        TIER 3: DEPRECATED GUIDANCE & PAST NOTES (STRICTLY BANNED)      │
│  - 02_Support_Policy_v2_DEPRECATED.pdf                                 │
│  - Legacy Support Ticket Notes (e.g., TKT-450, TKT-451)                │
│  * PHYSICALLY QUARANTINED — Never indexed, never cited.                │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Customer Master Accounts & Binding Contract Terms

| Account ID | Customer Name | Plan Tier | Custom Contract Document | Strategic Contract Terms & SLA Rules | Assigned CSM |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ACCT-001** | **Northstar Logistics** | Enterprise | `05_Northstar_Logistics_Enterprise_Agreement.pdf` | **Clause 4.1**: Cancellation fee is waived to **$0.00 / ₹0** if notice $\ge 2.0\text{h}$.<br>**Clause 4.2**: **100% service credit** for carrier fault delay $\ge 2.0\text{h}$. | Priya Mehta |
| **ACCT-002** | **LumenWorks** | Growth | `06_LumenWorks_Service_Agreement.pdf` | **Clause 3.4**: **50% service credit** for carrier fault delay $\ge 3.0\text{h}$.<br>Standard cancellation fee rules apply. | Arjun Rao |
| **ACCT-003** | **Beacon Retail** | Standard | *None (Standard Policy Baseline)* | **Standard SOP v3**: Standard $50 / ₹4,200 cancellation fee within 24h.<br>**25% credit** only if carrier fault delay $\ge 4.0\text{h}$. | Neha Kapoor |
| **ACCT-004** | **Axis Labs** | Enterprise | *None (Standard Enterprise SOP)* | **Standard Enterprise**: Dedicated support channel; standard delay thresholds ($\ge 4.0\text{h}$) apply. | Priya Mehta |

---

## 3. Ops Anomaly Radar: Real-Time Telemetry & Cross-Tenant Sync

The **Ops Anomaly Radar** (`radar_anomaly_scan`) shifts logistics operations from reactive ticket triage to proactive, real-time fleet anomaly detection.

```
[Carrier Telemetry Feeds] ──▶ [Ops Anomaly Radar Scan]
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
 [Carrier Delay Clusters]                               [SLA Risk Queue]
 - Groups delays >= 2.0h by carrier                     - Isolates HIGH / CRITICAL tickets
 - Evaluates verified carrier fault                     - Cross-references known bugs (BUG-1092)
 - Quantifies Freight Value at Risk                     - One-click CSM / Hub Escalation
```

### 3.1 Key Real-Time Capabilities in `App.tsx`
- **Systemic Delay Clustering**: Continuously filters and groups orders where $\text{carrier\_fault} = \text{true}$, $\text{status} = \text{'Delayed'}$, and $\text{delayHours} \ge 2.0\text{h}$ (e.g. Apex Express Midwest Sorting Outage, RoadRunner `ORD-2002`).
- **Freight Value at Risk Aggregation**: Real-time aggregation of monetary exposure across affected shipments, formatted seamlessly in dual currencies ($ USD and ₹ INR).
- **Proactive Ticket Correlation**: Matches open breach tickets (`TCK-801`, `TCK-802`, `TKT-504`) with known platform issues (such as `BUG-1092` SwiftShip driver pickup webhook ingestion lag) to prevent mistaking platform delays for carrier lost-package events.
- **Tenant-Scoped Views**: When accessed under the `customer` role, the radar automatically redacts other tenants' orders, presenting only the customer's own affected shipments.
- **One-Click Batch Staging**: Quick-action buttons in the Radar queue immediately stage remediation actions into the `AmberApprovalGate` multi-action batch queue.

---

## 4. Immutable Cloud Firestore Ledger & 2-Phase Multi-Action HITL Flow

To ensure complete financial auditability and eliminate autonomous hallucination risks, all state changes follow the **Two-Phase Human-in-the-Loop (HITL) Commit Flow** with full batch-processing support:

```
[Agent Policy Audit / Radar "Stage All"] ──▶ [Phase 1: Amber Approval Gate (Multi-Action Queue)]
                                                                  │
                                           ┌──────────────────────┴──────────────────────┐
                                           ▼                                             ▼
                        [Individual "Confirm & Execute"]                      [Batch "Confirm All (N)"]
                                           │                                             │
                                           └──────────────────────┬──────────────────────┘
                                                                  │
                                                                  ▼
                                                    [Firestore syncActionToFirestore]
                                                    - addDoc to `ledger_entries` (sequential batch)
                                                    - Records txHash, Operator ID, Dual Currency
                                                                  │
                                                                  ▼
                                                    [Live onSnapshot Sync]
                                                    - Real-time reconciliation across browser tabs
                                                    - Orders marked CANCELLED / Tickets ESCALATED
                                                    - Committed Ledger Modal & Runaway Monitor Live
```

### 4.1 The 2-Phase Staging Lifecycle
1. **Phase 1: Deterministic Multi-Action Staging (`stage_state_action`)**:
   - Computes exact amounts, percentages, and cancellation fees deterministically.
   - Populates an in-memory queue (`stagedActions: StagedStateAction[]`) supporting multiple actions staged simultaneously.
   - Surfaces the visual **Amber Approval Gate** displaying:
     - Top Batch Metrics Summary (total pending actions, cumulative credits, assessed fees).
     - Action Switcher Tabs (`#1 ORD-1001`, `#2 ORD-2002`, etc.) with individual clause citations and arithmetic breakdowns.
     - "Stage All" quick-action triggers from the Ops Anomaly Radar for carrier delay clusters and SLA breach queues.
   - Zero database mutations occur in Phase 1.
2. **Phase 2: Human Attestation & Immutable Commit**:
   - Operator reviews individual items or executes all items at once via *"Confirm All (N)"*.
   - `syncActionToFirestore` executes atomic `addDoc` calls to the Firestore `ledger_entries` collection.
   - Transaction hash (`txHash`), timestamp, operator attribution (`operatorUid`, `operatorEmail`), and full legal provenance are permanently logged.
   - Live `onSnapshot` listener (`subscribeToLiveLedgerEntries`) automatically updates all connected clients and reconciles local state.
   - The **Committed Ledger Modal** provides deep audit inspection, multi-field search, facet filters, and raw citation viewing.
   - The **Firestore Billing & Runaway Prevention Monitor** actively tracks read/write operations and provides dual-currency cost estimations ($ / ₹).

---

## 5. Core Evaluation Benchmark: First-Contact Entitlement Accuracy (FCEA)

$$\text{FCEA} = \left( \frac{N_{\text{compliant}}}{N_{\text{total}}} \right) \times 100\%$$

Where an inquiry is compliant **only** if:
1. The correct precedence tier was applied ($\text{Tier 1} \succ \text{Tier 2}$).
2. Banned Tier 3 documents and untrusted ticket notes were completely excluded.
3. The exact policy document and clause were cited.
4. The calculated credit or fee matched the deterministic formula exactly.
5. The action was validated via the 2-phase staging lifecycle.

### Operational Targets
- **FCEA Target**: **$100.0\%$** (Industry Standard: 72%–81%).
- **Numeric Output Hallucination Rate**: **$0.00\%$** (100% deterministic TypeScript arithmetic).
- **RBAC Tenant Isolation Breach Rate**: **$0.00\%$** (enforced at the data-access layer).

---

## 6. Strategic Product Roadmap

1. **Multimodal Proof-of-Delivery (POD) Vision Audit**: Gemini 2.5 Flash vision OCR to verify driver bill of lading (BOL) signatures and instantly resolve webhook lag (`BUG-1092`).
2. **Autonomous Carrier Chargeback Reconciliation (EDI 210)**: Automated generation of carrier deduction invoices for all carrier-fault delays identified on the Radar.
3. **Predictive Route Congestion & Weather Risk Engine**: Pre-breach risk scoring to reassign carriers prior to pickup window closure.
4. **Multi-Agent Sub-Specialization Swarm**: Modular LangGraph/DAG orchestration across specialized Triage, Legal RAG, and Ledger Transaction agents.
