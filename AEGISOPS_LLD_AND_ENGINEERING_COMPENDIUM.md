# PARCELPILOT LOW-LEVEL DESIGN (LLD) & ENGINEERING COMPENDIUM
**Autonomous Support & Operations Engine — Architectural Patterns, Domain Models, and Verification Specifications**

---

## 1. Design Patterns in Agentic & Logistics Systems

### 1.1 `CreditCalculationStrategy` Hierarchy & Dynamic Selection
```typescript
export interface CreditEvaluationContext {
  delayHours: number;
  isCarrierFault: boolean;
  baseFeeINR: number;
}

export interface CreditCalculationStrategy {
  readonly strategyKey: string;
  calculateCredit(ctx: CreditEvaluationContext): { 
    creditPercent: number; 
    creditAmountINR: number; 
    clauseCitation: string 
  };
}

export class NorthstarCreditStrategy implements CreditCalculationStrategy {
  readonly strategyKey = 'STRATEGY_NORTHSTAR_CLAUSE_4_2';
  calculateCredit(ctx: CreditEvaluationContext) {
    if (!ctx.isCarrierFault || ctx.delayHours < 2.0) {
      return { 
        creditPercent: 0, 
        creditAmountINR: 0, 
        clauseCitation: 'Clause 4.2 (Delay < 2.0h or non-carrier fault)' 
      };
    }
    return { 
      creditPercent: 100, 
      creditAmountINR: ctx.baseFeeINR, 
      clauseCitation: '05_Northstar_Logistics_Enterprise_Agreement.pdf Clause 4.2 (100% credit at >= 2.0h)' 
    };
  }
}

export class LumenWorksCreditStrategy implements CreditCalculationStrategy {
  readonly strategyKey = 'STRATEGY_LUMENWORKS_CLAUSE_3_4';
  calculateCredit(ctx: CreditEvaluationContext) {
    if (!ctx.isCarrierFault || ctx.delayHours < 3.0) {
      return { 
        creditPercent: 0, 
        creditAmountINR: 0, 
        clauseCitation: 'Clause 3.4 (Delay < 3.0h or non-carrier fault)' 
      };
    }
    return { 
      creditPercent: 50, 
      creditAmountINR: Math.round(ctx.baseFeeINR * 0.5), 
      clauseCitation: '06_LumenWorks_Service_Agreement.pdf Clause 3.4 (50% credit at >= 3.0h)' 
    };
  }
}

export class StandardCreditStrategy implements CreditCalculationStrategy {
  readonly strategyKey = 'STRATEGY_STANDARD_SOP_V3';
  calculateCredit(ctx: CreditEvaluationContext) {
    if (!ctx.isCarrierFault || ctx.delayHours < 4.0) {
      return { 
        creditPercent: 0, 
        creditAmountINR: 0, 
        clauseCitation: 'Standard SOP v3 Sec 2.1 (Delay < 4.0h or non-carrier fault)' 
      };
    }
    return { 
      creditPercent: 25, 
      creditAmountINR: Math.round(ctx.baseFeeINR * 0.25), 
      clauseCitation: '01_Support_Policy_v3.pdf Sec 2.1 (25% credit at >= 4.0h)' 
    };
  }
}

// Registry eliminating if/else branching:
export class CreditStrategyRegistry {
  private strategies = new Map<string, CreditCalculationStrategy>();

  register(strategy: CreditCalculationStrategy) { 
    this.strategies.set(strategy.strategyKey, strategy); 
  }

  getStrategyForAccount(account: { customContractFile?: string | null }): CreditCalculationStrategy {
    const key = account.customContractFile?.includes('Northstar') 
      ? 'STRATEGY_NORTHSTAR_CLAUSE_4_2'
      : account.customContractFile?.includes('LumenWorks') 
      ? 'STRATEGY_LUMENWORKS_CLAUSE_3_4'
      : 'STRATEGY_STANDARD_SOP_V3';
    return this.strategies.get(key) || this.strategies.get('STRATEGY_STANDARD_SOP_V3')!;
  }
}
```

