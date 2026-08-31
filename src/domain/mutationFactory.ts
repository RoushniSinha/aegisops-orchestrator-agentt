import { AccountId, StagedStateAction } from '../types';
import { FinancialCapExceededError } from './errors';

export type MutationType = 'ISSUE_SERVICE_CREDIT' | 'CANCEL_SHIPMENT' | 'ESCALATE_TICKET' | 'WAIVE_CANCELLATION_FEE';

export interface StagedMutation {
  readonly id: string;
  readonly type: MutationType;
  readonly targetId: string;
  readonly accountId: AccountId;
  readonly tierLevel: string;
  readonly documentName: string;
  readonly citation: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string;

  validateInvariants(): void;
  getFinancialImpactUSD(): number;
  getFinancialImpactINR(): number;
  toStagedStateAction(): StagedStateAction;
}

/**
 * Concrete Staged Mutation for Service Credits (Carrier Delays)
 */
export class CreditMutation implements StagedMutation {
  public readonly id: string;
  public readonly type: MutationType = 'ISSUE_SERVICE_CREDIT';
  public readonly createdAt: string;
  public readonly expiresAt: string;

  constructor(
    public readonly targetId: string,
    public readonly accountId: AccountId,
    public readonly amountUSD: number,
    public readonly amountINR: number,
    public readonly percentage: number,
    public readonly tierLevel: string,
    public readonly documentName: string,
    public readonly citation: string,
    public readonly reason: string,
    public readonly monthlyCapUSD: number,
    public readonly monthlyUsedUSD: number,
    ttlMinutes: number = 15
  ) {
    this.id = `STG-CRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
  }

  public validateInvariants(): void {
    if (this.amountUSD < 0 || this.amountINR < 0) {
      throw new Error(`Credit mutation amount cannot be negative: USD=${this.amountUSD}, INR=${this.amountINR}`);
    }
    if (this.percentage <= 0 || this.percentage > 100) {
      throw new Error(`Invalid credit percentage: ${this.percentage}%. Must be in range (0, 100].`);
    }
    if (this.monthlyUsedUSD + this.amountUSD > this.monthlyCapUSD) {
      throw new FinancialCapExceededError(
        this.accountId,
        this.monthlyCapUSD,
        this.monthlyUsedUSD,
        this.amountUSD
      );
    }
  }

  public getFinancialImpactUSD(): number {
    return this.amountUSD;
  }

  public getFinancialImpactINR(): number {
    return this.amountINR;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validateInvariants();
    return {
      id: this.id,
      action_type: 'ISSUE_SERVICE_CREDIT',
      target_id: this.targetId,
      account_id: this.accountId,
      amountUSD: this.amountUSD,
      amountINR: this.amountINR,
      percentage: this.percentage,
      tierLevel: this.tierLevel,
      citation: this.citation,
      documentName: this.documentName,
      reason: this.reason,
      status: 'PENDING_CONFIRMATION',
      timestamp: this.createdAt,
    };
  }
}

/**
 * Concrete Staged Mutation for Order Cancellations & Fee Waivers
 */
export class CancellationMutation implements StagedMutation {
  public readonly id: string;
  public readonly type: MutationType = 'CANCEL_SHIPMENT';
  public readonly createdAt: string;
  public readonly expiresAt: string;

  constructor(
    public readonly targetId: string,
    public readonly accountId: AccountId,
    public readonly cancellationFeeUSD: number,
    public readonly cancellationFeeINR: number,
    public readonly isFeeWaived: boolean,
    public readonly leadNoticeHours: number | null,
    public readonly tierLevel: string,
    public readonly documentName: string,
    public readonly citation: string,
    public readonly reason: string,
    ttlMinutes: number = 15
  ) {
    this.id = `STG-CNC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
  }

  public validateInvariants(): void {
    if (this.cancellationFeeUSD < 0 || this.cancellationFeeINR < 0) {
      throw new Error(`Cancellation fee cannot be negative.`);
    }
    if (this.isFeeWaived && (this.cancellationFeeUSD > 0 || this.cancellationFeeINR > 0)) {
      throw new Error(`Inconsistent mutation: Fee is marked waived but non-zero fee was specified.`);
    }
  }

  public getFinancialImpactUSD(): number {
    return this.cancellationFeeUSD;
  }

