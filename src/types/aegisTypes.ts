import { AccountId } from '../types';

export type PrecedenceTier = 
  | 'Tier 1: Enterprise Agreement' 
  | 'Tier 2: Current SOP' 
  | 'Tier 3: Deprecated (Quarantined)';

export type ActionType = 
  | 'CANCEL_SHIPMENT' 
  | 'ISSUE_SERVICE_CREDIT' 
  | 'ESCALATE_TICKET' 
  | 'FEE_WAIVER';

export type TransactionStatus = 
  | 'STAGED_AWAITING_CONFIRMATION' 
  | 'COMMITTED' 
  | 'VOIDED' 
  | 'REJECTED';

export interface StagedStateAction {
  id: string;
  action_type: ActionType | string;
  target_id: string;
  account_id: AccountId | string;
  reason: string;
  citation: string;
  documentName?: string;
  tierLevel?: PrecedenceTier | string;
  amountUSD?: number;
  amountINR?: number;
  percentage?: number;
  cancellation_fee_USD?: number;
  cancellation_fee_INR?: number;
  stagedAt?: string;
  status?: TransactionStatus | string;
  timestamp?: string;
}

export interface CommittedExecutionLog {
  id: string;
  action_type: ActionType | string;
  target_id: string;
  account_id: AccountId | string;
  timestamp: string;
  amountUSD?: number;
  amountINR?: number;
  percentage?: number;
  feeUSD?: number;
  feeINR?: number;
  citation: string;
  txHash: string;
  details: string;
  documentName?: string;
  tierLevel?: PrecedenceTier | string;
  operatorUid?: string;
  operatorEmail?: string;
  status?: TransactionStatus | string;
  batchId?: string;
  createdAt?: string;
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
}

export interface SyncActionOptions {
  operatorUid?: string;
  operatorEmail?: string;
  txHashOverride?: string;
  batchId?: string;
}

export interface VoidActionOptions {
  operatorEmail?: string;
  voidReason?: string;
}
