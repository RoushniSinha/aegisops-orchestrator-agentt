import { Order, AccountId } from '../types';
import { InvalidStateTransitionError, WebhookDelayInconsistencyError } from '../errors/ParcelPilotErrors';

export type OrderLifecycleStatus = 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELAYED' | 'DELIVERED' | 'CANCELLED';

export interface TelemetryScanEvent {
  eventId: string;
  eventType: 'DRIVER_ASSIGNED' | 'DRIVER_PICKED_UP' | 'HUB_SCAN' | 'OUT_FOR_DELIVERY' | 'DELIVERED_POD';
  timestamp: string;
  carrier: string;
  location?: string;
  notes?: string;
}

export interface InconsistencyAuditResult {
  hasInconsistency: boolean;
  code?: 'WEBHOOK_DELAY_PICKUP_UNRECORDED' | 'POD_DELIVERED_STATUS_LAG' | 'TELEMETRY_STATUS_MISMATCH';
  details?: string;
  recommendedState?: OrderLifecycleStatus;
  driverScanTimestamp?: string;
}

export interface IOrderState {
  readonly status: OrderLifecycleStatus;
  readonly legacyName: 'Scheduled' | 'In Transit' | 'Delayed' | 'Delivered' | 'Cancelled';
  canCancel(): boolean;
  canIssueCredit(): boolean;
  transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void;
  validateTelemetryGuard?(events: TelemetryScanEvent[]): InconsistencyAuditResult;
}

export type OrderState = IOrderState;

/**
 * State: BOOKED (Scheduled)
 * Order is created and awaiting driver arrival. Eligible for cancellation.
 */
export class BookedState implements IOrderState {
  public readonly status: OrderLifecycleStatus = 'BOOKED';
  public readonly legacyName = 'Scheduled';

  public canCancel(): boolean {
    return true; // Cancellations permitted prior to physical driver collection
  }

  public canIssueCredit(): boolean {
    return false; // Delay credits require active transit or missed pickup certification
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'PICKED_UP' || target === 'IN_TRANSIT' || target === 'DELAYED' || target === 'CANCELLED') {
      order.setState(OrderAggregate.resolveStateInstance(target));
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
    const podScan = events.find(e => e.eventType === 'DELIVERED_POD');
    if (podScan) {
      return {
        hasInconsistency: true,
        code: 'POD_DELIVERED_STATUS_LAG',
        details: `Proof of delivery signed at ${podScan.timestamp}, but system is still in 'BOOKED' status.`,
        recommendedState: 'DELIVERED',
        driverScanTimestamp: podScan.timestamp,
      };
    }
    return { hasInconsistency: false };
  }
}

/**
 * State: PICKED_UP
 * Package collected by carrier driver. Cannot be cancelled.
 */
export class PickedUpState implements IOrderState {
  public readonly status: OrderLifecycleStatus = 'PICKED_UP';
  public readonly legacyName = 'In Transit';

  public canCancel(): boolean {
    return false; // Physical goods in carrier custody; cancellation prohibited
  }

  public canIssueCredit(): boolean {
    return true;
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'IN_TRANSIT' || target === 'DELAYED' || target === 'DELIVERED') {
      order.setState(OrderAggregate.resolveStateInstance(target));
    } else {
      throw new InvalidStateTransitionError(
        order.id,
        this.status,
        target,
        `Cannot cancel or revert order once driver has confirmed pickup.`
      );
    }
  }

  public validateTelemetryGuard(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    const podScan = events.find(e => e.eventType === 'DELIVERED_POD');
    if (podScan) {
      return {
        hasInconsistency: true,
        code: 'POD_DELIVERED_STATUS_LAG',
        details: `Proof of delivery signed at ${podScan.timestamp}, but system status is 'PICKED_UP'.`,
        recommendedState: 'DELIVERED',
        driverScanTimestamp: podScan.timestamp,
      };
    }
    return { hasInconsistency: false };
  }
}

/**
 * State: IN_TRANSIT
 * Shipment moving through sorting hubs or out for delivery.
 */
export class InTransitState implements IOrderState {
  public readonly status: OrderLifecycleStatus = 'IN_TRANSIT';
  public readonly legacyName = 'In Transit';

  public canCancel(): boolean {
    return false;
  }