  public getFinancialImpactINR(): number {
    return this.cancellationFeeINR;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validateInvariants();
    return {
      id: this.id,
      action_type: 'CANCEL_SHIPMENT',
      target_id: this.targetId,
      account_id: this.accountId,
      cancellation_fee_USD: this.cancellationFeeUSD,
      cancellation_fee_INR: this.cancellationFeeINR,
      tierLevel: this.tierLevel,
      citation: this.citation,
      documentName: this.documentName,
      reason: this.reason,
      status: 'PENDING_CONFIRMATION',
      timestamp: this.createdAt,
    };
  }
}

/**
 * Concrete Staged Mutation for Critical Ticket Escalations
 */
export class EscalationMutation implements StagedMutation {
  public readonly id: string;
  public readonly type: MutationType = 'ESCALATE_TICKET';
  public readonly createdAt: string;
  public readonly expiresAt: string;

  constructor(
    public readonly targetId: string,
    public readonly accountId: AccountId,
    public readonly tierLevel: string,
    public readonly documentName: string,
    public readonly citation: string,
    public readonly reason: string,
    ttlMinutes: number = 15
  ) {
    this.id = `STG-ESC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
  }

  public validateInvariants(): void {
    if (!this.targetId || !this.targetId.startsWith('TKT-') && !this.targetId.startsWith('TCK-')) {
      throw new Error(`Escalation mutation target must be a valid ticket identifier, got '${this.targetId}'`);
    }
  }

  public getFinancialImpactUSD(): number {
    return 0;
  }

  public getFinancialImpactINR(): number {
    return 0;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validateInvariants();
    return {
      id: this.id,
      action_type: 'ESCALATE_TICKET',
      target_id: this.targetId,
      account_id: this.accountId,
      tierLevel: this.tierLevel,
      citation: this.citation,
      documentName: this.documentName,
      reason: this.reason,
      status: 'PENDING_CONFIRMATION',
      timestamp: this.createdAt,
    };
  }
}

/**
 * MutationFactory: Centralized factory providing type-safe instantiation and invariant enforcement
 */
export class MutationFactory {
  /**
   * Factory method for Service Credit staged action
   */
  public static createCreditMutation(params: {
    targetOrderId: string;
    accountId: AccountId;
    amountUSD: number;
    amountINR: number;
    percentage: number;
    tierLevel: string;
    documentName: string;
    citation: string;
    reason: string;
    monthlyCapUSD?: number;
    monthlyUsedUSD?: number;
    ttlMinutes?: number;
  }): CreditMutation {
    const mutation = new CreditMutation(
      params.targetOrderId,
      params.accountId,
      params.amountUSD,
      params.amountINR,
      params.percentage,
      params.tierLevel,
      params.documentName,
      params.citation,
      params.reason,
      params.monthlyCapUSD ?? 100000,
      params.monthlyUsedUSD ?? 0,
      params.ttlMinutes ?? 15
    );
    mutation.validateInvariants();
    return mutation;
  }

  /**
   * Factory method for Cancellation staged action
   */
  public static createCancellationMutation(params: {
    targetOrderId: string;
    accountId: AccountId;
    cancellationFeeUSD: number;
    cancellationFeeINR: number;
    isFeeWaived: boolean;
    leadNoticeHours: number | null;
    tierLevel: string;
    documentName: string;
    citation: string;
    reason: string;
    ttlMinutes?: number;
  }): CancellationMutation {
    const mutation = new CancellationMutation(
      params.targetOrderId,
      params.accountId,
      params.cancellationFeeUSD,
      params.cancellationFeeINR,
      params.isFeeWaived,
      params.leadNoticeHours,
      params.tierLevel,
      params.documentName,
      params.citation,
      params.reason,
      params.ttlMinutes ?? 15
    );
    mutation.validateInvariants();
    return mutation;
  }

  /**
   * Factory method for Ticket Escalation staged action
   */
  public static createEscalationMutation(params: {
    targetTicketId: string;
    accountId: AccountId;
    tierLevel: string;
    documentName: string;
    citation: string;
    reason: string;
    ttlMinutes?: number;
  }): EscalationMutation {
    const mutation = new EscalationMutation(
      params.targetTicketId,
      params.accountId,
      params.tierLevel,
      params.documentName,
      params.citation,
      params.reason,
      params.ttlMinutes ?? 15
    );
    mutation.validateInvariants();
    return mutation;
  }
}
