import { AccountId, StagedStateAction } from '../types';
import { FinancialCapExceededError, StagedActionExpiredException } from '../errors/ParcelPilotErrors';

export type StagedMutationType = 'ISSUE_SERVICE_CREDIT' | 'CANCEL_SHIPMENT' | 'FEE_WAIVER' | 'ESCALATE_TICKET';

export interface BaseMutationData {
  targetId: string;
  accountId: AccountId;
  tierLevel: string;
  documentName: string;
  citation: string;
  reason: string;
  ttlMinutes?: number;
}

export interface CreditMutationData extends BaseMutationData {
  amountUSD: number;
  amountINR: number;
  percentage: number;
  monthlyCapUSD?: number;
  monthlyUsedUSD?: number;
}

export interface FeeWaiverMutationData extends BaseMutationData {
  originalFeeUSD: number;
  originalFeeINR: number;
  waivedFeeUSD: number;
  waivedFeeINR: number;
  noticeHours?: number | null;
}

export interface CancellationMutationData extends BaseMutationData {
  cancellationFeeUSD: number;
  cancellationFeeINR: number;
  isFeeWaived: boolean;
  leadNoticeHours?: number | null;
}

export interface EscalationMutationData extends BaseMutationData {
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface IStagedMutation {
  readonly id: string;
  readonly type: StagedMutationType;
  readonly targetId: string;
  readonly accountId: AccountId;
  readonly tierLevel: string;
  readonly documentName: string;
  readonly citation: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string;

  validate(): void;
  isExpired(): boolean;
  assertNotExpired(): void;
  getFinancialDeltaUSD(): number;
  toStagedStateAction(): StagedStateAction;
}

/**
 * Concrete Staged Mutation for Service Credits
 */
export class CreditMutation implements IStagedMutation {
  public readonly id: string;
  public readonly type: StagedMutationType = 'ISSUE_SERVICE_CREDIT';
  public readonly targetId: string;
  public readonly accountId: AccountId;
  public readonly amountUSD: number;
  public readonly amountINR: number;
  public readonly percentage: number;
  public readonly tierLevel: string;
  public readonly documentName: string;
  public readonly citation: string;
  public readonly reason: string;
  public readonly createdAt: string;
  public readonly expiresAt: string;
  public readonly monthlyCapUSD: number;
  public readonly monthlyUsedUSD: number;

  constructor(data: CreditMutationData) {
    this.id = `STG-CRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.targetId = data.targetId;
    this.accountId = data.accountId;
    this.amountUSD = data.amountUSD;
    this.amountINR = data.amountINR;
    this.percentage = data.percentage;
    this.tierLevel = data.tierLevel;
    this.documentName = data.documentName;
    this.citation = data.citation;
    this.reason = data.reason;
    this.monthlyCapUSD = data.monthlyCapUSD ?? 100000;
    this.monthlyUsedUSD = data.monthlyUsedUSD ?? 0;

    const ttl = data.ttlMinutes ?? 15;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttl * 60 * 1000).toISOString();
  }

  public validate(): void {
    if (this.amountUSD < 0 || this.amountINR < 0) {
      throw new Error(`Credit amounts must be non-negative. Received USD=${this.amountUSD}, INR=${this.amountINR}`);
    }
    if (this.percentage <= 0 || this.percentage > 100) {
      throw new Error(`Credit percentage must be within (0, 100]. Received ${this.percentage}%`);
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

  public isExpired(): boolean {
    return new Date().getTime() > new Date(this.expiresAt).getTime();
  }

  public assertNotExpired(): void {
    if (this.isExpired()) {
      throw new StagedActionExpiredException(this.id, this.expiresAt);
    }
  }

  public getFinancialDeltaUSD(): number {
    return this.amountUSD;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validate();
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
 * Concrete Staged Mutation for Cancellations & Fee Waivers
 */
export class CancellationMutation implements IStagedMutation {
  public readonly id: string;
  public readonly type: StagedMutationType = 'CANCEL_SHIPMENT';
  public readonly targetId: string;
  public readonly accountId: AccountId;
  public readonly cancellationFeeUSD: number;
  public readonly cancellationFeeINR: number;
  public readonly isFeeWaived: boolean;
  public readonly leadNoticeHours: number | null;
  public readonly tierLevel: string;
  public readonly documentName: string;
  public readonly citation: string;
  public readonly reason: string;
  public readonly createdAt: string;
  public readonly expiresAt: string;

  constructor(data: CancellationMutationData) {
    this.id = `STG-CNC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.targetId = data.targetId;
    this.accountId = data.accountId;
    this.cancellationFeeUSD = data.cancellationFeeUSD;
    this.cancellationFeeINR = data.cancellationFeeINR;
    this.isFeeWaived = data.isFeeWaived;
    this.leadNoticeHours = data.leadNoticeHours ?? null;
    this.tierLevel = data.tierLevel;
    this.documentName = data.documentName;
    this.citation = data.citation;
    this.reason = data.reason;

    const ttl = data.ttlMinutes ?? 15;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttl * 60 * 1000).toISOString();
  }

  public validate(): void {
    if (this.cancellationFeeUSD < 0 || this.cancellationFeeINR < 0) {
      throw new Error(`Cancellation fee cannot be negative.`);
    }
    if (this.isFeeWaived && (this.cancellationFeeUSD > 0 || this.cancellationFeeINR > 0)) {
      throw new Error(`Inconsistent mutation state: Fee is marked waived but non-zero fee was specified.`);
    }
  }