### 1.2 State Pattern for Order Lifecycle
- **Interface Contract**: Each state implements `markPickedUp()`, `markDelivered()`, `cancel()`, and `validateTransition(targetState)`.
- **Illegal Transition Guarding (`DeliveredState → BookedState`)**:
  `DeliveredState` is an immutable terminal state. Any invocation of `transitionTo(target)` throws an `InvalidStateTransitionError("DELIVERED is an immutable terminal state. Transition to BOOKED is illegal.")`.

### 1.3 Cancellation Policy Strategy
```typescript
export interface CancellationPolicy {
  computeCancellationFee(baseFeeINR: number, noticeHours: number): { 
    feeINR: number; 
    isWaived: boolean; 
    citation: string 
  };
}

export class NorthstarCancellationPolicy implements CancellationPolicy {
  computeCancellationFee(baseFeeINR: number, noticeHours: number) {
    if (noticeHours >= 2.0) {
      return { feeINR: 0, isWaived: true, citation: 'Clause 4.1 ($0 fee waiver for notice >= 2.0h)' };
    }
    return { feeINR: 4000, isWaived: false, citation: 'Clause 4.1 (Standard fee applies for notice < 2.0h)' };
  }
}

export class StandardCancellationPolicy implements CancellationPolicy {
  computeCancellationFee(baseFeeINR: number, noticeHours: number) {
    return { feeINR: 4000, isWaived: false, citation: 'SOP v4 Section 3.1 ($50 / ₹4,000 within 24h)' };
  }
}

export class Order {
  cancel(policy: CancellationPolicy, noticeHours: number) {
    if (this.status !== 'BOOKED') throw new InvalidStateTransitionError(this.id, this.status, 'CANCELLED');
    const result = policy.computeCancellationFee(this.feeINR, noticeHours);
    this.status = 'CANCELLED';
    return result;
  }
}
```

### 1.4 `MutationFactory` Pattern
```typescript
export class MutationFactory {
  public static createMutation(
    type: 'ISSUE_SERVICE_CREDIT' | 'CANCEL_SHIPMENT' | 'ESCALATE_TICKET', 
    data: any
  ): IStagedMutation {
    switch (type) {
      case 'ISSUE_SERVICE_CREDIT': return new CreditMutation(data);
      case 'CANCEL_SHIPMENT': return new CancellationMutation(data);
      case 'ESCALATE_TICKET': return new EscalationMutation(data);
      default: throw new SchemaValidationError('MutationFactory', [`Unrecognized mutation type: ${type}`]);
    }
  }
}
```

### 1.5 Builder Pattern for `SLABreachReport`
- **Architectural Motivation**: Avoids telescoping constructors with multiple positional arguments, eliminates parameter permutation bugs (e.g. swapping `account_id` and `carrier`), and allows step-by-step invariant validation prior to calling `.build()`.

### 1.6 Observer Pattern for Order Transitions
```typescript
export interface OrderSubject {
  attach(observer: OrderObserver): void;
  detach(observer: OrderObserver): void;
  notify(event: OrderTransitionEvent): void;
}

export interface OrderObserver {
  onOrderStateChanged(event: OrderTransitionEvent): Promise<void>;
}
// Registered Subscribed Listeners: SLATimerCanceller, WebhookDispatchService, ComplianceAuditLogger
```

### 1.7 Telemetry & Hardware Scan Guard Hook (TKT-504 Fix)
- In `OrderAggregate.validateTelemetryConsistency(events: TelemetryScanEvent[])`, if `events.find(e => e.eventType === 'DRIVER_PICKED_UP')` exists while `currentState.status === 'BOOKED'`, flag `WEBHOOK_DELAY_PICKUP_UNRECORDED` (BUG-1092) and trigger automated state reconciliation.

### 1.8 Carrier Fee Calculator Registry
- Keyed `Map<string, CarrierFeeCalculator>` (`"SwiftShip"`, `"BlueDart Pro"`, `"RoadRunner"`). Fallback to `DefaultCarrierFeeCalculator` if no carrier-specific override is found.

