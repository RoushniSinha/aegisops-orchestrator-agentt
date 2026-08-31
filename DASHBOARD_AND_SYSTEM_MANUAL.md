# ParcelPilot Autonomous Support & Operations Engine
## Comprehensive System & Dashboard Specification Manual

---

## 1. Architectural Foundations & Temporal Clock

### 1.1 Temporal Clock
```
Reference Clock: 2026-03-01T00:00:00Z
Operational Snapshot Date: 2026-08-16 11:00 (Asia/Kolkata)
```
- **Deterministic Evaluation**: All Service Level Agreement (SLA) timers, carrier pickup delays, cancellation notice windows, and late penalty waivers are computed relative to this fixed reference time.
- **Independence from Host Clock**: The engine never reads browser system time for billing or compliance decisions.

### 1.2 The 3-Tier Precedence Hierarchy
When processing any order, dispute, or cancellation, the rule evaluation pipeline resolves rules in strict hierarchical sequence:

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: Customer Enterprise Agreements (Highest Precedence)│
│  - 05_Northstar_Logistics_Enterprise_Agreement.pdf          │
│  - 06_LumenWorks_Service_Agreement.pdf                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Overrides baseline)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: Current Active SOPs & Policies (Active Baseline)   │
│  - 01_Support_Policy_v3_CURRENT.pdf                         │
│  - 03_Cancellation_and_Service_Credit_SOP_v4.pdf            │
│  - 04_Product_Operations_Guide_and_Known_Issues.pdf         │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Replaces deprecated rules)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 3: Deprecated Guidance & Historical Notes (BANNED)     │
│  - 02_Support_Policy_v2_DEPRECATED.pdf (Untrusted)          │
│  - Historical agent chat/ticket comments (Untrusted)        │
└─────────────────────────────────────────────────────────────┘
```

| Precedence Tier | Scope & Files | Enforcement Rule |
| :--- | :--- | :--- |
| **Tier 1 (Highest)** | Custom signed enterprise contracts (`Northstar Logistics`, `LumenWorks`) | Custom negotiated clauses strictly override all standard company-wide fees, delay thresholds, and refund schedules. |
| **Tier 2 (Baseline)** | Current SOPs (`Support Policy v3`, `Cancellation SOP v4`, `Operations Guide v4`) | Applied to standard accounts (`Beacon Retail`, `Axis Labs`) and enterprise accounts for non-overridden clauses. |
| **Tier 3 (Quarantine)**| Deprecated policies (`Support Policy v2`) and legacy ticket notes | Strictly quarantined. May not be cited or used as binding precedent for any financial adjustment. |

---

## 2. Authentication & Authorization (RBAC) System

### 2.1 Multi-Tenant Gateway (`AuthModal`)
The entrance gateway provides tenant switching and role-based isolation:

- **Sign In Tab**:
  - `Email Address` & `Password`: Authenticates user credentials via Firebase Auth and initializes session profile from Firestore `users` collection.
  - `Forgot Password`: Triggers self-service credential reset instructions.
- **Register Tab**:
  - `Select User Role`:
    - **Customer Portal**: Scopes visibility and execution strictly to the selected enterprise account.
    - **Internal Ops Admin**: Grants cross-tenant operational visibility and fleet-wide override powers.
  - `Assigned Enterprise Tenant`: Associates customer accounts with `Northstar Logistics`, `LumenWorks`, `Beacon Retail`, or `Axis Labs`.
  - `Department & Job Title`: Operational metadata captured in Firestore audit documents.
  - `Live Password Strength Meter`: 5-tier complexity calculation (length, uppercase, numbers, symbols).
- **1-Click Testing Profiles Tab**:
  - Instant access presets for testing:
    1. **Northstar Logistics** (*Customer - Tier 1 Enterprise*)
    2. **LumenWorks** (*Customer - Tier 1 Enterprise*)
    3. **Beacon Retail** (*Customer - Tier 2 Standard SOP*)
    4. **Internal Ops Admin** (*Global Administrator*)

### 2.2 User Profile & Security Center (`UserProfileModal`)
Clicking the user avatar in the top-right header opens the profile manager:

1. **Profile Overview**: Displays access tier, session status, account UID, department, and registration timestamp.
2. **Password & Security**: Change active password with live complexity validation, review credential renewal timestamps, and inspect session isolation.
3. **RBAC Matrix Tab**: Interactive matrix listing all 10 system permissions:

| Permission Key | Description | Customer Role | Internal Ops |
| :--- | :--- | :---: | :---: |
| `VIEW_OWN_ORDERS` | View assigned tenant orders & tracking | Yes | Yes |
| `VIEW_ALL_TENANTS` | Query and switch between any customer account | Restricted | Authorized |
| `STAGE_SERVICE_CREDIT` | Calculate delays and stage credit proposals | Authorized | Authorized |
| `STAGE_CANCELLATION_WAIVER`| Request cancellations and evaluate notice waivers | Authorized | Authorized |
| `OVERRIDE_CARRIER_FAULT`| Modify carrier fault attributions | Restricted | Authorized |
| `GLOBAL_OPS_RADAR` | View fleet-wide carrier delay anomalies | Restricted | Authorized |
| `ESCALATE_CRITICAL_TICKETS`| Route high-priority SLA breaches | Authorized | Authorized |
| `MANAGE_RBAC_USERS` | Modify user roles and tenant assignments | Restricted | Authorized |
| `VIEW_TIER1_CONTRACTS` | Inspect legal clauses and contract terms | Authorized | Authorized |
| `EXECUTE_LEDGER_ACTIONS` | Commit financial transactions to Firestore | Authorized | Authorized |

4. **User Directory (Admin Only)**: Allows Internal Ops to search all registered users across tenants and update roles or account assignments in real time.

---

## 3. Top Navigation Header (`Header`)

```
[ PP ParcelPilot ] [Ref: 2026-03-01T00:00:00Z] ── [ Policies ] [ Orders ] ── [ $ USD | ₹ INR ] ── [ Active Role: Customer ▼ ] ── [ Tenant: Northstar ▼ ] ── [ User Profile ]
```

| Object / Control | Visual State & Values | Functional Meaning & Interaction |
| :--- | :--- | :--- |
| **Brand Logo & Badge** | `ParcelPilot` with `RBAC Engine` badge | Identifies the active autonomous support environment. |
| **Reference Timestamp** | `Ref: 2026-03-01T00:00:00Z` | Displays the temporal baseline used for all SLA calculations. |
| **Policies Button** | Opens `PolicyPrecedenceModal` | Interactive document viewer showing Tier 1, Tier 2, and Tier 3 legal clauses. |
| **Orders Button** | Opens `OrderLedgerModal` | Live tabular view of all operational orders across accounts with filter controls. |
| **Currency Switcher** | `$ USD` / `₹ INR` | Real-time currency toggle. Dynamically recalculates fees, credits, and ledger items (1 USD = 84 INR). |
| **Active Role Dropdown** | `Customer Portal` vs `Internal Ops (Admin)` | Switches access mode between tenant-isolated customer view and global admin view. |
| **Tenant Account Switcher** | `Northstar`, `LumenWorks`, `Beacon`, `Axis` | When in Customer role, locked to the assigned account. In Admin role, unlocks cross-tenant switching. |
| **User Profile Badge** | Avatar button with initial and role | Opens the User Profile & Security Center. |
| **Sign Out Button** | Logout icon | Clears the active session and opens the authentication gateway. |

---

## 4. Operational Support & Chatbot Console (`App.tsx`)

The left workspace houses the Autonomous Support AI Engine and the Human-in-the-Loop Approval Gate:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ AMBER APPROVAL GATE ] (Appears when an action is staged)            │
│  Target: ORD-1001 • Account: Northstar Logistics • Action: CREDIT_100% │
│  Legal Citation: Northstar Enterprise Agreement Clause 4.2 (Tier 1)    │
│  [ Confirm & Execute ]                    [ Cancel / Reject ]          │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│  [ CHATBOT CONVERSATION STREAM ]                                       │
│  - System reasoning log & tool execution trace                         │
│  - Contract clause citations & mathematical calculations               │
│  - Ticket triage recommendations & known issue advisories              │
├────────────────────────────────────────────────────────────────────────┤
│  [ PRESET PROMPT CHIPS ]                                               │
│  [ Audit Delay ORD-1001 ] [ Cancel ORD-1002 ] [ Incident TKT-501 ] ... │
├────────────────────────────────────────────────────────────────────────┤
│  [ >_ Type an order query, ticket escalation, or policy question... ]  │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Human-in-the-Loop Amber Approval Gate
When the AI engine calculates a financial modification (service credit, cancellation waiver, or fee refund), it **never executes directly**. Instead, it stages the proposal in the Amber Approval Gate:

- **Action Type**: e.g., `SERVICE_CREDIT_100`, `CANCEL_SHIPMENT_WAIVED`, `FEE_REFUND`.
- **Target ID**: Specific Order (`ORD-1001`) or Ticket (`TKT-501`).
- **Financial Adjustment**: Staged credit/waiver amounts in both selected currency ($ / ₹).
- **Binding Contract Citation**: Direct legal reference with tier tag (e.g., `Northstar Agreement Clause 4.2 [Tier 1]`).
- **Confirmation Buttons**:
  - **Confirm & Execute (Green)**: Triggers confetti, generates a cryptographic transaction hash, executes the state change, and commits the record to Firestore's `ledger_entries` collection.
  - **Cancel (Red)**: Aborts the staged transaction without writing to the database.

### 4.2 Chatbot AI Assistant Engine
The natural language engine accepts queries and executes operational analysis:

- **Delay Auditing (`Audit delay for ORD-1001`)**:
  1. Retrieves shipment timestamps (`BookedAt`, `PickupWindowStart`, `PickupWindowEnd`, `ActualPickupAt`).
  2. Calculates carrier delay duration.
  3. Evaluates account-specific contract rules:
     - *Northstar Logistics*: Delay $\ge 2.0$ hours with carrier fault $\rightarrow$ **100% Service Credit** (Clause 4.2).
     - *LumenWorks*: Delay $\ge 3.0$ hours with carrier fault $\rightarrow$ **50% Service Credit** (Clause 3.4).
     - *Standard Accounts*: Delay $\ge 4.0$ hours $\rightarrow$ **25% Service Credit** (SOP v4).
  4. Stages the calculated credit in the Amber Approval Gate.

- **Cancellation & Notice Waiver (`Cancel shipment ORD-1001`)**:
  1. Compares cancellation request time against `PickupWindowStart`.
  2. *Northstar*: Notice $\ge 2$ hours before window start $\rightarrow$ **$0 Cancellation Fee (Waived)**.
  3. *LumenWorks / Standard*: Standard cancellation fee apply unless within 30-minute booking grace window.

- **Known Bug & Issue Advisory (`TKT-501` / `TKT-502`)**:
  1. Evaluates ticket issues against `04_Product_Operations_Guide_and_Known_Issues.pdf`.
  2. For `TKT-501` (HTTP 500 on shipment creation): Identifies high-severity platform incident, outlines workaround, and prepares engineering escalation.
  3. For `TKT-502` (Bulk CSV 4,200 rows failing at 70%): Detects batch limit boundary (3,000 max row limit per batch) and advises splitting the payload.

---

## 5. Ops Anomaly Radar & Live Firestore Ledger (`OpsAnomalyRadar`)

The right sidebar provides real-time monitoring and database sync:

```
┌─────────────────────────────────────────────────────────────┐
│  [ OPS ANOMALY RADAR ]                                      │
│  SLA Health: 94.2% • Delays >= 2h: 2 Orders • Risk: ELEVATED │
├─────────────────────────────────────────────────────────────┤
│  CARRIER DELAY CLUSTERS                                     │
│  - SwiftShip: 2 delays >= 2.0h (Avg: 3.2h)                  │
│  - RoadRunner: 1 delay >= 2.0h (Avg: 5.5h)                  │
├─────────────────────────────────────────────────────────────┤
│  SYSTEM INCIDENTS & TICKET QUEUE                            │
│  - TKT-501: All shipment creation failing [CRITICAL]        │
│  - TKT-505: Production API key exposure [SECURITY]          │
├─────────────────────────────────────────────────────────────┤
│  LIVE FIRESTORE LEDGER (Real-Time Synchronized)             │
│  - TX: 0x8f3c... ORD-1001 Credit: ₹4,200 ($50.00)           │
│  - TX: 0x4a1b... ORD-2001 Fee Waived: ₹0.00                 │
└─────────────────────────────────────────────────────────────┘
```

| Section / Card | Data Stream | Description & Functional Behavior |
| :--- | :--- | :--- |
| **SLA Health Header** | Percentage & Status Badge | Live system SLA compliance index based on on-time pickups vs delayed shipments. |
| **Carrier Delay Clusters** | Grouped carrier telemetry | Aggregates all orders experiencing delays $\ge 2.0$ hours. Flags systemic carrier bottlenecks. |
| **Active Ticket Queue** | Support tickets table | Displays active tickets with urgency indicators, channel tags, and customer metadata. |
| **Live Firestore Ledger** | Firestore collection `ledger_entries` | Real-time `onSnapshot` feed of all approved operational actions, showing timestamp, transaction hash, currency amounts, and contract citation. |

---

## 6. End-to-End Operational Walkthrough

### Scenario A: SLA Delay Credit on Northstar Account
1. Ensure the top tenant selector is set to **Northstar Logistics**.
2. Type into the chat: **`Audit delay for ORD-1001`** (or click the quick prompt chip).
3. The AI reviews Northstar Agreement **Clause 4.2 (Tier 1)**: Carrier delay exceeds 2.0 hours with carrier fault.
4. The **Amber Approval Gate** appears staging a **100% Service Credit** (₹4,200 / $50.00).
5. Click **"Confirm & Execute"**.
6. The transaction is committed to Firestore and immediately appears in the **Live Firestore Ledger** with a unique cryptographic hash (`0x...`).

### Scenario B: Testing Cross-Tenant Security Isolation
1. With active role set to **Customer Portal** (`Northstar`), type: **`Audit delay for ORD-2001`** (which belongs to LumenWorks).
2. The AI detects a tenant mismatch and **blocks the cross-tenant operation**.
3. Switch active role in the header to **Internal Ops (Admin)**.
4. Re-issue the query for `ORD-2001`: The system now grants access, evaluates LumenWorks **Clause 3.4**, and stages the appropriate 50% credit.
