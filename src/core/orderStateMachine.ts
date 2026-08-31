/**
 * Order State Machine & Two-Phase Commit State Types
 * ParcelPilot Autonomous Support & Operations Engine
 */

import { Order } from '../types';

export type OrderStatusType = 'Scheduled' | 'In Transit' | 'Delayed' | 'Delivered' | 'Cancelled';

export class InvalidStateTransitionError extends Error {
  constructor(orderId: string, current: string, target: string, reason?: string) {
    super(`Invalid state transition for ${orderId}: cannot transition from '${current}' to '${target}'. ${reason || ''}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export function canCancelOrder(order: Order): boolean {
  // Only Scheduled orders before physical pickup can be cancelled
  return order.status === 'Scheduled';
}

export function canIssueServiceCredit(order: Order): boolean {
  // Delayed or Delivered orders with certified carrier fault
  return (order.status === 'Delayed' || order.status === 'Delivered') && order.carrier_fault;
}
