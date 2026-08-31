/**
 * ParcelPilot Domain Exception Hierarchy
 * Standardizes failure modes, telemetry inconsistencies, and security boundaries across the Agent Orchestrator.
 */

export interface ErrorContext {
  [key: string]: any;
}

export abstract class ParcelPilotError extends Error {
  public abstract readonly errorCode: string;
  public abstract readonly statusCode: number;
  public readonly timestamp: string;
  public readonly context: ErrorContext;
  public readonly isRecoverable: boolean;

  constructor(message: string, context: ErrorContext = {}, isRecoverable = false) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.isRecoverable = isRecoverable;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Formats the exception into an agent-friendly structured JSON payload.
   */
  public toAgentPayload() {
    return {
      success: false,
      error_type: this.name,
      error_code: this.errorCode,
      status_code: this.statusCode,
      message: this.message,
      recoverable: this.isRecoverable,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

/**
 * Thrown when a customer tries to read or mutate resources belonging to another tenant.
 */
export class TenantAuthorizationError extends ParcelPilotError {
  public readonly errorCode = 'RBAC_TENANT_ISOLATION_VIOLATION';
  public readonly statusCode = 403;

  constructor(attemptedTenantId: string, sessionTenantId: string, resourceId: string) {
    super(
      `Cross-tenant isolation violation: Active session tenant '${sessionTenantId}' is not authorized to access resource '${resourceId}' owned by '${attemptedTenantId}'.`,
      { attemptedTenantId, sessionTenantId, resourceId },
      false
    );
  }
}

/**
 * Thrown when an operator attempts to confirm a staged action after its validity window (e.g. 15 mins) has elapsed.
 */
export class StagedActionExpiredException extends ParcelPilotError {
  public readonly errorCode = 'STAGED_ACTION_EXPIRED';
  public readonly statusCode = 410; // HTTP 410 Gone

  constructor(actionId: string, expiresAt: string) {
    super(
      `Staged mutation '${actionId}' has expired (expiry was at ${expiresAt}). Re-evaluation required before execution.`,
      { actionId, expiresAt },
      true // Recoverable by triggering a fresh policy evaluation
    );
  }
}

/**
 * Thrown when an order state transition violates the State Machine (e.g. DELIVERED -> BOOKED).
 */
export class InvalidStateTransitionError extends ParcelPilotError {
  public readonly errorCode = 'ILLEGAL_STATE_TRANSITION';
  public readonly statusCode = 400;

  constructor(orderId: string, fromStatus: string, toStatus: string, reason?: string) {
    super(
      `Illegal state transition on order '${orderId}': Cannot transition from '${fromStatus}' to '${toStatus}'. ${reason || 'Transition prohibited by entity lifecycle.'}`,
      { orderId, fromStatus, toStatus, reason },
      false
    );
  }
}

/**
 * Thrown when a carrier delay does not meet the contractual minimum hours for a service credit.
 */
export class CarrierThresholdBreachError extends ParcelPilotError {
  public readonly errorCode = 'CARRIER_SLA_THRESHOLD_NOT_MET';
  public readonly statusCode = 422;

  constructor(orderId: string, delayHours: number, requiredThreshold: number, carrier: string) {
    super(
      `Order '${orderId}' with delay of ${delayHours.toFixed(1)}h does not meet contractual threshold of ${requiredThreshold.toFixed(1)}h for carrier '${carrier}'.`,
      { orderId, delayHours, requiredThreshold, carrier },
      false
    );
  }
}

/**
 * Thrown when physical carrier telemetry / driver scan conflicts with recorded database state (e.g. TKT-504 webhook delay).
 */
export class WebhookDelayInconsistencyError extends ParcelPilotError {
  public readonly errorCode = 'WEBHOOK_TELEMETRY_INCONSISTENCY';
  public readonly statusCode = 409;

  constructor(orderId: string, dbStatus: string, driverScanEvent: string, eventTimestamp: string) {
    super(
      `Telemetry inconsistency detected on '${orderId}': Driver event '${driverScanEvent}' recorded at ${eventTimestamp}, but system status is '${dbStatus}' (carrier webhook delay).`,
      { orderId, dbStatus, driverScanEvent, eventTimestamp, recommendedAction: 'FORCE_TELEMETRY_RECONCILIATION' },
      true
    );
  }
}

/**
 * Thrown when an agent or user invokes deprecated Tier 3 policies (e.g. Support Policy v2).
 */
export class ContractPrecedenceViolationError extends ParcelPilotError {
  public readonly errorCode = 'DEPRECATED_POLICY_INVOCATION_BANNED';
  public readonly statusCode = 400;

  constructor(documentCited: string, attemptedTier: string) {
    super(
      `Precedence violation: Document '${documentCited}' belongs to deprecated '${attemptedTier}'. Only Tier 1 (Enterprise Agreements) and Tier 2 (Current SOP v4) may govern binding decisions.`,
      { documentCited, attemptedTier },
      false
    );
  }
}

/**
 * Thrown when a proposed credit exceeds the account's monthly credit allowance.
 */
export class FinancialCapExceededError extends ParcelPilotError {
  public readonly errorCode = 'MONTHLY_CREDIT_CAP_EXCEEDED';
  public readonly statusCode = 422;

  constructor(accountId: string, monthlyCap: number, currentUsed: number, proposedDelta: number) {
    super(
      `Financial cap breach on account '${accountId}': Monthly cap is $${monthlyCap}, already utilized $${currentUsed}. Proposed credit of $${proposedDelta} exceeds remaining cap of $${monthlyCap - currentUsed}.`,
      { accountId, monthlyCap, currentUsed, proposedDelta, remainingCap: monthlyCap - currentUsed },
      false
    );
  }
}

/**
 * Thrown when a requested contract clause topic cannot be resolved.
 */
export class ContractClauseNotFoundError extends ParcelPilotError {
  public readonly errorCode = 'CONTRACT_CLAUSE_NOT_FOUND';
  public readonly statusCode = 404;

  constructor(accountId: string, topic: string) {
    super(
      `No binding contract clause found for account '${accountId}' matching topic '${topic}'.`,
      { accountId, topic },
      false
    );
  }
}

/**
 * Thrown when incoming tool arguments fail JSON schema validation or attempt prompt injection.
 */
export class SchemaValidationError extends ParcelPilotError {
  public readonly errorCode = 'TOOL_SCHEMA_VALIDATION_FAILED';
  public readonly statusCode = 400;

  constructor(toolName: string, validationErrors: string[]) {
    super(
      `Schema validation failed for tool '${toolName}': ${validationErrors.join(', ')}`,
      { toolName, validationErrors },
      false
    );
  }
}
