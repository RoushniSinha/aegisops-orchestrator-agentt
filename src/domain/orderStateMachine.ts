import { Order, AccountId } from '../types';
import { InvalidStateTransitionError, WebhookDelayInconsistencyError } from './errors';

export type OrderStatusType = 'Scheduled' | 'In Transit' | 'Delayed' | 'Delivered' | 'Cancelled';

export interface TelemetryEvent {
  eventId: string;
  eventType: 'DRIVER_ASSIGNED' | 'DRIVER_PICKED_UP' | 'HUB_SCAN' | 'OUT_FOR_DELIVERY' | 'DELIVERED_POD';
  timestamp: string;
  carrier: string;
  notes?: string;
}

export interface OrderState {
  readonly name: OrderStatusType;
  canCancel(): boolean;
  canIssueCredit(): boolean;
  transitionTo(order: OrderEntity, targetState: OrderStatusType, reason?: string): void;
}

export class ScheduledState implements OrderState {
  public readonly name: OrderStatusType = 'Scheduled';

  public canCancel(): boolean {
    return true; // Eligible for cancellation before physical pickup
  }

  public canIssueCredit(): boolean {
    return false; // Credit only applies after pickup window delay is certified
  }

  public transitionTo(order: OrderEntity, targetState: OrderStatusType, reason?: string): void {
    if (targetState === 'In Transit' || targetState === 'Delayed' || targetState === 'Cancelled') {
      order.setState(OrderEntity.createStateInstance(targetState));
    } else {
      throw new InvalidStateTransitionError(order.id, this.name, targetState, reason);
    }
  }
}

export class InTransitState implements OrderState {
  public readonly name: OrderStatusType = 'In Transit';

  public canCancel(): boolean {
    return false; // Cannot cancel after shipment has physically moved into transit
  }

  public canIssueCredit(): boolean {
    return true; // Eligible if carrier-fault delay manifests
  }

  public transitionTo(order: OrderEntity, targetState: OrderStatusType, reason?: string): void {
    if (targetState === 'Delayed' || targetState === 'Delivered') {
      order.setState(OrderEntity.createStateInstance(targetState));
    } else {
      throw new InvalidStateTransitionError(
        order.id,
        this.name,
        targetState,
        `Cannot cancel or reset order once driver has initiated transit.`
      );
    }
  }
}

export class DelayedState implements OrderState {
  public readonly name: OrderStatusType = 'Delayed';

  public canCancel(): boolean {
    return false;
  }

  public canIssueCredit(): boolean {
    return true; // Primary state for carrier fault SLA credit processing
  }

  public transitionTo(order: OrderEntity, targetState: OrderStatusType, reason?: string): void {
    if (targetState === 'In Transit' || targetState === 'Delivered') {
      order.setState(OrderEntity.createStateInstance(targetState));
    } else {
      throw new InvalidStateTransitionError(
        order.id,
        this.name,
        targetState,
        `Delayed orders can only proceed to in-transit or final delivery.`
      );
    }
  }
}

export class DeliveredState implements OrderState {
  public readonly name: OrderStatusType = 'Delivered';

  public canCancel(): boolean {
    return false; // Terminal state
  }

  public canIssueCredit(): boolean {
    return true; // Post-delivery SLA audit is allowed
  }

  public transitionTo(order: OrderEntity, targetState: OrderStatusType, reason?: string): void {
    // Terminal state: No transitions allowed
    throw new InvalidStateTransitionError(
      order.id,
      this.name,
      targetState,
      `Delivered is a terminal state. Prohibited from transitioning back to '${targetState}'.`
    );
  }
}

export class CancelledState implements OrderState {
  public readonly name: OrderStatusType = 'Cancelled';

  public canCancel(): boolean {
    return false;
  }

  public canIssueCredit(): boolean {
    return false;
  }

  public transitionTo(order: OrderEntity, targetState: OrderStatusType, reason?: string): void {
    // Terminal state: No transitions allowed
    throw new InvalidStateTransitionError(
      order.id,
      this.name,
      targetState,
      `Cancelled is a terminal state. Prohibited from transitioning back to '${targetState}'.`
    );
  }
}

/**
 * OrderEntity: Rich Domain Model wrapping state transitions and guard validation hooks
 */
export class OrderEntity {
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

  private state: OrderState;

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
    this.state = OrderEntity.createStateInstance(order.status);
  }

  public static createStateInstance(status: OrderStatusType | string): OrderState {
    switch (status) {
      case 'Scheduled':
      case 'BOOKED':
        return new ScheduledState();
      case 'In Transit':
      case 'PICKED_UP':
      case 'IN_TRANSIT':
        return new InTransitState();
      case 'Delayed':
      case 'DELAYED':
        return new DelayedState();
      case 'Delivered':
      case 'DELIVERED':
        return new DeliveredState();
      case 'Cancelled':
      case 'CANCELLED':
        return new CancelledState();
      default:
        return new ScheduledState();
    }
  }

  public getStatus(): OrderStatusType {
    return this.state.name;
  }

  public setState(newState: OrderState): void {
    this.state = newState;
  }

  public transitionTo(targetStatus: OrderStatusType, reason?: string): void {
    this.state.transitionTo(this, targetStatus, reason);
  }

  public canCancel(): boolean {
    return this.state.canCancel();
  }

  public canIssueCredit(): boolean {
    return this.state.canIssueCredit();
  }

  /**
   * Guard Validation Hook for Telemetry Inconsistency Detection (e.g. TKT-504 scenario)
   * Detects if physical driver telemetry contradicts the system's recorded state.
   */
  public auditTelemetryConsistency(driverEvents: TelemetryEvent[]): {
    isInconsistent: boolean;
    inconsistencyDetails?: string;
    recommendedRemediation?: string;
  } {
    const pickupEvent = driverEvents.find(e => e.eventType === 'DRIVER_PICKED_UP');
    
    // Inconsistency: Driver scanned pickup, but system still says Scheduled / Booked
    if (pickupEvent && this.state.name === 'Scheduled') {
      return {
        isInconsistent: true,
        inconsistencyDetails: `Driver collected package at ${pickupEvent.timestamp}, but system status is lagged at 'Scheduled' (Carrier Webhook Delay Issue).`,
        recommendedRemediation: `Auto-reconcile state to 'In Transit' and block customer cancellation requests.`,
      };
    }

    // Inconsistency: Driver marked Delivered, but status is not Delivered
    const deliveryEvent = driverEvents.find(e => e.eventType === 'DELIVERED_POD');
    if (deliveryEvent && this.state.name !== 'Delivered') {
      return {
        isInconsistent: true,
        inconsistencyDetails: `Proof-of-Delivery received at ${deliveryEvent.timestamp}, but status is '${this.state.name}'.`,
        recommendedRemediation: `Transition order to 'Delivered' terminal state.`,
      };
    }

    return { isInconsistent: false };
  }

  /**
   * Forces reconciliation when webhook delay is verified
   */
  public reconcileDriverScan(pickupTimestamp: string): void {
    if (this.state.name === 'Scheduled') {
      this.state.transitionTo(this, 'In Transit', `Reconciled from driver hardware scan at ${pickupTimestamp}`);
    }
  }

  public toOrderDTO(): Order {
    return {
      order_id: this.id,
      account_id: this.accountId,
      carrier: this.carrier,
      service_tier: this.serviceTier,
      status: this.state.name,
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
