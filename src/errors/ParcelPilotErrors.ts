/**
 * ParcelPilot Diagnostic Error Hierarchy
 * Standardizes failure modes, telemetry inconsistencies, tenant security, and lifecycle violations.
 */

export interface ErrorDiagnosticContext {
  [key: string]: any;
}

export abstract class ParcelPilotError extends Error {
  public abstract readonly errorCode: string;
  public abstract readonly statusCode: number;
  public readonly timestamp: string;
  public readonly context: ErrorDiagnosticContext;
  public readonly isRecoverable: boolean;

  constructor(message: string, context: ErrorDiagnosticContext = {}, isRecoverable = false) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.isRecoverable = isRecoverable;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toDiagnosticPayload() {
    return {
      success: false,
      error_class: this.name,
      error_code: this.errorCode,
      status_code: this.statusCode,
      message: this.message,
      recoverable: this.isRecoverable,
      timestamp: this.timestamp,
      diagnostic_context: this.context,
    };
  }
}

/**
 * Thrown when an RBAC isolation boundary is violated across tenants.
 * Hardened against resource enumeration attacks - never discloses target owner.
 */
export class TenantAuthorizationError extends ParcelPilotError {
  public readonly errorCode = 'RBAC_TENANT_ISOLATION_VIOLATION';
  public readonly statusCode = 403;

  constructor(sessionTenantId: string, resourceId: string, customMessage?: string) {
    super(
      customMessage || 'Resource not accessible within your tenant scope.',
      { sessionTenantId, resourceId, violationType: 'UNAUTHORIZED_CROSS_TENANT_ACCESS' },
      false
    );
  }
}

/**
 * Thrown when an operator attempts to confirm a staged action after its TTL (e.g. 15 minutes) has expired.
 */
export class StagedActionExpiredException extends ParcelPilotError {
  public readonly errorCode = 'STAGED_ACTION_EXPIRED';
  public readonly statusCode = 410; // HTTP 410 Gone

  constructor(actionId: string, expiresAt: string, elapsedMinutes?: number) {
    super(
      `Staged mutation '${actionId}' has expired (expired at ${expiresAt}). Re-evaluation required before state change.`,
      { actionId, expiresAt, elapsedMinutes, recommendedRemediation: 'RE_EVALUATE_POLICY' },
      true
    );
  }
}

/**
 * Thrown when an order state transition violates the entity lifecycle state machine.
 */
export class InvalidStateTransitionError extends ParcelPilotError {
  public readonly errorCode = 'ILLEGAL_STATE_TRANSITION';
  public readonly statusCode = 400;

  constructor(orderId: string, fromStatus: string, toStatus: string, diagnosticReason?: string) {
    super(
      `Illegal state transition on order '${orderId}': Cannot transition from '${fromStatus}' to '${toStatus}'. ${diagnosticReason || 'Transition prohibited by entity lifecycle.'}`,
      { orderId, fromStatus, toStatus, diagnosticReason },
      false
    );
  }
}

/**
 * Thrown when carrier delay does not meet the contractually required minimum SLA threshold.
 */
export class CarrierThresholdBreachError extends ParcelPilotError {
  public readonly errorCode = 'CARRIER_SLA_THRESHOLD_NOT_MET';
  public readonly statusCode = 422;

  constructor(orderId: string, delayHours: number, requiredThreshold: number, carrier: string) {
    super(
      `Order '${orderId}' delay of ${delayHours.toFixed(1)}h does not meet required contractual threshold of ${requiredThreshold.toFixed(1)}h for carrier '${carrier}'.`,
      { orderId, delayHours, requiredThreshold, carrier, shortfallHours: parseFloat((requiredThreshold - delayHours).toFixed(2)) },
      false
    );
  }
}

/**
 * Thrown when physical hardware telemetry / driver scan conflicts with database state (e.g. TKT-504 webhook lag).
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
 * Thrown when an agent or user invokes deprecated Tier 3 policies.
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
 * Thrown when a proposed financial credit exceeds the tenant's monthly credit limit.
 */
export class FinancialCapExceededError extends ParcelPilotError {
  public readonly errorCode = 'MONTHLY_CREDIT_CAP_EXCEEDED';
  public readonly statusCode = 422;

  constructor(accountId: string, monthlyCap: number, currentUsed: number, proposedDelta: number) {
    super(
      `Financial cap breach on account '${accountId}': Monthly cap is $${monthlyCap}, utilized $${currentUsed}. Proposed credit $${proposedDelta} exceeds remaining cap of $${monthlyCap - currentUsed}.`,
      { accountId, monthlyCap, currentUsed, proposedDelta, remainingCap: monthlyCap - currentUsed },
      false
    );
  }
}

/**
 * Thrown when schema validation fails on tool arguments.
 */
export class SchemaValidationError extends ParcelPilotError {
  public readonly errorCode = 'TOOL_SCHEMA_VALIDATION_FAILED';
  public readonly statusCode = 400;

  constructor(toolName: string, validationErrors: string[]) {
    super(
      `Schema validation failed for tool '${toolName}': ${validationErrors.join('; ')}`,
      { toolName, validationErrors },
      false
    );
  }
}