### 1.9 Chain of Responsibility for Contract Precedence
- Handlers: `Tier1EnterpriseAgreementHandler` $\to$ `Tier2CurrentSopHandler`. If unhandled, return default policy. `Tier3DeprecatedHandler` is **strictly omitted** to ensure deprecated policies cannot be executed as terminal handlers.

### 1.10 Template Method Pattern for Ticket Resolution
```typescript
export abstract class TicketResolutionPipeline<TContext, TOutcome> {
  public async execute(ticketId: string): Promise<TOutcome> {
    await this.validateRequest(ticketId);
    const ctx = await this.fetchContext(ticketId);
    const outcome = await this.computeOutcome(ctx);
    await this.stageMutation(outcome);
    await this.notifyStakeholders(outcome);
    return outcome;
  }
  protected abstract computeOutcome(ctx: TContext): Promise<TOutcome>;
}
```

---

## 2. Object-Oriented Modeling & Domain-Driven Design (DDD)

### 2.1 `Order` Entity vs. `Money` Value Object
- Standard floating point numbers produce IEEE 754 precision artifacts (`0.1 + 0.2 = 0.30000000000000004`).
- `Money` encapsulates `amount` (or integer cents) and `currency` as an immutable Value Object, enforcing invariants in constructor: `amount >= 0`, valid ISO currency code, and preventing addition across mismatched currencies.

### 2.2 Aggregate Boundary for `Order`
- `Order` is an independent Aggregate Root. `CreditMutation` and `CancellationRequest` are **separate aggregates** referencing `order_id`. 
- **Consistency Boundary**: Staged actions have their own approval lifecycles, review queues, and TTL expirations without holding prolonged write locks on operational order records.

### 2.3 `AccountRepository` in Domain Layer
- **Dependency Inversion Principle**: The core business domain defines the contract (`interface AccountRepository`). Concrete infrastructure layers (PostgreSQL, Firestore, Mock) implement it, keeping domain logic testable and storage-agnostic.

### 2.4 `HistoricalResolution` Value Object (`is_trusted: bool`)
- By marking historical ticket notes with `is_trusted = false` at the domain schema level, downstream agentic tools, ML pipelines, and operators cannot mistakenly treat unverified historical notes (e.g. TKT-450) as binding policy.

### 2.5 `Account` vs. `Tenant` Aggregate Root
- **Standalone `Account`**: Provides row-level isolation and simple concurrency.
- **`Tenant` owning `Contract`**: Supports multi-account corporate structures. For ParcelPilot, keeping `Account` as Aggregate Root with a `ContractId` reference achieves optimal balance.

### 2.6 Immutability of `LedgerTransaction`
- Immutable fields: `transactionId`, `orderId`, `accountId`, `amountINR`, `type`, `approvedBy`, `createdAt`.
- Zero public setters. Reversals must be executed via compensating debit/credit entries.

### 2.7 Rich Value Object for `CarrierFault`
- Rich domain model: `CarrierFaultDetails { isFault: boolean; confirmedBy: string; confirmedAt: Date; rootCause: string; isDisputed: boolean; evidenceUri?: string }`, enabling chargeback audits and carrier dispute workflows.

### 2.8 `ContractClause` Value Object Consumption
- `ContractClause { clauseId: '4.2', thresholdHours: 2.0, creditPercent: 100 }` is passed into `NorthstarCreditStrategy`, removing hardcoded magic numbers and allowing contract updates without code redeployment.

### 2.9 `SLAEvaluationService` Domain Service
- Cross-aggregate coordination (evaluating `Order` telemetry against `Account` contract rules and `Carrier` SLAs) belongs in a Domain Service because no single entity should take on multi-aggregate orchestration responsibilities.

### 2.10 `PendingMutation` Aggregate Lifecycle
- Independent operations queue querying (`findPendingForReview()`, `findExpired()`) without acquiring table locks on operational order shipments.

