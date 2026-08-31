# AegisOps OpenTelemetry Observability & Distributed Tracing Guide
**Autonomous B2B Logistics Support & Operations Engine — Span Hierarchy, Semantic Conventions & Cloud Trace Troubleshooting**

---

## 1. Executive Observability Strategy

**AegisOps** utilizes **OpenTelemetry (OTel)** to instrument the entire Human-in-the-Loop (HITL) execution lifecycle. Because logistics operations involve high-stakes financial credits, carrier fault determinations, and tenant isolation constraints, distributed tracing provides complete visibility from initial operator interaction to permanent database commitment.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               ROOT SPAN: `amber_approval_gate.confirm_and_execute` / `confirm_all`     │
│               - Triggered when operator clicks "Confirm & Execute" or "Confirm All"    │
│               - Tracks total operator transaction latency, batch size, state changes   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               CHILD SPANS: `firestore.sync_action_to_ledger` (Sequential / Batch)      │
│               - Executes `addDoc` to Cloud Firestore `ledger_entries` collection       │
│               - Captures dual-currency amounts, citations, and transaction hashes       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Trace Span Hierarchy & Semantic Conventions

### 2.1 Trace Hierarchy Map
1. **Root Span: `amber_approval_gate.confirm_and_execute` / `confirm_all`**
   - **Kind**: `SpanKind.INTERNAL`
   - **Component**: `src/App.tsx` (`handleConfirmSingleStagedAction` / `handleConfirmAllStagedActions`)
   - **Span Attributes**:
     - `service.name`: `aegisops-autonomous-engine`
     - `telemetry.sdk.language`: `typescript`
     - `aegisops.action_type`: `CREDIT` | `CANCEL_SHIPMENT` | `ESCALATE_TICKET` | `FEE_WAIVER` | `BATCH_COMMIT`
     - `aegisops.batch_size`: `number` (1 for single item, $N \ge 2$ for batch confirmation)
     - `aegisops.target_id`: e.g. `ORD-1001`, `TCK-501`, or `BATCH-[N]-ITEMS`
     - `aegisops.account_id`: e.g. `ACCT-001`, `ACCT-002`
     - `aegisops.tx_hash`: e.g. `TXN-ORD1001-4821`
     - `aegisops.role`: `internal_ops` | `customer`
     - `aegisops.operator_email`: `operator@parcelpilot.internal`
   - **Events**:
     - `hitl.operator_attestation_started`: Captured immediately upon button click.
     - `hitl.firestore_persistence_success`: Emitted after each item commits successfully.
     - `hitl.order_state_cancelled` / `hitl.ticket_state_escalated`: Emitted when in-memory models update.
     - `hitl.batch_execution_completed`: Emitted when all staged queue items are committed.
     - `hitl.ui_confirmation_rendered`: Emitted when confirmation message and confetti fire.

2. **Child Span: `firestore.sync_action_to_ledger`**
   - **Kind**: `SpanKind.CLIENT`
   - **Component**: `src/services/firebaseLedger.ts` (`syncActionToFirestore`)
   - **Span Attributes**:
     - `db.system`: `firestore`
     - `db.collection.name`: `ledger_entries`
     - `db.operation`: `addDoc`
     - `db.document_id`: Generated Firestore document ID
     - `aegisops.tier_level`: `Tier 1: Enterprise Agreement` | `Tier 2: Current SOP`
     - `aegisops.document_name`: e.g. `05_Northstar_Logistics_Enterprise_Agreement.pdf`
     - `enduser.id`: Firebase Auth UID
     - `enduser.email`: Authenticated operator email

3. **Child Span: `firestore.void_transaction`**
   - **Kind**: `SpanKind.CLIENT`
   - **Component**: `src/services/firebaseLedger.ts` (`voidTransactionInFirestore`)
   - **Span Attributes**:
     - `db.system`: `firestore`
     - `db.collection.name`: `ledger_entries`
     - `db.operation`: `updateDoc`
     - `aegisops.void_target_id`: Target document ID
     - `aegisops.void_reason`: Operator rollback justification
