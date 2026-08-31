# ParcelPilot Product Note
**Autonomous B2B Logistics Support & Operations Engine — Product Specification, Strategic Framing & Operations Guide**

---

## 1. Executive Summary & Problem 1 (Carrier Telemetry & Delay Clusters)

ParcelPilot transforms enterprise logistics support from reactive complaint management into proactive, real-time anomaly detection and deterministic resolution. In multi-tenant B2B supply chains, support teams are frequently overwhelmed by high-volume escalations triggered by carrier network disruptions, conflicting contract addenda, and stale historical precedents.

### Problem 1: Carrier Hub Sorting Failures & Delay Clusters
* **Root Cause & Operational Pain**: Regional carrier network disruptions (such as the Apex Express Midwest Sorting Hub failure or RoadRunner transit breakdowns) lead to concentrated clusters of delayed shipments ($\ge 2.0\text{h}$) with verified carrier fault. In traditional support setups, each delayed shipment generates an isolated customer ticket, requiring repetitive manual investigation and creating SLA credit calculation errors.
* **Ops Anomaly Radar Solution**:
  * Scans active fleet telemetry anchored to deterministic reference snapshots (`2026-08-16 11:00 IST` / `2026-03-01T00:00:00Z`).
  * Isolates high-risk shipments ($\text{Delay} \ge 2.0\text{h}$, $\text{carrier\_fault} = \text{true}$).
  * Quantifies aggregate **Freight Value at Risk** in real time across dual currencies ($ / ₹).
  * Automatically clusters and surfaces open SLA breach tickets for one-click carrier hub escalation.
  * Features **"Stage All"** quick-action controls to push all delayed shipments or breach tickets into the Amber Approval Gate for bulk processing.

---

## 2. Operational Visibility Feeds & User Interfaces

ParcelPilot provides deep operational transparency through six interconnected, real-time interface modules:

| Interface Module | Functional Scope | Key Operator & Customer Benefit |
| :--- | :--- | :--- |
| **Ops Anomaly Radar** | Live carrier telemetry, carrier clustering, SLA breach queues, and "Stage All" bulk controls. | Immediate systemic triage before customers escalate; proactive hub re-routing. |
| **Fleet Order Ledger** | Real-time shipment status, origin/destination routes, timestamps, and fees. | Searchable operational database for fast auditing and SLA verification. |
| **Governing Policy Inspector** | 3-Tier document viewer detailing active clauses and banned legacy files. | Auditable compliance, exact clause references, and zero ambiguity for operators. |
| **Amber Approval Gate** | Multi-action Human-in-the-Loop staging card with batch metrics, switcher tabs, and "Confirm All". | Eliminates rogue automated writes; enables safe bulk transaction processing. |
| **Committed Ledger Modal** | Immutable ledger feed with multi-field search, facet filters, and expanded audit inspection. | Full chain-of-custody verification with raw citations, operator emails, and TX hashes. |
| **Billing & Runaway Monitor** | Real-time Firestore operation counting, cost estimation ($/₹), and runaway breaker. | Complete budget predictability and prevention of runaway cloud spend. |

---

## 3. Account Profiles & Master Contract Rules

ParcelPilot manages four distinct customer accounts, each governed by specific contract tiers and operational terms:

