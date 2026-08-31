# AegisOps Firestore Database Maintenance & Disaster Recovery Guide
**Autonomous B2B Logistics Support & Operations Engine — Backup Schedule, PITR, and RTO Compliance Verification**

---

## 1. Executive Summary & Recovery Objectives

The `ledger_entries` collection in Cloud Firestore serves as AegisOps's authoritative, immutable ledger for all financial service credits, cancellation fee assessments, ticket escalations, and batch voiding actions. Database loss or corruption directly compromises billing reconciliation and audit compliance.

### Service Level Objectives (SLOs)
* **Recovery Time Objective (RTO)**: $\le \mathbf{30\text{ minutes}}$ from disaster declaration to full operational restoration.
* **Recovery Point Objective (RPO)**: $\le \mathbf{15\text{ minutes}}$ of data exposure using Continuous Point-in-Time Recovery (PITR) + hourly managed exports.
* **Data Retention Policy**: 7 years of immutable exports for SOC 2 and logistics billing compliance.

---

## 2. Automated Backup Strategy

AegisOps utilizes a multi-layered backup strategy combining Firestore Point-in-Time Recovery (PITR) with automated Google Cloud Storage (GCS) export jobs:

```
┌────────────────────────────────────────────────────────────────────────┐
│             LAYER 1: POINT-IN-TIME RECOVERY (PITR) [CONTINUOUS]        │
│  - Continuous transaction logging with 7-day retention window          │
│  - Enables sub-minute restoration to any second in the past 7 days     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             LAYER 2: AUTOMATED HOURLY GCS EXPORTS [HOURLY CRON]        │
│  - Cloud Scheduler triggers Cloud Function at minute 00 of each hour   │
│  - Executes `gcloud firestore export --collection-ids='ledger_entries'`│
│  - Exports stored in geo-redundant bucket with Object Lock             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             LAYER 3: DAILY LONG-TERM COLD ARCHIVE [DAILY CRON]         │
│  - GCS Lifecycle rules transition hourly backups to Archive tier       │
│  - Multi-region replication (US-MULTI / ASIA-MULTI)                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Secondary Void Indexing
The Firestore `ledger_entries` schema supports:
- `id`: Document UID
- `action_type`: `CREDIT` | `CANCEL_SHIPMENT` | `ESCALATE_TICKET` | `FEE_WAIVER`
- `status`: `COMMITTED` | `VOIDED`
- `batchId`: Identifies transactions committed together in a single batch
- `voidedAt`, `voidReason`, `voidedBy`: Audit metadata populated when a batch is reverted
- Composite Index: `createdAt (DESC)`, `status (ASC)`, `account_id (ASC)`