---

## 3. Concurrency, Thread Safety & Idempotency in Code

### 3.1 Thread-Safe `approve_mutation` with Row-Level Locking
```sql
BEGIN TRANSACTION;
SELECT * FROM pending_mutations WHERE id = :id AND status = 'PENDING_REVIEW' FOR UPDATE;
-- Verify status is still PENDING_REVIEW; if not, ROLLBACK and throw ConflictException
UPDATE pending_mutations SET status = 'APPROVED', approved_by = :approverId, updated_at = NOW() WHERE id = :id;
INSERT INTO ledger_transactions (...) VALUES (...);
COMMIT;
```

### 3.2 Idempotency-Key Mechanism
```sql
CREATE TABLE idempotency_records (
  idempotency_key VARCHAR(128) PRIMARY KEY,
  resource_id VARCHAR(64) NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
- Query key on arrival: if found, return cached response; if not, execute transaction and write record atomically.

### 3.3 Concurrent State Transitions via Mutex / Versioning
- Use an in-memory lock or optimistic version checking (`order.version`) so that concurrent pickup calls cannot overwrite terminal cancellation states.

### 3.4 Optimistic Concurrency Control (OCC)
```typescript
const affectedRows = await db.query(
  'UPDATE orders SET status = $1, version = version + 1 WHERE id = $2 AND version = $3',
  [newStatus, orderId, currentVersion]
);
if (affectedRows === 0) {
  throw new OptimisticLockConflictException(`Order ${orderId} was updated by a concurrent transaction.`);
}
```

### 3.5 Database-Level Unique Constraint for Credit Races
```sql
CREATE UNIQUE INDEX uq_order_credit_mutation 
ON pending_mutations (order_id, mutation_type) 
WHERE status IN ('PENDING_REVIEW', 'APPROVED');
```
- A duplicate concurrent creation attempt triggers a unique key violation, gracefully returning the existing pending mutation.

### 3.6 Python Singleton Registry & GIL Caveats
- In Python, module-level instantiation (`registry = CarrierFeeCalculatorRegistry()`) is inherently thread-safe due to the Global Interpreter Lock (GIL) and import lock, rendering naive double-checked locking unnecessary.

### 3.7 Bulk Upload Idempotency (TKT-502)
- Assign each row an `idempotency_key = hash(file_id, row_index, order_reference)`. Track processed row keys in Redis or a batch tracking table so retries pick up from the exact failing row.

### 3.8 Distributed Locking via Redis (`SETNX`)
```python
lock_acquired = redis_client.set(f"lock:order:{order_id}", worker_id, nx=True, ex=30)
if not lock_acquired:
    raise LockAcquisitionException("Another worker is currently processing this order.")
try:
    process_order(order_id)
finally:
    redis_client.eval(RELEASE_LOCK_LUA_SCRIPT, 1, f"lock:order:{order_id}", worker_id)
