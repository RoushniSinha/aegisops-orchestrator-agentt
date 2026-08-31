import { Order, AccountId, UserRole } from '../types';
import { loadOrders } from '../data/dataLoader';
import { TenantAuthorizationError } from '../errors/ParcelPilotErrors';
import { toolEngine, OrderLookupResult } from '../services/toolEngine';

export { toolEngine, type OrderLookupResult } from '../services/toolEngine';

/**
 * Normalizes account IDs for dual-format comparison (e.g. ACCT-001 vs ACC-NORTHSTAR)
 */
export function normalizeAccountId(id: string): string {
  if (!id) return '';
  const upper = id.trim().toUpperCase();
  if (upper === 'ACCT-001' || upper === 'ACC-NORTHSTAR') return 'ACC-NORTHSTAR';
  if (upper === 'ACCT-002' || upper === 'ACC-LUMENWORKS') return 'ACC-LUMENWORKS';
  if (upper === 'ACCT-003' || upper === 'ACC-BEACON') return 'ACC-BEACON';
  if (upper === 'ACCT-004' || upper === 'ACC-AXIS') return 'ACC-AXIS';
  return upper;
}

/**
 * Tool-layer RBAC Interceptor: lookupOrderData
 * 
 * Enforces strict multi-tenant data boundary isolation (Anti-Snooping / BOLA defense)
 * between Customer Portal and Internal Operations roles.
 *
 * @param orderId Target order identifier (e.g., 'ORD-1001')
 * @param sessionAccountId Active session tenant identifier (e.g., 'ACC-NORTHSTAR' or 'ACCT-001')
 * @param role Active user role ('customer' | 'internal_ops')
 * @param orders Optional order collection (defaults to resilient fixture orders)
 */
export function lookupOrderData(
  orderId: string,
  sessionAccountId: string,
  role: string,
  orders?: Order[]
): OrderLookupResult {
  const activeOrders = orders && orders.length > 0 ? orders : loadOrders();
  const cleanId = orderId ? orderId.trim().toUpperCase() : '';
  const rawOrder = activeOrders.find(o => o.order_id.toUpperCase() === cleanId);

  // 1. If order does not exist: Return generic "Order not found" error
  if (!rawOrder) {
    return {
      order_id: cleanId,
      account_id: (sessionAccountId as AccountId) || 'ACC-NORTHSTAR',
      account_name: 'Unknown',
      carrier: 'Unknown',
      service_tier: 'Unknown',
      status: 'Unknown',
      scheduled_delivery: null,
      scheduled_pickup: null,
      carrier_fault: false,
      root_cause: null,
      costUSD: 0,
      costINR: 0,
      calculated_delay_hours: 0,
      notice_hours_until_pickup: null,
      origin: 'Unknown',
      destination: 'Unknown',
      error: `Order '${cleanId}' not found in ParcelPilot operational ledger.`
    };
  }

  const normalizedOrderAccount = normalizeAccountId(rawOrder.account_id);
  const normalizedSessionAccount = normalizeAccountId(sessionAccountId);

  // 2. Anti-Snooping / BOLA Defense: Customer role cannot access cross-tenant records
  if (role === 'customer' && normalizedOrderAccount !== normalizedSessionAccount) {
    // ANTI-ENUMERATION HARDENING:
    // Zero target metadata disclosed (NO carrier names, NO routes, NO costs, NO actual account owner)
    const genericErrorMessage = 'Resource not accessible within your tenant scope.';
    const rbacError = new TenantAuthorizationError(
      sessionAccountId,
      cleanId,
      genericErrorMessage
    );

    return {
      order_id: cleanId,
      account_id: 'RESTRICTED' as any,
      account_name: 'RESTRICTED',
      carrier: 'RESTRICTED',
      service_tier: 'RESTRICTED',
      status: 'RESTRICTED',
      scheduled_delivery: null,
      scheduled_pickup: null,
      carrier_fault: false,
      root_cause: null,
      costUSD: 0,
      costINR: 0,
      calculated_delay_hours: 0,
      notice_hours_until_pickup: null,
      origin: 'RESTRICTED',
      destination: 'RESTRICTED',
      isRBACError: true,
      errorCode: rbacError.errorCode,
      session_account_id: sessionAccountId,
      error: genericErrorMessage
    };
  }

  // 3. Authorized tenant or internal_ops: Delegate to full policy & state machine inspection
  return toolEngine.lookup_order_data(
    cleanId,
    sessionAccountId as AccountId,
    role as UserRole,
    activeOrders
  );
}