  public isExpired(): boolean {
    return new Date().getTime() > new Date(this.expiresAt).getTime();
  }

  public assertNotExpired(): void {
    if (this.isExpired()) {
      throw new StagedActionExpiredException(this.id, this.expiresAt);
    }
  }

  public getFinancialDeltaUSD(): number {
    return this.cancellationFeeUSD;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validate();
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
 * Concrete Staged Mutation for Fee Waivers
 */
export class FeeWaiverMutation implements IStagedMutation {
  public readonly id: string;
  public readonly type: StagedMutationType = 'FEE_WAIVER';
  public readonly targetId: string;
  public readonly accountId: AccountId;
  public readonly originalFeeUSD: number;
  public readonly originalFeeINR: number;
  public readonly waivedFeeUSD: number;
  public readonly waivedFeeINR: number;
  public readonly noticeHours: number | null;
  public readonly tierLevel: string;
  public readonly documentName: string;
  public readonly citation: string;
  public readonly reason: string;
  public readonly createdAt: string;
  public readonly expiresAt: string;

  constructor(data: FeeWaiverMutationData) {
    this.id = `STG-WVR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.targetId = data.targetId;
    this.accountId = data.accountId;
    this.originalFeeUSD = data.originalFeeUSD;
    this.originalFeeINR = data.originalFeeINR;
    this.waivedFeeUSD = data.waivedFeeUSD;
    this.waivedFeeINR = data.waivedFeeINR;
    this.noticeHours = data.noticeHours ?? null;
    this.tierLevel = data.tierLevel;
    this.documentName = data.documentName;
    this.citation = data.citation;
    this.reason = data.reason;

    const ttl = data.ttlMinutes ?? 15;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttl * 60 * 1000).toISOString();
  }

  public validate(): void {
    if (this.waivedFeeUSD < 0 || this.waivedFeeINR < 0) {
      throw new Error('Waived fee amounts must be non-negative.');
    }
  }

  public isExpired(): boolean {
    return new Date().getTime() > new Date(this.expiresAt).getTime();
  }

  public assertNotExpired(): void {
    if (this.isExpired()) {
      throw new StagedActionExpiredException(this.id, this.expiresAt);
    }
  }

  public getFinancialDeltaUSD(): number {
    return this.originalFeeUSD - this.waivedFeeUSD;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validate();
    return {
      id: this.id,
      action_type: 'CANCEL_SHIPMENT',
      target_id: this.targetId,
      account_id: this.accountId,
      cancellation_fee_USD: this.waivedFeeUSD,
      cancellation_fee_INR: this.waivedFeeINR,
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
 * Concrete Staged Mutation for Ticket Escalations
 */
export class EscalationMutation implements IStagedMutation {
  public readonly id: string;
  public readonly type: StagedMutationType = 'ESCALATE_TICKET';
  public readonly targetId: string;
  public readonly accountId: AccountId;
  public readonly tierLevel: string;
  public readonly documentName: string;
  public readonly citation: string;
  public readonly reason: string;
  public readonly createdAt: string;
  public readonly expiresAt: string;

  constructor(data: EscalationMutationData) {
    this.id = `STG-ESC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.targetId = data.targetId;
    this.accountId = data.accountId;
    this.tierLevel = data.tierLevel;
    this.documentName = data.documentName;
    this.citation = data.citation;
    this.reason = data.reason;

    const ttl = data.ttlMinutes ?? 15;
    const now = new Date();
    this.createdAt = now.toISOString();
    this.expiresAt = new Date(now.getTime() + ttl * 60 * 1000).toISOString();
  }

  public validate(): void {
    if (!this.targetId) {
      throw new Error(`Target ticket ID is required for escalation mutations.`);
    }
  }

  public isExpired(): boolean {
    return new Date().getTime() > new Date(this.expiresAt).getTime();
  }

  public assertNotExpired(): void {
    if (this.isExpired()) {
      throw new StagedActionExpiredException(this.id, this.expiresAt);
    }
  }

  public getFinancialDeltaUSD(): number {
    return 0;
  }

  public toStagedStateAction(): StagedStateAction {
    this.validate();
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
 * MutationFactory: Factory pattern providing unified `createMutation(type, data)` instantiation
 */
export class MutationFactory {
  public static createMutation(
    type: 'ISSUE_SERVICE_CREDIT',
    data: CreditMutationData
  ): CreditMutation;
  public static createMutation(
    type: 'CANCEL_SHIPMENT',
    data: CancellationMutationData
  ): CancellationMutation;
  public static createMutation(
    type: 'FEE_WAIVER',
    data: FeeWaiverMutationData
  ): FeeWaiverMutation;
  public static createMutation(
    type: 'ESCALATE_TICKET',
    data: EscalationMutationData
  ): EscalationMutation;
  public static createMutation(
    type: StagedMutationType | string,
    data: any
  ): IStagedMutation {
    switch (type) {
      case 'ISSUE_SERVICE_CREDIT': {
        const mutation = new CreditMutation(data);
        mutation.validate();
        return mutation;
      }
      case 'CANCEL_SHIPMENT': {
        const mutation = new CancellationMutation(data);
        mutation.validate();
        return mutation;
      }
      case 'FEE_WAIVER': {
        const mutation = new FeeWaiverMutation(data);
        mutation.validate();
        return mutation;
      }
      case 'ESCALATE_TICKET': {
        const mutation = new EscalationMutation(data);
        mutation.validate();
        return mutation;
      }
      default:
        throw new Error(`Unsupported mutation type: ${type}`);
    }
  }
}
