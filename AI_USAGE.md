# ParcelPilot AI Usage & Tool Architecture

## 1. Model Configuration & Hybrid Reasoning Profile

ParcelPilot leverages the **Gemini 3.7** architecture configured with hybrid analytical reasoning to execute deterministic tool calling, structured arithmetic verification, and natural language communication across enterprise B2B logistics workflows.

### Model Parameters & Guardrails
* **Model Family**: `gemini-3.7-flash`
* **Thinking / Reasoning Profile**: Hybrid Chain-of-Thought with structured tool planning before emitting customer-facing text.
* **System Prompt Instructions**:
  * Mandatory tool-first execution (`lookup_order_data` $\rightarrow$ `audit_policy_entitlements` $\rightarrow$ `stage_state_action`).
  * Strict prohibition on committing ledger mutations without explicit human confirmation in the Amber Approval Gate.
  * Explicit enforcement of the 3-Tier Policy Hierarchy (Tier 1 Enterprise Agreements $\succ$ Tier 2 Active SOPs $\succ$ Banned Tier 3 Legacy Notes).
  * Mandatory mathematical proofs, exact clause citations, and dual-currency ($ USD / ₹ INR) breakdowns in all financial outputs.

---

## 2. Autonomous Tool Declarations

ParcelPilot operates via three core deterministic function declarations:

### 1. `lookup_order_data`
Retrieves live shipment telemetry from the operational ledger with built-in data-layer RBAC verification.
* **Input Schema**:
  ```json
  {
    "order_id": "string",
    "session_account_id": "string",
    "role": "customer | internal_ops"
  }
  ```
* **Returns**: Carrier status, timestamps, route coordinates, delay calculations relative to reference snapshot (`2026-08-16 11:00 IST`), carrier fault flags, and freight costs.
* **Security Guard**: Intercepts cross-tenant access attempts for `customer` roles and throws an explicit `RBAC_VIOLATION`.

---

### 2. `audit_policy_entitlements`
Evaluates business logic, service level agreements, and cancellation terms against the deterministic 3-tier precedence engine.
* **Input Schema**:
  ```json
  {
    "account_id": "string",
    "order_data": "object",
    "query_type": "credit | cancellation | delay_audit"
  }
  ```
* **Returns**: Eligibility boolean, exact percentage/amount in USD and INR, governing precedence tier, document & clause citation, and hierarchical evaluation audit logs.

---

### 3. `stage_state_action`
Stages a single or batch state mutation payload into the Human-in-the-Loop Amber Approval Gate.
* **Input Schema**:
  ```json
  {
    "action_type": "ISSUE_SERVICE_CREDIT | CANCEL_SHIPMENT | ESCALATE_TICKET",
    "target_id": "string",
    "account_id": "string",
    "amountUSD": "number (optional)",
    "amountINR": "number (optional)",
    "cancellation_fee_USD": "number (optional)",
    "cancellation_fee_INR": "number (optional)",
    "citation": "string",
    "reason": "string"
  }
  ```
* **Returns**: `STAGED_AWAITING_CONFIRMATION` status token with full metadata for visual operator verification. Supports simultaneous multi-action queueing and atomic batch execution.

---

## 3. Reference Timestamp Anchoring

To eliminate temporal drift and non-deterministic relative time queries (such as *"was this delayed yesterday?"*), ParcelPilot anchors all operational calculations to a synchronized system reference snapshot:

* **Primary System Anchor**: `2026-08-16 11:00:00 Asia/Kolkata` (`2026-03-01T00:00:00Z` base ledger anchor)
* **Delay Calculation Formula**:
  $$\text{Delay Hours} = \max\left(0, \frac{T_{\text{snapshot}} - T_{\text{pickup\_end}}}{3600 \times 1000}\right)$$
* **Cancellation Notice Calculation Formula**:
  $$\text{Notice Hours} = \frac{T_{\text{pickup\_start}} - T_{\text{cancellation\_req}}}{3600 \times 1000}$$

All temporal comparisons, SLA breach countdowns, and lead-time waiver evaluations are deterministically evaluated against this frozen reference snapshot.

---

## 4. Multi-Action Two-Phase Commit (2PC) & Audit Pipeline

1. **Staging Phase (`stage_state_action`)**: Emits structured payloads into the **Amber Approval Gate**, displaying batch metric summaries, individual action switcher tabs, and exact policy citations.
2. **Commit Phase (`handleConfirmAllStagedActions` / `handleConfirmSingleStagedAction`)**: Commits actions sequentially to Cloud Firestore `ledger_entries`, assigns unique transaction hashes (`TXN-...`), stamps the operator email, and updates fleet statuses.
3. **Audit & Inspection**: The **Committed Ledger Modal** provides deep audit inspection, allowing operators to view raw citations, copy transaction signatures, and verify full chain-of-custody compliance.