| Account ID | Customer Name | Tier / Plan | Custom Agreement PDF | Strategic SLA & Cancellation Terms | CSM Lead |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ACCT-001** | **Northstar Logistics** | Enterprise (Strategic) | `05_Northstar_Logistics_Enterprise_Agreement.pdf` | **Clause 4.1**: $0.00 cancellation fee if notice $\ge 2.0\text{h}$.<br>**Clause 4.2**: 100% service credit for carrier fault delay $\ge 2.0\text{h}$. | Priya Mehta |
| **ACCT-002** | **LumenWorks** | Growth | `06_LumenWorks_Service_Agreement.pdf` | **Clause 3.4**: 50% service credit for carrier fault delay $\ge 3.0\text{h}$.<br>Standard cancellation fee rules apply. | Arjun Rao |
| **ACCT-003** | **Beacon Retail** | Standard | *None (Standard Policy Baseline)* | **Standard SOP v3**: $50 / ₹4,200 fee if notice <24h.<br>25% credit only if delay $\ge 4.0\text{h}$. | Neha Kapoor |
| **ACCT-004** | **Axis Labs** | Enterprise | *None (Standard Enterprise SOP)* | **Standard Enterprise**: Dedicated support; standard delay thresholds ($\ge 4.0\text{h}$) apply. | Priya Mehta |

---

## 4. Known Issues & Operational Runbooks (Doc 04 Integration)

The engine actively cross-references inbound symptoms against the platform's known operational guide (`04_Product_Operations_Guide_and_Known_Issues.pdf`):

### 4.1 BUG-1044: Large CSV Bulk Upload Heap Memory Ceiling (TKT-502)
* **Symptom**: Bulk upload of $>3,000$ row CSV files terminates at ~70% completion with HTTP 500.
* **Root Cause**: In-memory CSV parsing exceeds container memory buffer; individual shipment creation remains fully operational.
* **Resolution**: Split CSV into $<2,500$-row chunks or utilize background Google Cloud Tasks worker. Untrusted historical ticket advice stating "Growth plan capped at 3,000 rows" is rejected.

### 4.2 BUG-1092: SwiftShip Driver Pickup Webhook Ingestion Lag (TKT-504)
* **Symptom**: Physical driver collects package, but database order status remains `BOOKED` for 10–15 minutes.
* **Root Cause**: Intermediate carrier webhook polling queue introduces a 15-minute telemetry delay.
* **Resolution**: `OrderState.validateTelemetryGuard` cross-references physical driver hardware scans (`DRIVER_PICKED_UP`) with database records, preventing erroneous cancellation attempts during the ingestion window.

### 4.3 TKT-505: Production API Key Exposure Incident Response
* **Symptom**: Operator inadvertently shares screenshot with production API key.
* **Runbook**: Immediate key revocation in Google Secret Manager $\to$ Rolling deployment of Cloud Run instance with rotated secret $\to$ Cloud Audit Log analysis for unauthorized queries.

---

## 5. First-Contact Entitlement Accuracy (FCEA)

### Definition
**First-Contact Entitlement Accuracy (FCEA)** is the primary operational benchmark measuring the percentage of customer compensation claims, cancellation fees, and SLA disputes resolved strictly according to the binding 3-tier policy hierarchy on the initial interaction, with zero manual retroactive reconciliations or policy reversals.

### Mathematical Formulation

$$\text{FCEA} = \left( \frac{N_{\text{compliant}}}{N_{\text{total}}} \right) \times 100\%$$

Where:
* $N_{\text{compliant}}$ is the count of audited inquiries where:
  1. The correct precedence tier was applied ($\text{Tier 1} \succ \text{Tier 2}$).
  2. Banned Tier 3 documents and informal ticket precedents were completely excluded.
  3. The exact policy document and clause were cited.
  4. The calculated credit or cancellation fee matched the deterministic formula exactly.
  5. The action was validated via the 2-phase staging lifecycle.
* $N_{\text{total}}$ is the total number of processed customer service and SLA audit requests.

### Core Evaluation Metrics & Target Benchmarks
* **Industry Standard (Human Ops)**: $72\% - 81\%$ (plagued by misapplied outdated policies and manual calculation errors).
* **ParcelPilot Target Benchmark**: **$100\%$ Deterministic FCEA** via the integrated 3-Tier Precedence Engine.
* **Numeric Output Hallucination Rate**: **$0.00\%$** (all arithmetic executed deterministically in TypeScript).
* **RBAC Isolation Breach Rate**: **$0.00\%$** (enforced at the data-access layer).