  public canIssueCredit(): boolean {
    return true;
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'DELAYED' || target === 'DELIVERED') {
      order.setState(OrderAggregate.resolveStateInstance(target));
    } else {
      throw new InvalidStateTransitionError(
        order.id,
        this.status,
        target,
        `Active in-transit shipments can only transition to DELAYED or DELIVERED.`
      );
    }
  }

  public validateTelemetryGuard(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    const podScan = events.find(e => e.eventType === 'DELIVERED_POD');
    if (podScan) {
      return {
        hasInconsistency: true,
        code: 'POD_DELIVERED_STATUS_LAG',
        details: `Proof of delivery signed at ${podScan.timestamp}, but system status is 'IN_TRANSIT'.`,
        recommendedState: 'DELIVERED',
        driverScanTimestamp: podScan.timestamp,
      };
    }
    return { hasInconsistency: false };
  }
}

/**
 * State: DELAYED
 * Shipment breached delivery/pickup window due to carrier or operational factors.
 */
export class DelayedState implements IOrderState {
  public readonly status: OrderLifecycleStatus = 'DELAYED';
  public readonly legacyName = 'Delayed';

  public canCancel(): boolean {
    return false;
  }

  public canIssueCredit(): boolean {
    return true; // Primary state for SLA credit calculation
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    if (target === 'IN_TRANSIT' || target === 'DELIVERED') {
      order.setState(OrderAggregate.resolveStateInstance(target));
    } else {
      throw new InvalidStateTransitionError(
        order.id,
        this.status,
        target,
        `Delayed orders can only proceed to active in-transit recovery or final delivery.`
      );
    }
  }

  public validateTelemetryGuard(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    const podScan = events.find(e => e.eventType === 'DELIVERED_POD');
    if (podScan) {
      return {
        hasInconsistency: true,
        code: 'POD_DELIVERED_STATUS_LAG',
        details: `Proof of delivery signed at ${podScan.timestamp}, but system status is 'DELAYED'.`,
        recommendedState: 'DELIVERED',
        driverScanTimestamp: podScan.timestamp,
      };
    }
    return { hasInconsistency: false };
  }
}

/**
 * State: DELIVERED (Terminal)
 * Goods successfully delivered and signed.
 */
export class DeliveredState implements IOrderState {
  public readonly status: OrderLifecycleStatus = 'DELIVERED';
  public readonly legacyName = 'Delivered';

  public canCancel(): boolean {
    return false;
  }

  public canIssueCredit(): boolean {
    return true; // Post-delivery SLA audits are permitted
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    throw new InvalidStateTransitionError(
      order.id,
      this.status,
      target,
      `DELIVERED is an immutable terminal state. Reverting to '${target}' is strictly forbidden.`
    );
  }

  public validateTelemetryGuard(_events: TelemetryScanEvent[]): InconsistencyAuditResult {
    return { hasInconsistency: false };
  }
}

/**
 * State: CANCELLED (Terminal)
 * Order cancelled prior to pickup with or without fee.
 */
export class CancelledState implements IOrderState {
  public readonly status: OrderLifecycleStatus = 'CANCELLED';
  public readonly legacyName = 'Cancelled';

  public canCancel(): boolean {
    return false;
  }

  public canIssueCredit(): boolean {
    return false;
  }

  public transitionTo(order: OrderAggregate, target: OrderLifecycleStatus, reason?: string): void {
    throw new InvalidStateTransitionError(
      order.id,
      this.status,
      target,
      `CANCELLED is an immutable terminal state. Cannot transition back to '${target}'.`
    );
  }

  public validateTelemetryGuard(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    const podScan = events.find(e => e.eventType === 'DELIVERED_POD' || e.eventType === 'DRIVER_PICKED_UP');
    if (podScan) {
      return {
        hasInconsistency: true,
        code: 'TELEMETRY_STATUS_MISMATCH',
        details: `Physical event '${podScan.eventType}' detected at ${podScan.timestamp} for CANCELLED order.`,
      };
    }
    return { hasInconsistency: false };
  }
}

/**
 * OrderAggregate: Encapsulates state transition lifecycle, telemetry audits, and inconsistency detection.
 */
export class OrderAggregate {
  public readonly id: string;
  public readonly accountId: AccountId;
  public readonly carrier: string;
  public readonly serviceTier: string;
  public scheduledPickup: string | null;
  public scheduledDelivery: string | null;
  public actualDelivery?: string | null;
  public carrierFault: boolean;
  public rootCause: string | null;
  public costUSD: number;
  public costINR: number;
  public origin: string;
  public destination: string;