```

### 3.9 Compare-And-Swap (CAS) for State Transitions
```typescript
const success = atomicCompareAndSwap(mutation.status, 'PROPOSED', 'APPROVED');
if (!success) {
  throw new StateConflictException("Mutation was already transitioned by another operator.");
}
```

### 3.10 Lock Lease Expiry & Recovery
- Locks use a 30-second TTL with background heartbeat renewal. If a process crashes, the lock expires automatically after 30 seconds, unblocking subsequent operations.

---

## 4. Schema & Data Structure Optimization

### 4.1 Order Indexing: B-Tree Index
- A composite B-Tree index on `(account_id, booked_at DESC)` supports indexed lookups and range scans. In-memory hash maps fail across server restarts and cannot execute efficient chronological range queries.

### 4.2 Priority Queue for Carrier Delay Remediation
- Use a `MaxHeap` comparing `calculatedDelayHours`. Store heap indexes in a hash map `order_id -> heap_index` to support $O(\log n)$ updates (`heapify_up`/`heapify_down`).

### 4.3 Priority Queue with Tie-Breaking
- Tuple ordering in Priority Queue: `(priorityLevel, -slaBreachedTime, arrivalIndex)`. Ties (e.g. P0 outage vs. P0 security) resolve via FIFO order of arrival timestamp.

### 4.4 Trie vs. Sorted Binary Search for Carrier Names
- With only 3–10 carriers, a sorted array with binary search (or linear scan) has better CPU cache locality than a Trie, which adds unnecessary pointer indirection overhead.

### 4.5 LRU Cache with Event-Driven Invalidation
- Use an LRU Cache with a 15-minute TTL for `account_id -> ContractClause[]`. Invalidate immediately upon publishing a `ContractAmendedEvent` message.

### 4.6 Live Sorted Structure vs. Query Sort
- For read-heavy ops dashboards, maintain an in-memory `SkipList` or query a PostgreSQL index on `(carrier_fault, pickup_window_end)` rather than doing a full unindexed table scan.

### 4.7 High-Volume Deduplication: Bloom Filter Pre-Check
- A Redis Bloom filter tests key existence in $O(1)$ memory. If positive (potential duplicate), perform the authoritative DB check; if negative, proceed directly to insertion.

### 4.8 Interval Tree for Pickup Window Overlaps
- An `IntervalTree` is justified for live fleet scheduling engines matching driver arrival windows with package availability in $O(\log n + k)$ time.

### 4.9 Inverted Index for Bug Diagnostic Matching (Doc 04)
- Build an in-memory inverted index mapping symptom tokens (`"500"`, `"bulk"`, `"csv"`, `"70%"`, `"webhook"`) to known bug IDs (`BUG-1044`, `BUG-1092`).

### 4.10 Rolling Window for Anomaly Radar
- Use a `CircularBuffer` (Ring Buffer) of size $N$ with a running sum and counter to compute moving average delays in $O(1)$ time upon each new event.

---

## 5. SOLID Principles & Clean Code in Python/TypeScript

### 5.1 Open-Closed Principle Refactoring
- Extract `FeeCalculationStrategy` interface. New accounts add new strategy classes rather than editing a monolithic `PolicyEngine`.

### 5.2 Interface Segregation for Credit Calculations
- Split broad interfaces into `ITimeThresholdAuditor` and `IFinancialCreditCalculator`.

### 5.3 Liskov Substitution Principle (LSP)
- **Violation**: `NorthstarCreditStrategy` throwing an undeclared `ContractNotSignedException` where the base interface promises a clean numeric result.
- **Fix**: Ensure all strategies return a structured `CreditEvaluationResult` without unexpected runtime exceptions.

### 5.4 Dependency Inversion in `TicketHandler`
- **Before**: `constructor() { this.repo = new PostgresTicketRepository(); }`
- **After**: `constructor(private readonly repo: ITicketRepository) {}`

### 5.5 Single Responsibility Principle (SRP)
- Split into `CreditAssessmentEngine`, `CustomerNotificationDispatcher`, and `ComplianceAuditLogger`.

### 5.6 `IPrecedenceResolver` Extensibility
```typescript
export interface IPrecedenceResolver {
  resolve(account: Account, issue: OperationalIssue): BindingRule;
}
```

### 5.7 Dependency Inversion for Mutation Validators
```typescript
export interface IMutationValidator {
  validate(mutation: StagedMutation): ValidationResult;
}
// Inject MockMutationValidator in unit tests; ProductionMutationValidator at runtime.
```

### 5.8 Refactoring `calculate_credit` Polymorphism
- Replace `if account_name == "Northstar"` with `account.getCreditStrategy().evaluate(order)`.

### 5.9 LSP for Notification Dispatchers
- `EmailNotifier`, `ChatNotifier`, and `SMSNotifier` all fulfill `sendNotification(to, message): Promise<void>` without precondition mismatches.

### 5.10 OCP for `AuditLogger`
- `AuditLogger` delegates to a list of `IAuditLogSink` implementations (`FileSink`, `DatabaseSink`, `SiemSink`), allowing new destinations without altering core logging logic.

---

## 6. Custom Exception Hierarchies & Error Handling

### 6.1 `ParcelPilotError` Base Hierarchy
```typescript
export abstract class ParcelPilotError extends Error {
  public abstract readonly errorCode: string;
  public abstract readonly statusCode: number;
  public readonly timestamp = new Date().toISOString();
  constructor(
    message: string, 
    public readonly context: Record<string, any> = {}, 
    public readonly isRecoverable = false
  ) {
    super(message);
  }
}
```

### 6.2 Security vs. Business Exception Separation
- `TenantAuthorizationError` inherits from `SecurityError` (triggers audit alerts and security logging), whereas `CarrierThresholdBreachError` is a standard business domain condition.

### 6.3 `InvalidStateTransitionError` Diagnostic Payload
- Carries `orderId`, `fromStatus`, `toStatus`, `allowedTransitions`, and `auditReason`.

### 6.4 Handling `StagedActionExpiredException` at API Layer
- Returns **HTTP 410 Gone** with payload `{ error: "STAGED_ACTION_EXPIRED", remediation: "RE_EVALUATE_POLICY" }`. UI refreshes the proposal automatically.

### 6.5 `ContractNotFoundError` vs. `ContractParseError`
- `ContractNotFoundError` is a valid business fallback (switch to Tier 2 SOP). `ContractParseError` is an infrastructure failure requiring an incident alert.

### 6.6 `DuplicateMutationError` Semantics
- Treated as a benign idempotent return: returns the existing pending mutation and logs an informational notice.

### 6.7 Tool Call Error Recovery in Agent Pipelines
- Catch `CarrierThresholdBreachError` inside the tool handler, returning `{ eligible: false, reason: "Threshold not met" }` to allow the agent to explain the outcome cleanly to the customer.

### 6.8 `AmbiguousOrderReferenceError`
- Carries `account_id`, `requested_intent`, and `matching_orders: [{ order_id, carrier, booked_at }]` to allow the assistant to prompt: *"Did you mean ORD-1001 or ORD-1002?"*

### 6.9 Webhook Inconsistency Handling (TKT-504)
- Emits a diagnostic warning `WEBHOOK_TELEMETRY_INCONSISTENCY` (BUG-1092) and forces a telemetry state reconciliation rather than crashing the user workflow.

### 6.10 Eliminating Blanket `except Exception:`
- Catches specific domain errors (`TenantAuthorizationError`, `StagedActionExpiredException`), preventing hidden financial bugs or masked database connection failures.

---

## 7. Database Schema & Index Design

### 7.1 Orders Table DDL
```sql
CREATE TABLE orders (
  order_id VARCHAR(32) PRIMARY KEY,
  account_id VARCHAR(32) NOT NULL REFERENCES accounts(account_id),
  carrier VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  booked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  pickup_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  pickup_window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_pickup_at TIMESTAMP WITH TIME ZONE,
  fee_inr NUMERIC(12, 2) NOT NULL CHECK (fee_inr >= 0),
  carrier_fault BOOLEAN NOT NULL DEFAULT FALSE,
  customer_fault BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7.2 Composite Index on `(account_id, status, booked_at)`
```sql
CREATE INDEX idx_orders_acct_status_booked ON orders (account_id, status, booked_at DESC);
```
- Accelerates queries filtering by account and status while sorting by booking timestamp via an index-only scan.

### 7.3 Relational Foreign Keys & Cascade Safety
- `ledger_transactions` uses `ON DELETE RESTRICT` to ensure financial audit records can never be accidentally cascade-deleted when an order or account is removed.

### 7.4 Contracts Schema & Clean Null Modeling
```sql
CREATE TABLE contracts (
  contract_id VARCHAR(32) PRIMARY KEY,
  account_id VARCHAR(32) UNIQUE NOT NULL REFERENCES accounts(account_id),
  document_uri VARCHAR(255) NOT NULL,
  effective_date DATE NOT NULL
);
```
- Standard accounts without custom agreements simply have no record in the `contracts` table.

### 7.5 Partial Index on Pending Mutations
```sql
CREATE INDEX idx_pending_mutations_review ON pending_mutations (created_at DESC) 
WHERE status = 'PENDING_REVIEW';
```
- Indexes only the small percentage of active pending reviews, keeping the index size tiny and fast.

### 7.6 Idempotency Key Migration Script
```sql
-- UP:
ALTER TABLE ledger_transactions ADD COLUMN idempotency_key VARCHAR(128);
UPDATE ledger_transactions SET idempotency_key = 'LEGACY_TX_' || transaction_id WHERE idempotency_key IS NULL;
ALTER TABLE ledger_transactions ALTER COLUMN idempotency_key SET NOT NULL;
CREATE UNIQUE INDEX uq_ledger_idempotency_key ON ledger_transactions(idempotency_key);

-- DOWN:
DROP INDEX uq_ledger_idempotency_key;
ALTER TABLE ledger_transactions DROP COLUMN idempotency_key;
```

### 7.7 Normalized Carrier Fault Audit Table
```sql
CREATE TABLE carrier_fault_events (
  event_id VARCHAR(32) PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL REFERENCES orders(order_id),
  confirmed_by VARCHAR(64) NOT NULL,
  carrier_disputed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7.8 Tickets Table with Untrusted History Modeling
```sql
CREATE TYPE resolution_trust_level AS ENUM ('BINDING_CURRENT_SOP', 'UNVERIFIED_HISTORICAL', 'DEPRECATED');

ALTER TABLE tickets ADD COLUMN historical_resolution_trust resolution_trust_level DEFAULT 'UNVERIFIED_HISTORICAL';
```

### 7.9 Generated Column Index for Pickup Delays
```sql
ALTER TABLE orders ADD COLUMN delay_minutes INTEGER GENERATED ALWAYS AS (
  EXTRACT(EPOCH FROM (actual_pickup_at - pickup_window_end)) / 60
) STORED;

CREATE INDEX idx_orders_carrier_delay ON orders (carrier, delay_minutes) WHERE carrier_fault = TRUE;
```

### 7.10 Splitting Fee Column Migration Strategy
1. Add `base_fee_inr` and create `ledger_transactions`.
2. Backfill `base_fee_inr = fee_inr` for completed historical orders.
3. Dual-write during deployment window.
4. Deprecate legacy column.

---

## 8. Unit Testing, Mocking & Test-Driven Development (TDD)

### 8.1 Northstar Credit Strategy Boundary Test
```python
def test_northstar_credit_boundary_conditions():
    strategy = NorthstarCreditStrategy()
    
    # Exactly at threshold (2.0h) -> 100% credit
    result_exact = strategy.calculate_credit(delay_hours=2.0, is_carrier_fault=True, base_fee_inr=4200)
    assert result_exact.credit_percent == 100
    assert result_exact.credit_amount_inr == 4200
    
    # 1 minute under threshold (1.98h) -> 0% credit
    result_under = strategy.calculate_credit(delay_hours=1.98, is_carrier_fault=True, base_fee_inr=4200)
    assert result_under.credit_percent == 0
    assert result_under.credit_amount_inr == 0
```

### 8.2 Mocking LLM Tool Calls in Integration Tests
```python
def test_sla_pipeline_with_mocked_contract_tool(mocker):
    mock_tool = mocker.patch("toolEngine.get_contract_clause")
    mock_tool.return_value = ContractClause(clause_id="4.2", threshold_hours=2.0, credit_percent=100)
    
    outcome = run_sla_evaluation(order_id="ORD-1001")
    assert outcome.credit_amount_inr == 4200
```

### 8.3 Deterministic Temporal Delay Testing
```python
def test_delay_calculator_with_injected_clock():
    frozen_reference_time = datetime.fromisoformat("2026-08-16T11:00:00+05:30")
    order = Order(pickup_window_end=datetime.fromisoformat("2026-08-16T06:30:00+05:30"), actual_pickup_at=None)
    
    delay_hours = compute_order_delay(order, reference_time=frozen_reference_time)
    assert delay_hours == 4.5  # Exactly 4h 30m overdue
```

### 8.4 Delay Calculator Edge Cases
- **On-time pickup**: `actual = end` $\to$ `delay = 0.0h`.
- **Early pickup**: `actual < start` $\to$ `delay = 0.0h` (negative values clamped).
- **Leap year**: `2028-02-28 23:30` to `2028-02-29 01:30` $\to$ `delay = 2.0h`.

### 8.5 TDD Idempotency Spec
```python
def test_approve_mutation_is_strictly_idempotent(db_session):
    mutation = create_pending_mutation(amount_inr=4200)
    key = "IDEMPOTENCY_KEY_12345"
    
    res1 = approve_mutation(mutation.id, idempotency_key=key)
    res2 = approve_mutation(mutation.id, idempotency_key=key)
    
    assert res1.transaction_id == res2.transaction_id
    assert db_session.query(LedgerTransaction).count() == 1
```

### 8.6 Mock `AccountRepository` for Fallback Testing
```python
class MockAccountRepository(IAccountRepository):
    def get_by_id(self, account_id: str) -> Account:
        if account_id == "ACCT-004":  # Axis Labs
            return Account(id="ACCT-004", name="Axis Labs", custom_contract=None)
        raise NotFoundException()

def test_axis_labs_falls_back_to_standard_policy():
    service = SLAEvaluationService(account_repo=MockAccountRepository())
    policy = service.resolve_policy("ACCT-004")
    assert isinstance(policy, StandardEnterprisePolicy)
```

### 8.7 State Transition & Observer Unit Test
```python
def test_order_illegal_transition_and_observer():
    order = Order(order_id="ORD-1001", initial_status="DELIVERED")
    
    with pytest.raises(InvalidStateTransitionError):
        order.transition_to("BOOKED")
        
    booked_order = Order(order_id="ORD-1002", initial_status="BOOKED")
    mock_observer = Mock()
    booked_order.attach(mock_observer)
    
    booked_order.transition_to("PICKED_UP")
    assert mock_observer.on_order_state_changed.called
```

### 8.8 Concurrency Race Condition Integration Test
```python
import concurrent.futures

def test_concurrent_approvals_only_one_succeeds():
    mutation_id = "STG-MUTATION-99"
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(approve_mutation, mutation_id, "agent_1")
        f2 = executor.submit(approve_mutation, mutation_id, "agent_2")
        
        results = [f1.result(), f2.result()]
        successes = [r for r in results if r.status == "SUCCESS"]
        conflicts = [r for r in results if r.status == "CONFLICT_ALREADY_APPROVED"]
        
        assert len(successes) == 1
        assert len(conflicts) == 1
```

### 8.9 Null Handling for Unpicked Orders
```python
def test_unpicked_order_delay_computation():
    order = Order(actual_pickup_at=None, pickup_window_end="2026-08-16T06:30:00+05:30")
    delay = calculate_delay(order, reference_time="2026-08-16T11:00:00+05:30")
    assert delay == 4.5
```

### 8.10 Golden Master / Pipeline Verification Test (TKT-450)
```python
def test_ticket_resolution_pipeline_overrides_untrusted_history():
    ticket_450 = load_ticket_fixture("TKT-450")  # Northstar cancellation after 90m notice
    pipeline = TicketResolutionPipeline()
    
    resolution = pipeline.resolve(ticket_450)
    
    # Assert output does NOT match untrusted historical note (INR 250 fee)
    assert resolution.fee_inr != 250
    # Assert output matches authoritative Tier 1 Enterprise Clause 4.1 ($0 / INR 0 waiver for notice >= 2.0h)
    assert resolution.fee_inr == 0
    assert resolution.clause_citation == "05_Northstar_Logistics_Enterprise_Agreement.pdf Clause 4.1"
```
