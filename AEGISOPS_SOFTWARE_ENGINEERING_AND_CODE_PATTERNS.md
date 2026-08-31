# 🏛️ ParcelPilot: Software Engineering, Design Patterns & Code Mastery Blueprint
## Production Object-Oriented Architecture, Domain-Driven Design, Thread Safety, DDL & TDD

---

# 📑 Master Table of Contents
1. [Section 1: Design Patterns in Agentic & Logistics Systems](#1-design-patterns-in-agentic--logistics-systems)
2. [Section 2: Object-Oriented Modeling & Domain-Driven Design (DDD)](#2-object-oriented-modeling--domain-driven-design-ddd)
3. [Section 3: Concurrency, Thread Safety & Idempotency in Code](#3-concurrency-thread-safety--idempotency-in-code)
4. [Section 4: Schema & Data Structure Optimization](#4-schema--data-structure-optimization)
5. [Section 5: SOLID Principles & Clean Code in Python/TypeScript](#5-solid-principles--clean-code-in-pythontypescript)
6. [Section 6: Custom Exception Hierarchies & Error Handling](#6-custom-exception-hierarchies--error-handling)
7. [Section 7: Database Schema & Index Design (SQL DDL & Migrations)](#7-database-schema--index-design-sql-ddl--migrations)
8. [Section 8: Unit Testing, Mocking & Test-Driven Development (TDD)](#8-unit-testing-mocking--test-driven-development-tdd)

---

# 1. Design Patterns in Agentic & Logistics Systems

### Q1.1: `CreditCalculationStrategy` Hierarchy & Strategy Registry (No if/else chains)
```typescript
export interface CreditEvaluationContext {
  delayHours: number;
  isCarrierFault: boolean;
  baseFeeINR: number;
}

export interface CreditCalculationStrategy {
  readonly strategyKey: string;
  calculateCredit(context: CreditEvaluationContext): { creditPercent: number; creditAmountINR: number; clauseCitation: string };
}

export class NorthstarCreditStrategy implements CreditCalculationStrategy {
  readonly strategyKey = 'STRATEGY_NORTHSTAR_CLAUSE_4_2';
  calculateCredit(ctx: CreditEvaluationContext) {
    if (!ctx.isCarrierFault || ctx.delayHours < 2.0) {
      return { creditPercent: 0, creditAmountINR: 0, clauseCitation: 'Clause 4.2 (Threshold < 2.0h or no carrier fault)' };
    }
    return { creditPercent: 100, creditAmountINR: ctx.baseFeeINR, clauseCitation: '05_Northstar_Agreement.pdf Clause 4.2 (100% credit at >= 2.0h)' };
  }
}

export class LumenWorksCreditStrategy implements CreditCalculationStrategy {
  readonly strategyKey = 'STRATEGY_LUMENWORKS_CLAUSE_3_4';
  calculateCredit(ctx: CreditEvaluationContext) {
    if (!ctx.isCarrierFault || ctx.delayHours < 3.0) {
      return { creditPercent: 0, creditAmountINR: 0, clauseCitation: 'Clause 3.4 (Threshold < 3.0h or no carrier fault)' };
    }
    const credit = Math.round(ctx.baseFeeINR * 0.5);
    return { creditPercent: 50, creditAmountINR: credit, clauseCitation: '06_LumenWorks_Agreement.pdf Clause 3.4 (50% credit at >= 3.0h)' };
  }
}

export class StandardCreditStrategy implements CreditCalculationStrategy {
  readonly strategyKey = 'STRATEGY_STANDARD_SOP_V3';
  calculateCredit(ctx: CreditEvaluationContext) {
    if (!ctx.isCarrierFault || ctx.delayHours < 4.0) {
      return { creditPercent: 0, creditAmountINR: 0, clauseCitation: 'Standard SOP v3 Sec 2.1 (Threshold < 4.0h or no carrier fault)' };
    }
    const credit = Math.round(ctx.baseFeeINR * 0.25);
    return { creditPercent: 25, creditAmountINR: credit, clauseCitation: '01_Support_Policy_v3.pdf Sec 2.1 (25% credit at >= 4.0h)' };
  }
}

// Registry eliminating if/else branching:
export class CreditStrategyRegistry {
  private strategies = new Map<string, CreditCalculationStrategy>();

  register(strategy: CreditCalculationStrategy) {
    this.strategies.set(strategy.strategyKey, strategy);
  }

  getStrategyForAccount(account: { customContractFile?: string | null }): CreditCalculationStrategy {
    if (account.customContractFile?.includes('Northstar')) return this.strategies.get('STRATEGY_NORTHSTAR_CLAUSE_4_2')!;
    if (account.customContractFile?.includes('LumenWorks')) return this.strategies.get('STRATEGY_LUMENWORKS_CLAUSE_3_4')!;
    return this.strategies.get('STRATEGY_STANDARD_SOP_V3')!;
  }
}
```

---

### Q1.2: Order Lifecycle via the State Pattern (`src/models/OrderState.ts`)
```typescript
export interface InconsistencyAuditResult {
  hasInconsistency: boolean;
  code?: 'WEBHOOK_DELAY_PICKUP_UNRECORDED' | 'POD_DELIVERED_STATUS_LAG' | 'TELEMETRY_STATUS_MISMATCH';
  details?: string;
  recommendedState?: OrderLifecycleStatus;
  driverScanTimestamp?: string;
}

export interface IOrderState {
  readonly status: OrderLifecycleStatus;
  canCancel(): boolean;
  canIssueCredit(): boolean;
  transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void;
  validateTelemetryGuard?(events: TelemetryScanEvent[]): InconsistencyAuditResult;
}

export type OrderState = IOrderState;

export class BookedState implements IOrderState {
  readonly status = 'BOOKED';
  canCancel() { return true; }
  canIssueCredit() { return false; }
  transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'PICKED_UP' || target === 'CANCELLED' || target === 'DELAYED') {
      order.setStatus(target);
    } else {
      throw new InvalidStateTransitionError(order.id, this.status, target, reason);
    }
  }

  public validateTelemetryGuard(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    const pickupScan = events.find(e => e.eventType === 'DRIVER_PICKED_UP');
    if (pickupScan) {
      return {
        hasInconsistency: true,
        code: 'WEBHOOK_DELAY_PICKUP_UNRECORDED',
        details: `Driver hardware scan logged pickup at ${pickupScan.timestamp}, but system is currently in 'BOOKED' status (SwiftShip webhook ingestion delay BUG-1092).`,
        recommendedState: 'PICKED_UP',
        driverScanTimestamp: pickupScan.timestamp,
      };
    }
    return { hasInconsistency: false };
  }
}

export class PickedUpState implements IOrderState {
  readonly status = 'PICKED_UP';
  canCancel() { return false; }
  canIssueCredit() { return true; }
  transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'IN_TRANSIT' || target === 'DELAYED' || target === 'DELIVERED') {
      order.setStatus(target);
    } else {
      throw new InvalidStateTransitionError(order.id, this.status, target, 'Cannot cancel or re-book picked up order');
    }
  }
}

export class DeliveredState implements IOrderState {
  readonly status = 'DELIVERED';
  canCancel() { return false; }
  canIssueCredit() { return true; }
  transitionTo(order: OrderAggregate, target: OrderLifecycleStatus): void {
    throw new InvalidStateTransitionError(order.id, this.status, target, 'DELIVERED is an immutable terminal state');
  }
}

export class CancelledState implements IOrderState {
  readonly status = 'CANCELLED';
  canCancel() { return false; }
  canIssueCredit() { return false; }
  transitionTo(order: OrderAggregate, target: OrderLifecycleStatus): void {
    throw new InvalidStateTransitionError(order.id, this.status, target, 'CANCELLED is an immutable terminal state');
  }
}
```

---

### Q1.3: Cancellation Policy Strategy Pattern
```typescript
export interface CancellationPolicy {
  computeCancellationFee(noticePeriodHours: number, baseFeeINR: number): { feeINR: number; waiverGranted: boolean; citation: string };
}

export class NorthstarCancellationPolicy implements CancellationPolicy {
  computeCancellationFee(noticePeriodHours: number, baseFeeINR: number) {
    if (noticePeriodHours >= 2.0) {
      return { feeINR: 0, waiverGranted: true, citation: 'Northstar Agreement Clause 4.1 (Notice >= 2.0h fee waived to $0.00)' };
    }
    return { feeINR: 4200, waiverGranted: false, citation: 'Northstar Agreement Clause 4.1 (Notice < 2.0h standard $50 fee applies)' };
  }
}

export class StandardCancellationPolicy implements CancellationPolicy {
  computeCancellationFee(noticePeriodHours: number, baseFeeINR: number) {
    if (noticePeriodHours >= 6.0) {
      return { feeINR: 0, waiverGranted: true, citation: 'Standard SOP v4 Sec 3.2 (Notice >= 6.0h)' };
    }
    return { feeINR: 4200, waiverGranted: false, citation: 'Standard SOP v4 Sec 3.2 (Standard $50 cancellation fee within 24h)' };
  }
}
```

---

### Q1.4: `MutationFactory` for Staged Financial Actions (`src/services/mutationFactory.ts`)
```typescript
export class MutationFactory {
  public static createMutation(type: 'CREDIT', data: CreditMutationData): CreditMutation;
  public static createMutation(type: 'FEE_WAIVER', data: FeeWaiverMutationData): FeeWaiverMutation;
  public static createMutation(type: 'CANCELLATION', data: CancellationMutationData): CancellationMutation;
  public static createMutation(type: 'ESCALATE_TICKET', data: EscalationMutationData): EscalationMutation;
  public static createMutation(type: StagedMutationType | string, data: any): IStagedMutation {
    switch (type) {
      case 'CREDIT': {
        const mutation = new CreditMutation(data);
        mutation.validate();
        return mutation;
      }
      case 'FEE_WAIVER': {
        const mutation = new FeeWaiverMutation(data);
        mutation.validate();
        return mutation;
      }
      case 'CANCELLATION': {
        const mutation = new CancellationMutation(data);
        mutation.validate();
        return mutation;
      }
      case 'ESCALATE_TICKET': {
        const mutation = new EscalationMutation(data);
        mutation.validate();
        return mutation;
      }
      default:
        throw new UnrecognizedMutationTypeError(
          `MutationFactory cannot create mutation for unrecognized type: '${type}'. Supported types: ['CREDIT', 'FEE_WAIVER', 'CANCELLATION', 'ESCALATE_TICKET']`
        );
    }
  }
}
```

---

### Q1.5: Builder Pattern for `SLABreachReport`
```typescript
export class SLABreachReport {
  private constructor(
    public readonly accountId: string,
    public readonly orderId: string,
    public readonly carrier: string,
    public readonly delayHours: number,
    public readonly applicableClause: string,
    public readonly computedCreditINR: number,
    public readonly isCarrierFault: boolean,
    public readonly generatedAt: Date
  ) {}

  static get Builder() {
    return class SLABreachReportBuilder {
      private accountId!: string;
      private orderId!: string;
      private carrier!: string;
      private delayHours = 0;
      private applicableClause = 'UNSPECIFIED';
      private computedCreditINR = 0;
      private isCarrierFault = false;

      setAccount(id: string) { this.accountId = id; return this; }
      setOrder(id: string) { this.orderId = id; return this; }
      setCarrier(carrier: string) { this.carrier = carrier; return this; }
      setDelay(hours: number) { this.delayHours = hours; return this; }
      setClause(clause: string) { this.applicableClause = clause; return this; }
      setCredit(amount: number) { this.computedCreditINR = amount; return this; }
      setCarrierFault(fault: boolean) { this.isCarrierFault = fault; return this; }

      build(): SLABreachReport {
        if (!this.accountId || !this.orderId || !this.carrier) {
          throw new IncompleteBuilderStateError('Missing required fields: accountId, orderId, or carrier');
        }
        return new SLABreachReport(
          this.accountId, this.orderId, this.carrier, this.delayHours,
          this.applicableClause, this.computedCreditINR, this.isCarrierFault, new Date()
        );
      }
    };
  }
}
```
* **Why Builder is Superior**: Eliminates telescoping constructor bugs where adjacent positional primitives (`delayHours: number`, `computedCreditINR: number`, `isCarrierFault: boolean`) are easily swapped by mistake.

---

### Q1.6: Observer Pattern for Order Transitions
```typescript
export interface OrderEvent {
  orderId: string;
  previousState: string;
  newState: string;
  timestamp: Date;
}

export interface OrderObserver {
  onOrderStateChanged(event: OrderEvent): Promise<void>;
}

export interface OrderSubject {
  attach(observer: OrderObserver): void;
  detach(observer: OrderObserver): void;
  notify(event: OrderEvent): Promise<void>;
}

export class SLATimerCancellerObserver implements OrderObserver {
  async onOrderStateChanged(event: OrderEvent) {
    if (event.newState === 'PICKED_UP') {
      console.log(`[SLATimer] Cancelling SLA breach delay timer for order ${event.orderId}`);
    }
  }
}

export class CustomerNotificationObserver implements OrderObserver {
  async onOrderStateChanged(event: OrderEvent) {
    if (event.newState === 'PICKED_UP') {
      console.log(`[Notifier] Dispatching SMS/Email: Your order ${event.orderId} was collected by driver.`);
    }
  }
}
```

---

### Q1.7: State Pattern Inconsistency Guard for Webhook Lags (`TKT-504`)
In `BookedState`:
```typescript
export class BookedState implements OrderState {
  readonly stateName = 'BOOKED';
  
  validateExternalTelemetry(order: StatefulOrder, telemetry: { hasPhysicalDriverScan: boolean; scanTime: Date | null }) {
    if (telemetry.hasPhysicalDriverScan && telemetry.scanTime) {
      // Inconsistency detected: Driver performed scan, but platform still reads BOOKED
      throw new WebhookDelayInconsistencyError({
        orderId: order.orderId,
        currentState: 'BOOKED',
        telemetryScanTime: telemetry.scanTime,
        remedy: 'FORCE_TELEMETRY_SYNC_SOP_04'
      });
    }
  }
}
```

---

### Q1.8: `CarrierFeeCalculatorRegistry` Strategy Pattern
```typescript
export interface CarrierFeeStrategy {
  readonly carrierName: string;
  calculateBaseFee(weightKg: number, distanceKm: number, isPriority: boolean): number;
}

export class SwiftShipFeeStrategy implements CarrierFeeStrategy {
  readonly carrierName = 'SwiftShip';
  calculateBaseFee(weightKg: number, distanceKm: number, isPriority: boolean) {
    const base = 500 + (weightKg * 45) + (distanceKm * 2.5);
    return isPriority ? Math.round(base * 1.3) : Math.round(base);
  }
}

export class BlueDartProFeeStrategy implements CarrierFeeStrategy {
  readonly carrierName = 'BlueDart Pro';
  calculateBaseFee(weightKg: number, distanceKm: number, isPriority: boolean) {
    return Math.round(800 + (weightKg * 60) + (distanceKm * 3.2));
  }
}

export class CarrierFeeCalculatorRegistry {
  private static instance: CarrierFeeCalculatorRegistry;
  private strategies = new Map<string, CarrierFeeStrategy>();

  private constructor() {
    this.register(new SwiftShipFeeStrategy());
    this.register(new BlueDartProFeeStrategy());
  }

  static getInstance(): CarrierFeeCalculatorRegistry {
    if (!CarrierFeeCalculatorRegistry.instance) {
      CarrierFeeCalculatorRegistry.instance = new CarrierFeeCalculatorRegistry();
    }
    return CarrierFeeCalculatorRegistry.instance;
  }

  register(strategy: CarrierFeeStrategy) {
    this.strategies.set(strategy.carrierName.toLowerCase(), strategy);
  }

  getStrategy(carrierName: string): CarrierFeeStrategy {
    const strategy = this.strategies.get(carrierName.toLowerCase());
    if (!strategy) throw new UnsupportedCarrierError(`Carrier '${carrierName}' is not registered in Fee Calculator.`);
    return strategy;
  }
}
```

---

### Q1.9: Chain of Responsibility for Source Precedence Hierarchy
```typescript
export interface ResolutionRequest {
  accountId: string;
  orderId: string;
  actionType: 'CANCEL' | 'DELAY_CREDIT';
  noticeHours?: number;
  delayHours?: number;
  isCarrierFault?: boolean;
}

export interface ResolutionResult {
  isResolved: boolean;
  governingTier: 'TIER_1' | 'TIER_2';
  documentCitation: string;
  feeOrCreditINR: number;
}

export abstract class AbstractPrecedenceHandler {
  protected nextHandler: AbstractPrecedenceHandler | null = null;

  setNext(handler: AbstractPrecedenceHandler): AbstractPrecedenceHandler {
    this.nextHandler = handler;
    return handler;
  }

  abstract resolve(req: ResolutionRequest): ResolutionResult;
}

export class Tier1EnterpriseAgreementHandler extends AbstractPrecedenceHandler {
  resolve(req: ResolutionRequest): ResolutionResult {
    if (req.accountId === 'ACCT-001') { // Northstar Custom Contract
      if (req.actionType === 'CANCEL' && (req.noticeHours ?? 0) >= 2.0) {
        return { isResolved: true, governingTier: 'TIER_1', documentCitation: '05_Northstar Clause 4.1', feeOrCreditINR: 0 };
      }
      if (req.actionType === 'DELAY_CREDIT' && (req.delayHours ?? 0) >= 2.0 && req.isCarrierFault) {
        return { isResolved: true, governingTier: 'TIER_1', documentCitation: '05_Northstar Clause 4.2', feeOrCreditINR: 4200 };
      }
    }
    if (req.accountId === 'ACCT-002' && req.actionType === 'DELAY_CREDIT') { // LumenWorks
      if ((req.delayHours ?? 0) >= 3.0 && req.isCarrierFault) {
        return { isResolved: true, governingTier: 'TIER_1', documentCitation: '06_LumenWorks Clause 3.4', feeOrCreditINR: 1200 };
      }
    }
    // Fallthrough to next tier if no Tier 1 override matched
    if (this.nextHandler) return this.nextHandler.resolve(req);
    throw new UnresolvedPrecedenceError('Chain failed to resolve request.');
  }
}

export class Tier2StandardSOPHandler extends AbstractPrecedenceHandler {
  resolve(req: ResolutionRequest): ResolutionResult {
    // Active baseline SOPs always terminate standard requests
    if (req.actionType === 'CANCEL') {
      return { isResolved: true, governingTier: 'TIER_2', documentCitation: '03_Cancellation_SOP_v4.pdf', feeOrCreditINR: 4200 };
    }
    return { isResolved: true, governingTier: 'TIER_2', documentCitation: '01_Support_Policy_v3.pdf', feeOrCreditINR: 1050 };
  }
}
```
* **Why Tier 3 Cannot Be Terminal**: Tier 3 (`02_Support_Policy_v2_DEPRECATED.pdf`) is deprecated. Permitting it as a terminal fallback would allow legally void and incorrect historical numbers to execute.

---

### Q1.10: Template Method for Support Ticket Resolution
```typescript
export abstract class TicketResolutionPipeline {
  // The Template Method (sealed algorithm structure)
  public async executePipeline(ticketId: string): Promise<ResolutionResultPayload> {
    const ticket = await this.fetchAndValidateTicket(ticketId);
    const context = await this.loadContext(ticket);
    const outcome = await this.computeOutcome(ticket, context);
    const staged = await this.stageMutation(outcome);
    await this.notifyStakeholders(staged);
    return outcome;
  }

  protected async fetchAndValidateTicket(ticketId: string) {
    console.log(`[Pipeline] Validating ticket ${ticketId}`);
    return { ticketId, status: 'OPEN' };
  }

  protected async loadContext(ticket: any) {
    return { loadedAt: new Date() };
  }

  // Primitive operation overridden by subclasses:
  protected abstract computeOutcome(ticket: any, context: any): Promise<ResolutionResultPayload>;

  protected async stageMutation(outcome: ResolutionResultPayload) {
    console.log(`[Pipeline] Staging mutation for ${outcome.action}`);
    return { stagedId: 'STG-9901' };
  }

  protected async notifyStakeholders(staged: any) {
    console.log(`[Pipeline] Notification dispatched for ${staged.stagedId}`);
  }
}

export class SLACreditTicketResolver extends TicketResolutionPipeline {
  protected async computeOutcome(ticket: any, context: any) {
    return { action: 'ISSUE_SERVICE_CREDIT', deltaINR: 1200, citation: 'Tier 1 Clause 3.4' };
  }
}

export class BillingContactTicketResolver extends TicketResolutionPipeline {
  protected async computeOutcome(ticket: any, context: any) {
    return { action: 'UPDATE_BILLING_CONTACT', deltaINR: 0, citation: 'SOP Admin Sec 1.1' };
  }
}
```

---

# 2. Object-Oriented Modeling & Domain-Driven Design (DDD)

### Q2.1: Order as Entity & Money as Immutable Value Object
```typescript
export class Money {
  public readonly amount: number;
  public readonly currency: 'INR' | 'USD';

  constructor(amount: number, currency: 'INR' | 'USD' = 'INR') {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new DomainInvariantViolationError(`Money amount must be non-negative finite number. Received: ${amount}`);
    }
    // Enforce 2 decimal precision integer storage in cents/paisa internally
    this.amount = Math.round(amount * 100) / 100;
    this.currency = currency;
    Object.freeze(this);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new CurrencyMismatchError(`Cannot add ${this.currency} and ${other.currency}`);
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```
* **Why Value Objects Over Plain Floats**: Floats suffer from binary IEEE-754 precision drift (`0.1 + 0.2 === 0.30000000000000004`), risk negative amounts without guards, and lose currency denomination metadata.

---

### Q2.2: Order Aggregate Boundary & Consistency Rules
```
┌────────────────────────────────────────────────────────────┐
│                    ORDER AGGREGATE                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Order (Aggregate Root)                               │  │
│  │ - order_id (ID)                                      │  │
│  │ - status (BookedState, PickedUpState, etc.)          │  │
│  │ - base_fee: Money                                    │  │
│  │ - cancellation_request: CancellationRequest (VO)     │  │
│  └──────────────────────────┬───────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────┘
                              │ references order_id
                              ▼
┌────────────────────────────────────────────────────────────┐
│               LEDGER TRANSACTION AGGREGATE                 │
│  - transaction_id (ID)                                     │
│  - target_order_id: OrderId                                │
│  - financial_delta: Money                                  │
│  - cryptographic_hash: string                              │
└────────────────────────────────────────────────────────────┘
```
* **Justification**: `CancellationRequest` directly mutates `Order.status` and lives **inside** the Order Aggregate. `CreditMutation` / `LedgerTransaction` represents an external financial posting across billing domains and is modeled as a **separate aggregate referencing `order_id`**.

---

### Q2.3: `AccountRepository` Interface in Domain Layer (Dependency Inversion)
```typescript
// /domain/repositories/AccountRepository.ts
export interface AccountRepository {
  findById(accountId: string): Promise<Account | null>;
  findByCSM(csmEmail: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
}
```
* **Why Domain Layer Owns Interface**: Keeps the core business domain decoupled from database implementation details (PostgreSQL, Firestore, DynamoDB). Domain logic depends on abstractions; infrastructure implements them.

---

### Q2.4: `HistoricalResolution` Value Object with `is_trusted` Guard
```typescript
export class HistoricalResolution {
  constructor(
    public readonly summaryText: string,
    public readonly agentId: string,
    public readonly resolvedAt: Date,
    public readonly isTrusted: boolean
  ) {
    Object.freeze(this);
  }

  getBindingAdvice(): string {
    if (!this.isTrusted) {
      throw new UntrustedHistoricalDataError(
        'Historical ticket resolution is tagged UNTRUSTED and cannot be used for automated policy arbitration.'
      );
    }
    return this.summaryText;
  }
}
```

---

### Q2.5: Account Aggregate Root vs. Tenant Aggregate
* **Account as Aggregate Root**: Optimal when billing, SLAs, and customer support tickets are partitioned strictly per legal entity (`ACCT-001` Northstar).
* **Tenant as Aggregate Root**: Groups multiple regional sub-accounts under one parent enterprise contract.
* **Trade-off**: For ParcelPilot, **Account as Aggregate Root** provides clean Row-Level Security without deep hierarchical object locks.

---

### Q2.6: Immutable `LedgerTransaction` Domain Entity
```typescript
export class LedgerTransaction {
  public readonly transactionId: string;
  public readonly orderId: string;
  public readonly accountId: string;
  public readonly deltaAmount: Money;
  public readonly policyCitation: string;
  public readonly operatorId: string;
  public readonly committedAt: Date;
  public readonly sha256ProofHash: string;

  constructor(params: {
    transactionId: string; orderId: string; accountId: string;
    deltaAmount: Money; policyCitation: string; operatorId: string;
    committedAt: Date; sha256ProofHash: string;
  }) {
    this.transactionId = params.transactionId;
    this.orderId = params.orderId;
    this.accountId = params.accountId;
    this.deltaAmount = params.deltaAmount;
    this.policyCitation = params.policyCitation;
    this.operatorId = params.operatorId;
    this.committedAt = params.committedAt;
    this.sha256ProofHash = params.sha256ProofHash;
    Object.freeze(this); // Zero public setters, totally immutable
  }
}
```

---

### Q2.7: Rich `CarrierFault` Value Object
```typescript
export class CarrierFaultAttestation {
  constructor(
    public readonly isFault: boolean,
    public readonly confirmedBy: 'CARRIER_WEBHOOK' | 'DRIVER_GPS' | 'OPS_MANUAL' | 'NONE',
    public readonly confirmedAt: Date | null,
    public readonly isDisputed: boolean,
    public readonly disputeNotes?: string
  ) {
    Object.freeze(this);
  }

  isEligibleForSLAClaim(): boolean {
    return this.isFault && !this.isDisputed && this.confirmedBy !== 'NONE';
  }
}
```

---

### Q2.8: `ContractClause` Value Object
```typescript
export class ContractClause {
  constructor(
    public readonly clauseId: string,
    public readonly thresholdHours: number,
    public readonly creditPercent: number,
    public readonly appliesToService: 'PRIORITY_EXPRESS' | 'STANDARD_FREIGHT' | 'ALL'
  ) {
    Object.freeze(this);
  }

  evaluate(delayHours: number): number {
    return delayHours >= this.thresholdHours ? this.creditPercent : 0;
  }
}
```

---

### Q2.9: `SLAEvaluationService` Domain Service
```typescript
export class SLAEvaluationService {
  evaluateOrderSLA(order: StatefulOrder, account: Account, clause: ContractClause, referenceTime: Date): SLABreachReport {
    const elapsedDelay = this.calculateDelay(order, referenceTime);
    const creditPercent = clause.evaluate(elapsedDelay);
    const creditAmount = Math.round(order.baseFeeINR * (creditPercent / 100));

    return SLABreachReport.Builder
      .setAccount(account.id)
      .setOrder(order.orderId)
      .setCarrier(order.carrier)
      .setDelay(elapsedDelay)
      .setClause(clause.clauseId)
      .setCredit(creditAmount)
      .setCarrierFault(order.isCarrierFault)
      .build();
  }

  private calculateDelay(order: StatefulOrder, now: Date): number {
    if (order.actualPickupAt) return 0; // Picked up on time
    const diffMs = now.getTime() - order.pickupWindowEnd.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  }
}
```

---

### Q2.10: `PendingMutation` Aggregate & Dedicated Repository
```typescript
export interface PendingMutationRepository {
  findPendingForReview(): Promise<PendingMutation[]>;
  findExpired(cutoffTime: Date): Promise<PendingMutation[]>;
  findById(mutationId: string): Promise<PendingMutation | null>;
  save(mutation: PendingMutation): Promise<void>;
}
```
* **Why Separate from Order**: `PendingMutation` has an independent lifecycle (TTL expiry, dual-operator approval stages, human review queues) that does not alter actual order delivery state until committed.

---

# 3. Concurrency, Thread Safety & Idempotency in Code

### Q3.1: Thread-Safe `approve_mutation` with Mutex
```python
import threading
from typing import Dict

class MutationService:
    def __init__(self, repository, ledger_service):
        self.repo = repository
        self.ledger = ledger_service
        self._locks: Dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def _get_mutation_lock(self, mutation_id: str) -> threading.Lock:
        with self._global_lock:
            if mutation_id not in self._locks:
                self._locks[mutation_id] = threading.Lock()
            return self._locks[mutation_id]

    def approve_mutation(self, mutation_id: str, approver_id: str) -> dict:
        lock = self._get_mutation_lock(mutation_id)
        with lock: # Mutex locked per mutation_id
            mutation = self.repo.find_by_id(mutation_id)
            if not mutation:
                raise NotFoundError(f"Mutation {mutation_id} not found")
            if mutation.status != "PENDING_REVIEW":
                raise InvalidStateTransitionError(f"Mutation is in state {mutation.status}, cannot approve.")
            
            # Atomic state transition
            mutation.status = "APPROVED"
            mutation.approved_by = approver_id
            self.repo.save(mutation)
            
            # Commit to ledger
            tx = self.ledger.commit_entry(mutation)
            return {"status": "COMMITTED", "tx_hash": tx.sha256_hash}
```

---

### Q3.2: Idempotency Key Scheme for `issue_credit`
```sql
CREATE TABLE idempotency_records (
    idempotency_key VARCHAR(128) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```
```python
def issue_credit(order_id: str, amount_inr: float, idempotency_key: str, db_conn) -> dict:
    with db_conn.cursor() as cursor:
        # Check-then-insert via SQL atomic insert conflict
        cursor.execute("SELECT response_payload FROM idempotency_records WHERE idempotency_key = %s;", (idempotency_key,))
        row = cursor.fetchone()
        if row:
            return row[0] # Return cached original response immediately

        # Compute and commit
        tx_hash = execute_ledger_credit(order_id, amount_inr)
        response = {"status": "COMMITTED", "order_id": order_id, "amount": amount_inr, "tx_hash": tx_hash}
        
        cursor.execute(
            "INSERT INTO idempotency_records (idempotency_key, order_id, request_hash, response_payload) VALUES (%s, %s, %s, %s);",
            (idempotency_key, order_id, "hash_req", json.dumps(response))
        )
        db_conn.commit()
        return response
```

---

### Q3.3: In-Memory Order Mutex for Transition Safety
```typescript
export class ConcurrentSafeOrder {
  private transitionMutex = new Mutex();

  async transitionTo(newState: OrderState, telemetryTime: Date) {
    const release = await this.transitionMutex.acquire();
    try {
      this.state.markPickedUp(this, telemetryTime);
    } finally {
      release();
    }
  }
}
```

---

### Q3.4: Optimistic Concurrency Control (OCC)
```python
def update_order_status_occ(order_id: str, new_status: str, expected_version: int, db_conn):
    with db_conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE orders 
            SET status = %s, version = version + 1 
            WHERE order_id = %s AND version = %s;
            """,
            (new_status, order_id, expected_version)
        )
        if cursor.rowcount == 0:
            db_conn.rollback()
            raise ConcurrencyConflictError(
                f"Order {order_id} was modified concurrently (version != {expected_version}). Refresh and retry."
            )
        db_conn.commit()
```

---

### Q3.5: Database Unique Constraint for Concurrent Job Deduplication
```sql
CREATE UNIQUE INDEX uq_credit_mutation_per_order 
ON pending_mutations (order_id, action_type) 
WHERE status IN ('PENDING_REVIEW', 'APPROVED');
```
* **Behavior**: Whichever job loses the insert race catches a PostgreSQL `unique_violation` (SQLSTATE `23505`) and safely logs a benign no-op: `"Credit proposal already exists for ORD-2002."`

---

### Q3.6: Python Thread-Safe Registry & GIL Considerations
```python
import threading

class CarrierFeeCalculatorRegistry:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if not cls._instance:
            with cls._lock:
                if not cls._instance: # Double-checked locking with mutex
                    cls._instance = super(CarrierFeeCalculatorRegistry, cls).__new__(cls)
                    cls._instance._registry = {}
        return cls._instance
```
* **Why Naive DCL Fails Without Lock in Python**: While the GIL prevents low-level byte corruption, `__new__` and instance variable assignment are multiple bytecode instructions (`LOAD_GLOBAL`, `CALL_FUNCTION`, `STORE_FAST`), permitting race windows during object construction across native threads.

---

### Q3.7: Idempotent Batch CSV Row Processing (`TKT-502`)
```python
def process_bulk_csv(csv_rows, batch_id, db_conn):
    for index, row in enumerate(csv_rows):
        row_idempotency_token = f"{batch_id}_row_{index}_{row['order_ref']}"
        with db_conn.cursor() as cur:
            cur.execute("SELECT 1 FROM processed_batch_rows WHERE row_token = %s", (row_idempotency_token,))
            if cur.fetchone():
                continue # Row already processed in prior attempt; skip safely
            
            # Process insertion
            insert_shipment_record(row, cur)
            cur.execute("INSERT INTO processed_batch_rows (row_token, batch_id) VALUES (%s, %s)", (row_idempotency_token, batch_id))
        db_conn.commit()
```

---

### Q3.8: Distributed Redis Lock (`SETNX` with TTL)
```python
import redis
import uuid
import time

r = redis.Redis(host='localhost', port=6379)

def acquire_distributed_order_lock(order_id: str, ttl_seconds: int = 15) -> str:
    lease_token = str(uuid.uuid4())
    # SET lock:order_id lease_token NX EX ttl_seconds
    acquired = r.set(f"lock:order:{order_id}", lease_token, nx=True, ex=ttl_seconds)
    if not acquired:
        raise ResourceLockedError(f"Order {order_id} is currently locked by another server instance.")
    return lease_token

def release_distributed_order_lock(order_id: str, lease_token: str):
    # Lua script for safe release only if token matches holding owner
    lua_script = """
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    else
        return 0
    end
    """
    r.eval(lua_script, 1, f"lock:order:{order_id}", lease_token)
```

---

### Q3.9: CAS (Compare-And-Swap) State Machine Transition
```typescript
interface AtomicMutationState {
  version: number;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
}

function compareAndSwapStatus(
  mutation: AtomicMutationState,
  expectedStatus: string,
  newStatus: 'APPROVED' | 'REJECTED'
): boolean {
  if (mutation.status !== expectedStatus) {
    return false; // CAS Failed: Loser thread gets false
  }
  mutation.status = newStatus;
  mutation.version += 1;
  return true;
}
```
* **Losing Thread Action**: The losing thread aborts execution and returns `409 Conflict: Mutation state was already updated by another concurrent operator.`

---

### Q3.10: Lock Timeout & Automatic Lease Expiry
All distributed locks must enforce a hard **15-second TTL**. If a node crashes mid-approval, Redis automatically evicts the lock key after 15 seconds, preventing the order from becoming permanently unapprovable.

---

# 4. Schema & Data Structure Optimization

### Q4.1: B-Tree Index vs. In-Memory Hash Map for `(account_id, booked_at)`
* **Decision**: **B-Tree Index on Database Table**.
* **Justification**:
  - Hash Maps do not support ordered range scans ($O(n)$ re-sort required on each query).
  - B-Trees allow $O(\log n + k)$ index traversal directly retrieving the latest orders sorted by `booked_at` without consuming server RAM as datasets grow to millions of rows.

---

### Q4.2: Priority Queue for Carrier-Fault Delay Workers
```python
import heapq
import time

class DelayedOrderPriorityQueue:
    def __init__(self):
        self._queue = []
        self._entry_map = {}
        self._counter = 0

    def add_or_update_order(self, order_id: str, delay_hours: float):
        # Min-heap storing negative delay to pop largest delay first
        priority = -delay_hours 
        if order_id in self._entry_map:
            self.remove_order(order_id)
        count = self._counter
        self._counter += 1
        entry = [priority, count, order_id]
        self._entry_map[order_id] = entry
        heapq.heappush(self._queue, entry)

    def remove_order(self, order_id: str):
        entry = self._entry_map.pop(order_id, None)
        if entry:
            entry[-1] = "<REMOVED>"

    def pop_longest_delayed_order(self) -> str:
        while self._queue:
            priority, count, order_id = heapq.heappop(self._queue)
            if order_id != "<REMOVED>":
                del self._entry_map[order_id]
                return order_id
        raise IndexError("Queue is empty")
```

---

### Q4.3: Support Queue Priority Queue with Tie-Breaking
```python
# Priority Tuple: (SeverityRank [0=P0, 1=P1], CreatedTimestamp)
# Example: TKT-501 (P0, 10:30) vs TKT-505 (P0, 08:30)
# TKT-505 popped first because CreatedTimestamp is earlier (FIFO among same priority tier)
```

---

### Q4.4: Carrier Name Lookup: Trie vs. Binary Search
* **Decision**: **Sorted Array + Binary Search / Direct Hash Map**.
* **Justification**: The carrier fleet contains only 3–10 entities (`SwiftShip`, `BlueDart Pro`, `RoadRunner`). A Trie introduces pointer overhead and cache-miss penalties with zero asymptotic benefit over an $O(1)$ flat hash table or small array.

---

### Q4.5: In-Memory LRU Cache for Contract Clauses with Pub/Sub Invalidation
```python
from functools import lru_cache

@lru_cache(maxsize=512)
def get_cached_contract_clauses(account_id: str):
    return fetch_contract_clauses_from_db(account_id)

def on_contract_amendment_event(account_id: str):
    get_cached_contract_clauses.cache_clear() # Evicts and hot-reloads
```

---

### Q4.6: Temporal Delay Sorting: Live Balanced BST vs. On-Demand Index Query
* **Decision**: **Database Index Scan with Cached 30s Materialized Query**.
* **Justification**: Ingest writes occur every few seconds. Maintaining a continuous in-memory AVL/Skip-List across distributed web pods requires distributed synchronization. A fast B-Tree index scan on `(pickup_window_end ASC)` is far more resilient.

---

### Q4.7: Bloom Filter Pre-Check for Idempotency at Scale
At $> 100,000\text{ req/sec}$:
1. Check in-memory **Bloom Filter** (0.01% false positive rate).
2. If Bloom Filter says *No*, key is guaranteed new $\to$ skip database read and proceed straight to atomic insert.
3. If Bloom Filter says *Yes*, query PostgreSQL/Redis to confirm key existence.

---

### Q4.8: Interval Tree for Pickup Window Overlap Lookups
* An **Interval Tree** ($O(\log n + k)$) is justified when scheduling driver dispatch routes to answer: *"Find all orders whose pickup windows $[T_{\text{start}}, T_{\text{end}}]$ intersect with Driver Route Window $[10:00, 12:00]$."*

---

### Q4.9: Inverted Index for Doc 04 Known Issues Search
```json
{
  "csv": ["KI-204", "KI-102"],
  "upload": ["KI-204"],
  "70%": ["KI-204"],
  "500": ["KI-501"],
  "webhook": ["KI-504"]
}
```
* Matches symptom tokens using TF-IDF / BM25 in $< 1\text{ms}$.

---

### Q4.10: Rolling Window Deque for Carrier Breach Clustering
```python
from collections import deque

class CarrierBreachRadar:
    def __init__(self, window_seconds: int = 3600):
        self.window_seconds = window_seconds
        self.carrier_events = {} # carrier -> deque of timestamps

    def record_delay_event(self, carrier: str, timestamp: float):
        if carrier not in self.carrier_events:
            self.carrier_events[carrier] = deque()
        q = self.carrier_events[carrier]
        q.append(timestamp)
        self._evict_stale(carrier, timestamp)

    def _evict_stale(self, carrier: str, now: float):
        q = self.carrier_events[carrier]
        cutoff = now - self.window_seconds
        while q and q[0] < cutoff:
            q.popleft()

    def get_active_breach_count(self, carrier: str, now: float) -> int:
        self._evict_stale(carrier, now)
        return len(self.carrier_events.get(carrier, []))
```

---

# 5. SOLID Principles & Clean Code in Python/TypeScript

### Q5.1: Refactoring `PolicyEngine` to satisfy Open-Closed Principle (OCP)
#### ❌ Bad (Violates OCP):
```python
class PolicyEngine:
    def calculate_fee(self, account_name: str, notice_hours: float):
        if account_name == "Northstar":
            return 0 if notice_hours >= 2.0 else 4200
        elif account_name == "LumenWorks":
            return 2100 if notice_hours >= 3.0 else 4200
        return 4200
```
#### ✅ Good (OCP Compliant via Strategy):
```python
class AccountCancellationPolicy(ABC):
    @abstractmethod
    def compute_fee(self, notice_hours: float) -> int: pass

class NorthstarPolicy(AccountCancellationPolicy):
    def compute_fee(self, notice_hours: float) -> int:
        return 0 if notice_hours >= 2.0 else 4200

class StandardPolicy(AccountCancellationPolicy):
    def compute_fee(self, notice_hours: float) -> int:
        return 0 if notice_hours >= 6.0 else 4200

class PolicyEngine:
    def __init__(self):
        self._policies = {}
    def register_policy(self, account_id: str, policy: AccountCancellationPolicy):
        self._policies[account_id] = policy
    def calculate_fee(self, account_id: str, notice_hours: float) -> int:
        policy = self._policies.get(account_id, StandardPolicy())
        return policy.compute_fee(notice_hours)
```

---

### Q5.2: Interface Segregation Principle (ISP) for Credit Evaluation
```typescript
// Narrow, focused interfaces instead of one bloated interface:
export interface IThresholdChecker {
  isBreached(delayHours: number): boolean;
}

export interface ICreditPercentCalculator {
  calculatePercentage(delayHours: number): number;
}
```

---

### Q5.3: Liskov Substitution Principle (LSP) Violation & Fix
#### ❌ LSP Violation:
```typescript
export interface ICreditStrategy {
  evaluate(delayHours: number): number;
}

export class RogueCreditStrategy implements ICreditStrategy {
  evaluate(delayHours: number): number {
    if (delayHours < 0) throw new Error("CRASH!"); // Violates caller expectations
    return 50;
  }
}
```
#### ✅ Fixed (Substitutable):
All subclasses guarantee non-exceptional handling of non-negative inputs and return standardized percentage values $[0, 100]$.

---

### Q5.4: Dependency Inversion Principle (DIP) on `TicketHandler`
```typescript
// ❌ Before (Tightly coupled to Postgres):
export class BadTicketHandler {
  private repo = new PostgresTicketRepository();
}

// ✅ After (Depends on abstraction):
export class GoodTicketHandler {
  constructor(private readonly repo: TicketRepository) {}
}
```

---

### Q5.5: Single Responsibility Principle (SRP) Split on `SupportAgentService`
```
┌────────────────────────────────────────────────────────┐
│               SupportAgentService (SRP SPLIT)          │
├────────────────────────────────────────────────────────┤
│ 1. SLACompensationEngine   --> Pure mathematical math  │
│ 2. CustomerNotifierService --> Email/SMS dispatch      │
│ 3. AuditLedgerCommitter    --> Firestore immutable log │
└────────────────────────────────────────────────────────┘
```

---

### Q5.6: Open-Closed `IPrecedenceResolver`
```typescript
export interface IPrecedenceRule {
  readonly priority: number; // 1 = Tier 1, 2 = Tier 2
  canHandle(req: ResolutionRequest): boolean;
  evaluate(req: ResolutionRequest): ResolutionResult;
}

export class PrecedenceEngine {
  private rules: IPrecedenceRule[] = [];
  registerRule(rule: IPrecedenceRule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }
  resolve(req: ResolutionRequest): ResolutionResult {
    for (const rule of this.rules) {
      if (rule.canHandle(req)) return rule.evaluate(req);
    }
    throw new UnresolvedPrecedenceError('No matching rule');
  }
}
```

---

### Q5.7: TypeScript `IMutationValidator` with Mock Injection
```typescript
export interface IMutationValidator {
  validate(mutation: StagedMutation): Promise<boolean>;
}

export class MockMutationValidator implements IMutationValidator {
  async validate() { return true; } // For instantaneous unit testing
}
```

---

### Q5.8: Polymorphic Refactoring of Account Name Checks
Replaced `if account_name == "Northstar"` with polymorphic contract strategy classes registered in a factory dictionary.

---

### Q5.9: `INotifier` Liskov Substitution
```typescript
export interface INotifier {
  send(recipient: string, message: string): Promise<void>;
}
export class EmailNotifier implements INotifier { async send(to: string, msg: string) { /* ... */ } }
export class ChatNotifier implements INotifier { async send(to: string, msg: string) { /* ... */ } }
```

---

### Q5.10: Open-Closed `AuditLogger` Sinks
```typescript
export interface IAuditSink {
  write(entry: ImmutableAuditLog): Promise<void>;
}

export class CompositeAuditLogger {
  constructor(private sinks: IAuditSink[]) {}
  async log(entry: ImmutableAuditLog) {
    await Promise.all(this.sinks.map(s => s.write(entry)));
  }
}
```

---

# 6. Custom Exception Hierarchies & Error Handling

### Q6.1: Master Exception Hierarchy (`ParcelPilotErrors.ts`)
```typescript
export interface ErrorDiagnosticPayload {
  errorCode: string;
  statusCode: number;
  message: string;
  timestamp: string;
  accountId?: string;
  orderId?: string;
  ticketId?: string;
  mutationId?: string;
  metadata?: Record<string, any>;
  suggestedRecoveryAction?: string;
}

export abstract class ParcelPilotError extends Error {
  public readonly timestamp: string;

  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly statusCode: number = 500,
    public readonly accountId?: string,
    public readonly orderId?: string,
    public readonly isRetryable: boolean = false,
    public readonly suggestedRecoveryAction?: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toDiagnosticPayload(): ErrorDiagnosticPayload {
    return {
      errorCode: this.errorCode,
      statusCode: this.statusCode,
      message: this.message,
      timestamp: this.timestamp,
      accountId: this.accountId,
      orderId: this.orderId,
      suggestedRecoveryAction: this.suggestedRecoveryAction,
      metadata: this.metadata,
    };
  }
}

export class TenantAuthorizationError extends ParcelPilotError {
  constructor(accountId: string, resourceId: string, attemptedAction: string) {
    super(
      `Tenant Authorization Breach: Account '${accountId}' is not authorized to perform '${attemptedAction}' on resource '${resourceId}'.`,
      'RBAC_TENANT_ISOLATION_VIOLATION',
      403,
      accountId,
      resourceId,
      false,
      'Switch to the correct tenant session or login as internal_ops to view cross-tenant fleet records.'
    );
  }
}

export class StagedActionExpiredException extends ParcelPilotError {
  constructor(public readonly mutationId: string, public readonly expiredAt: string) {
    super(
      `Staged Action '${mutationId}' has expired as of ${expiredAt}. TTL window elapsed.`,
      'STAGED_MUTATION_TTL_EXPIRED',
      410,
      undefined,
      undefined,
      false,
      'Re-run policy audit and stage a fresh proposal based on current real-time order state.'
    );
  }
}

export class CarrierThresholdBreachError extends ParcelPilotError {
  constructor(orderId: string, carrierName: string, actualDelayHours: number, requiredThresholdHours: number) {
    super(
      `Carrier SLA Threshold Not Met: Order '${orderId}' (${carrierName}) delayed by ${actualDelayHours.toFixed(1)}h, which does not meet the contractual threshold of >= ${requiredThresholdHours.toFixed(1)}h.`,
      'CARRIER_DELAY_THRESHOLD_NOT_MET',
      422,
      undefined,
      orderId,
      false,
      'Verify carrier fault flags or review Tier 1 custom contract agreement exceptions.'
    );
  }
}

export class InvalidStateTransitionError extends ParcelPilotError {
  constructor(orderId: string, fromState: string, targetState: string, reason?: string) {
    super(
      `Illegal State Transition: Order '${orderId}' cannot transition from '${fromState}' to '${targetState}'. ${reason || ''}`,
      'INVALID_ORDER_STATE_TRANSITION',
      400,
      undefined,
      orderId,
      false,
      'Check physical driver telemetry or review immutable terminal state constraints.'
    );
  }
}

export class WebhookDelayInconsistencyError extends ParcelPilotError {
  constructor(orderId: string, dbState: string, physicalTelemetryEvent: string, eventTimestamp: string) {
    super(
      `State Inconsistency (BUG-1092): Order '${orderId}' has status '${dbState}' in database, but physical telemetry logged '${physicalTelemetryEvent}' at ${eventTimestamp}.`,
      'WEBHOOK_INGESTION_LAG_DETECTED',
      409,
      undefined,
      orderId,
      true,
      'Replay carrier webhook sync or manually confirm driver scan verification.'
    );
  }
}

export class ContractPrecedenceViolationError extends ParcelPilotError {
  constructor(citedDocument: string, accountId: string) {
    super(
      `Contract Precedence Violation: Document '${citedDocument}' is deprecated or superseded for account '${accountId}'.`,
      'TIER_3_DEPRECATED_POLICY_CITED',
      400,
      accountId,
      undefined,
      false,
      'Enforce Tier 1 Enterprise Agreement or Tier 2 Active SOP v3/v4 exclusively.'
    );
  }
}

export class FinancialCapExceededError extends ParcelPilotError {
  constructor(accountId: string, requestedAmountINR: number, capAmountINR: number) {
    super(
      `Monthly Financial Cap Exceeded: Credit request of ₹${requestedAmountINR} exceeds monthly threshold of ₹${capAmountINR} for account '${accountId}'.`,
      'MONTHLY_FINANCIAL_CAP_EXCEEDED',
      422,
      accountId,
      undefined,
      false,
      'Escalate to Finance Director or CSM Lead for manual override approval.'
    );
  }
}

export class SchemaValidationError extends ParcelPilotError {
  constructor(toolName: string, validationErrors: string[]) {
    super(
      `Tool Schema Validation Failure for '${toolName}': ${validationErrors.join('; ')}`,
      'TOOL_INPUT_SCHEMA_VALIDATION_FAILED',
      400,
      undefined,
      undefined,
      false,
      'Ensure input parameters strictly match the published JSON schema and allowed enums.'
    );
  }
}
```

---

### Q6.2: Security vs. Business Logic Exception Granularity
* **Justification**: Catching `SecurityError` upstream immediately terminates the session, logs a potential security incident, and returns `403 Forbidden`. Catching `BusinessLogicError` allows the agent to formulate a friendly conversational explanation or prompt a human review without raising a security siren.

---

### Q6.3: `InvalidStateTransitionError` Payload
Carries: `orderId`, `fromState`, `attemptedToState`, `allowedTransitions: string[]`, `timestamp`.

---

### Q6.4: API Layer `StagedActionExpiredException` Handler
Surfaces as **HTTP 410 Gone**:
```json
{
  "error": "STAGED_MUTATION_EXPIRED",
  "message": "The 15-minute approval window for this proposal has elapsed.",
  "action_required": "RE_EVALUATE_FRESH_STATE"
}
```

---

### Q6.5: `ContractNotFoundError` vs `ContractParseError`
* `ContractNotFoundError`: **Expected Business Case** (e.g. Beacon Retail has no custom contract $\to$ gracefully falls through to Tier 2).
* `ContractParseError`: **Fatal Infrastructure Bug** (PDF is corrupted $\to$ pages engineering on-call).

---

### Q6.6: `DuplicateMutationError` Handling
* **Treated as a Benign Idempotent No-Op**: Returns the existing commit transaction payload with HTTP 200/201 and an `X-Idempotent-Replay: true` header.

---

### Q6.7: Agent Pipeline Tool Error Strategy
* Catch and **Re-Plan** if error is domain-related (`OrderNotEligibleError`).
* **Halt and Escalate** if error is state-corruption or security related.

---

### Q6.8: `AmbiguousOrderReferenceError`
```typescript
export class AmbiguousOrderReferenceError extends BusinessLogicError {
  constructor(public readonly matchingOrders: Array<{ orderId: string; status: string; bookedAt: string }>) {
    super('Multiple candidate orders found for query.', 'ERR_AMBIGUOUS_ORDER');
  }
}
```

---

### Q6.9: Webhook Delay Handling (`TKT-504`)
Emits a **Soft Warning Flag** (`DATA_INCONSISTENCY_WARNING`) to Ops rather than a hard unhandled crash, allowing the agent to suggest a manual sync workaround.

---

### Q6.10: Danger of Bare `except Exception:` in Financial Systems
Bare exception catching swallows critical database deadlocks, memory errors, and security violations, causing the agent to falsely assume an action succeeded or failed silently.

---

# 7. Database Schema & Index Design (SQL DDL & Migrations)

### Q7.1: Orders Master Table DDL
```sql
CREATE TYPE order_status_enum AS ENUM ('BOOKED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

CREATE TABLE orders (
    order_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id),
    carrier VARCHAR(64) NOT NULL,
    status order_status_enum NOT NULL DEFAULT 'BOOKED',
    booked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    pickup_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    pickup_window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_pickup_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    fee_inr NUMERIC(10, 2) NOT NULL CHECK (fee_inr >= 0),
    carrier_fault BOOLEAN NOT NULL DEFAULT FALSE,
    customer_fault BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_requested_at TIMESTAMP WITH TIME ZONE,
    operational_notes TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

### Q7.2: Composite Index on `(account_id, status, booked_at)`
```sql
CREATE INDEX idx_orders_account_status_booked 
ON orders (account_id, status, booked_at DESC);
```
* **Accelerates**: `SELECT * FROM orders WHERE account_id = 'ACCT-001' AND status = 'BOOKED' ORDER BY booked_at DESC;`
* **Does not accelerate**: Queries filtering solely by `booked_at` without `account_id`.

---

### Q7.3: Foreign Keys & `ON DELETE RESTRICT` for Ledgers
```sql
CREATE TABLE ledger_transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    delta_amount_inr NUMERIC(10, 2) NOT NULL,
    policy_citation TEXT NOT NULL,
    operator_id VARCHAR(64) NOT NULL,
    committed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sha256_hash VARCHAR(64) NOT NULL
);
```
* **Why `ON DELETE RESTRICT`**: `CASCADE` would allow an accidental customer record deletion to erase historical financial ledger entries, creating catastrophic compliance and tax audit violations.

---

### Q7.4: Contracts Table with Nullable Foreign Key
```sql
CREATE TABLE contracts (
    contract_id VARCHAR(64) PRIMARY KEY,
    contract_file_name VARCHAR(255) NOT NULL,
    governing_tier VARCHAR(32) NOT NULL DEFAULT 'TIER_1_CUSTOM',
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts 
ADD COLUMN contract_id VARCHAR(64) NULL REFERENCES contracts(contract_id);
-- Northstar & LumenWorks have contract_id populated; Beacon & Axis have NULL.
```

---

### Q7.5: Partial Index on `pending_mutations`
```sql
CREATE INDEX idx_pending_mutations_review 
ON pending_mutations (created_at DESC) 
WHERE status = 'PENDING_REVIEW';
```
* **Why Efficient**: 99% of mutations in the database are `COMMITTED` or `EXPIRED`. The partial index indexes only the 1% active rows, fitting entirely inside high-speed CPU L1/L2 cache.

---

### Q7.6: Migration: Adding `idempotency_key` with Safe Backfill
```sql
-- UP MIGRATION
ALTER TABLE ledger_transactions ADD COLUMN idempotency_key VARCHAR(128);

-- Backfill existing rows with deterministic hash of their primary key
UPDATE ledger_transactions 
SET idempotency_key = 'LEGACY_BACKFILL_' || transaction_id 
WHERE idempotency_key IS NULL;

ALTER TABLE ledger_transactions ALTER COLUMN idempotency_key SET NOT NULL;
CREATE UNIQUE INDEX uq_ledger_idempotency_key ON ledger_transactions (idempotency_key);

-- DOWN MIGRATION
DROP INDEX IF EXISTS uq_ledger_idempotency_key;
ALTER TABLE ledger_transactions DROP COLUMN IF EXISTS idempotency_key;
```

---

### Q7.7: Normalized `carrier_fault_events` Table
```sql
CREATE TABLE carrier_fault_events (
    event_id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(order_id),
    carrier VARCHAR(64) NOT NULL,
    confirmed_by VARCHAR(64) NOT NULL,
    dispute_status VARCHAR(32) NOT NULL DEFAULT 'UNDISPUTED',
    dispute_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

### Q7.8: Tickets Table with `trust_level` Column
```sql
CREATE TYPE historical_trust_level_enum AS ENUM ('CERTIFIED_BINDING', 'UNTRUSTED_HISTORICAL_NOTE');

CREATE TABLE tickets (
    ticket_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    historical_resolution TEXT,
    trust_level historical_trust_level_enum NOT NULL DEFAULT 'UNTRUSTED_HISTORICAL_NOTE'
);
```

---

### Q7.9: Generated Column for Delay Calculation Indexing
```sql
ALTER TABLE orders 
ADD COLUMN delay_minutes INT 
GENERATED ALWAYS AS (
    CASE 
        WHEN actual_pickup_at IS NOT NULL THEN 
            GREATEST(0, EXTRACT(EPOCH FROM (actual_pickup_at - pickup_window_end)) / 60)
        ELSE NULL
    END
) STORED;

CREATE INDEX idx_orders_carrier_fault_delay 
ON orders (carrier, delay_minutes) 
WHERE carrier_fault = TRUE;
```

---

### Q7.10: Migration Strategy: Splitting Single `fee` into Base & Ledger
1. Create `orders.base_fee_inr`.
2. Copy `orders.fee_inr` $\to$ `orders.base_fee_inr`.
3. Backfill delivered orders (`ORD-4001`) with zero adjustment records.
4. Deploy code reading `base_fee_inr` and dynamically computing `net_fee` via ledger join.

---

# 8. Unit Testing, Mocking & Test-Driven Development (TDD)

### Q8.1: Pytest Unit Test for `NorthstarCreditStrategy` Boundary Conditions
```python
import pytest

def test_northstar_credit_boundary_at_exactly_two_hours():
    strategy = NorthstarCreditStrategy()
    # Boundary: Exactly 2.0h -> 100% Credit
    result = strategy.calculate_credit(delay_hours=2.0, is_carrier_fault=True, base_fee_inr=4200)
    assert result['credit_percent'] == 100
    assert result['credit_amount_inr'] == 4200

def test_northstar_credit_boundary_one_minute_under():
    strategy = NorthstarCreditStrategy()
    # Boundary: 1.983h (1h 59m) -> 0% Credit
    result = strategy.calculate_credit(delay_hours=1.983, is_carrier_fault=True, base_fee_inr=4200)
    assert result['credit_percent'] == 0
    assert result['credit_amount_inr'] == 0
```

---

### Q8.2: Mocking LLM Tool Calls in Isolated Test Harness
```typescript
describe('SLA Assistant Tool Dispatcher', () => {
  it('should evaluate Northstar cancellation without hitting PDF service', async () => {
    const mockContractService = {
      getClause: jest.fn().mockResolvedValue({
        clauseId: 'Clause 4.1',
        waiverThresholdHours: 2.0,
        feeIfViolated: 4200
      })
    };

    const fee = await evaluateCancellationFee('ORD-1001', 2.5, mockContractService);
    expect(fee).toBe(0);
    expect(mockContractService.getClause).toHaveBeenCalledWith('ACCT-001', 'CANCELLATION');
  });
});
```

---

### Q8.3: Deterministic Temporal Delay Unit Test (Mocking Clock)
```python
from datetime import datetime, timezone, timedelta

def test_delay_calculator_anchored_to_snapshot():
    # Fixed Simulation Anchor: 2026-08-16 11:00 IST (+05:30)
    snapshot_time = datetime(2026, 8, 16, 11, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    pickup_window_end = datetime(2026, 8, 16, 6, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    
    delay_hours = compute_elapsed_delay(pickup_window_end, actual_pickup=None, reference_clock=snapshot_time)
    assert delay_hours == 4.5 # Exactly 4 hours and 30 minutes
```

---

### Q8.4: Edge-Case Test Matrix
```python
@pytest.mark.parametrize("pickup_end, actual_pickup, expected_delay", [
    ("10:00", "10:00", 0.0),   # On time
    ("10:00", "09:45", 0.0),   # Early pickup (negative raw diff clamped to 0)
    ("2028-02-29 23:00", "2028-03-01 01:00", 2.0) # Leap year boundary
])
def test_delay_edge_cases(pickup_end, actual_pickup, expected_delay):
    assert compute_delay(pickup_end, actual_pickup) == expected_delay
```

---

### Q8.5: TDD Test-First Spec for Idempotency
```python
def test_issue_credit_idempotency_prevents_duplicate_rows(db_session):
    key = "IDEM_TEST_KEY_9981"
    # First call
    res1 = issue_credit(order_id="ORD-2002", amount_inr=1200, idempotency_key=key, db_conn=db_session)
    assert res1['status'] == 'COMMITTED'

    # Duplicate call with identical key
    res2 = issue_credit(order_id="ORD-2002", amount_inr=1200, idempotency_key=key, db_conn=db_session)
    assert res2['status'] == 'COMMITTED'
    assert res2['tx_hash'] == res1['tx_hash']

    # Assert exactly 1 row exists in database
    count = db_session.execute("SELECT COUNT(*) FROM ledger_transactions WHERE order_id = 'ORD-2002'").scalar()
    assert count == 1
```

---

### Q8.6: Mock AccountRepository for Axis Labs Fallback
```typescript
const mockAccountRepo: AccountRepository = {
  findById: jest.fn().mockImplementation(async (id: string) => {
    if (id === 'ACCT-004') return { id: 'ACCT-004', plan: 'Enterprise', customContractFile: null };
    return null;
  }),
  findByCSM: jest.fn(),
  save: jest.fn()
};

test('Axis Labs falls back to Tier 2 standard enterprise policy', async () => {
  const service = new SLAEvaluationService(mockAccountRepo);
  const result = await service.evaluate('ACCT-004', 'ORD-4001');
  expect(result.governingTier).toBe('TIER_2_STANDARD_SOP');
});
```

---

### Q8.7: Testing `InvalidStateTransitionError` & Observer Firing
```typescript
test('DELIVERED -> BOOKED throws InvalidStateTransitionError', () => {
  const order = new StatefulOrder('ORD-1', 'ACCT-1', 1000);
  order.markPickedUp(new Date());
  order.markDelivered(new Date());

  expect(() => order.markPickedUp(new Date())).toThrow(InvalidStateTransitionError);
});

test('BOOKED -> PICKED_UP notifies registered observer', async () => {
  const order = new StatefulOrder('ORD-1', 'ACCT-1', 1000);
  const observerMock = { onOrderStateChanged: jest.fn() };
  order.attach(observerMock);

  order.markPickedUp(new Date());
  expect(observerMock.onOrderStateChanged).toHaveBeenCalledWith(expect.objectContaining({ newState: 'PICKED_UP' }));
});
```

---

### Q8.8: Concurrency Race-Condition Integration Test
```python
import concurrent.futures

def test_concurrent_mutation_approvals_only_one_succeeds():
    mutation_id = "STG-CONCURRENT-99"
    approver_1 = "OPERATOR_PRIYA"
    approver_2 = "OPERATOR_ROHIT"

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(approve_mutation, mutation_id, approver_1)
        f2 = executor.submit(approve_mutation, mutation_id, approver_2)
        results = [f1.result(), f2.result()]

    successes = [r for r in results if r['status'] == 'COMMITTED']
    conflicts = [r for r in results if r['status'] == 'CONFLICT']

    assert len(successes) == 1
    assert len(conflicts) == 1
```

---

### Q8.9: Unit Test for `actual_pickup_at IS NULL`
```python
def test_unpicked_order_delay_relative_to_now():
    # ORD-2002: Window ended 06:30, Pickup is None, Now is 11:00 -> 4.5h delay
    delay = calculate_delay(window_end="06:30", actual_pickup=None, now="11:00")
    assert delay == 4.5
    assert not math.isnan(delay)
```

---

### Q8.10: Snapshot Golden Test Asserting Rejection of Untrusted `TKT-450`
```typescript
test('TKT-450 golden resolution asserts 0 fee instead of fabricated 250 fee', async () => {
  const result = await runResolutionPipeline('TKT-450');
  
  // Assert pipe output DOES NOT match historical untrusted fee
  expect(result.calculatedFeeINR).not.toBe(250);
  
  // Assert pipe output DOES match legal Northstar Clause 4.1 ($0.00 fee waiver)
  expect(result.calculatedFeeINR).toBe(0.00);
  expect(result.governingCitation).toContain('Clause 4.1');
});
```

---

*(This architectural software engineering blueprint is permanently saved in the repository root at `/PARCELPILOT_SOFTWARE_ENGINEERING_AND_CODE_PATTERNS.md`.)*