  private currentState: IOrderState;

  constructor(order: Order) {
    this.id = order.order_id;
    this.accountId = order.account_id;
    this.carrier = order.carrier;
    this.serviceTier = order.service_tier;
    this.scheduledPickup = order.scheduled_pickup;
    this.scheduledDelivery = order.scheduled_delivery;
    this.actualDelivery = order.actual_delivery;
    this.carrierFault = order.carrier_fault;
    this.rootCause = order.root_cause;
    this.costUSD = order.costUSD;
    this.costINR = order.costINR;
    this.origin = order.origin;
    this.destination = order.destination;
    this.currentState = OrderAggregate.resolveStateInstance(order.status);
  }

  public static resolveStateInstance(status: string): IOrderState {
    const normalized = status.toUpperCase().replace(/\s+/g, '_');
    switch (normalized) {
      case 'BOOKED':
      case 'SCHEDULED':
        return new BookedState();
      case 'PICKED_UP':
        return new PickedUpState();
      case 'IN_TRANSIT':
        return new InTransitState();
      case 'DELAYED':
        return new DelayedState();
      case 'DELIVERED':
        return new DeliveredState();
      case 'CANCELLED':
        return new CancelledState();
      default:
        return new BookedState();
    }
  }

  public getStatus(): OrderLifecycleStatus {
    return this.currentState.status;
  }

  public getLegacyStatus(): 'Scheduled' | 'In Transit' | 'Delayed' | 'Delivered' | 'Cancelled' {
    return this.currentState.legacyName;
  }

  public setState(state: IOrderState): void {
    this.currentState = state;
  }

  public transitionTo(target: OrderLifecycleStatus, reason?: string): void {
    this.currentState.transitionTo(this, target, reason);
  }

  public canCancel(): boolean {
    return this.currentState.canCancel();
  }

  public canIssueCredit(): boolean {
    return this.currentState.canIssueCredit();
  }

  /**
   * Guard Validation Hook: Detects and flags inconsistencies between database status
   * and driver hardware / POD scan telemetry events (e.g. TKT-504 webhook delay).
   */
  public validateTelemetryConsistency(events: TelemetryScanEvent[]): InconsistencyAuditResult {
    // Check 1: Driver pickup scan exists, but database is still BOOKED / Scheduled
    const pickupScan = events.find(e => e.eventType === 'DRIVER_PICKED_UP');
    if (pickupScan && this.currentState.status === 'BOOKED') {
      return {
        hasInconsistency: true,
        code: 'WEBHOOK_DELAY_PICKUP_UNRECORDED',
        details: `Driver hardware scan logged pickup at ${pickupScan.timestamp}, but system is currently in 'BOOKED' status (SwiftShip webhook ingestion delay BUG-1092).`,
        recommendedState: 'PICKED_UP',
        driverScanTimestamp: pickupScan.timestamp,
      };
    }

    // Check 2: Proof-of-Delivery scan exists, but status is not DELIVERED
    const podScan = events.find(e => e.eventType === 'DELIVERED_POD');
    if (podScan && this.currentState.status !== 'DELIVERED') {
      return {
        hasInconsistency: true,
        code: 'POD_DELIVERED_STATUS_LAG',
        details: `Proof of delivery signed at ${podScan.timestamp}, but system status is '${this.currentState.status}'.`,
        recommendedState: 'DELIVERED',
        driverScanTimestamp: podScan.timestamp,
      };
    }

    return { hasInconsistency: false };
  }

  /**
   * Reconciles delayed carrier webhook by forcing state forward to physical reality
   */
  public reconcileTelemetryLag(pickupTimestamp: string): void {
    if (this.currentState.status === 'BOOKED') {
      this.currentState.transitionTo(this, 'PICKED_UP', `Reconciled from driver hardware scan at ${pickupTimestamp}`);
    }
  }

  public toOrderDTO(): Order {
    return {
      order_id: this.id,
      account_id: this.accountId,
      carrier: this.carrier,
      service_tier: this.serviceTier,
      status: this.currentState.legacyName,
      scheduled_pickup: this.scheduledPickup,
      scheduled_delivery: this.scheduledDelivery,
      actual_delivery: this.actualDelivery,
      carrier_fault: this.carrierFault,
      root_cause: this.rootCause,
      costUSD: this.costUSD,
      costINR: this.costINR,
      origin: this.origin,
      destination: this.destination,
    };
  }
}
