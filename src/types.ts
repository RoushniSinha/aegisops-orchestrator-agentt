import { StagedStateAction, CommittedExecutionLog, PrecedenceTier, ActionType, TransactionStatus } from './types/aegisTypes';

export * from './types/aegisTypes';

export type UserRole = 'customer' | 'internal_ops';

export type AccountId = 'ACC-NORTHSTAR' | 'ACC-LUMENWORKS' | 'ACC-BEACON' | 'ACC-AXIS';

export type Currency = 'USD' | 'INR';

export type PermissionKey =
  | 'VIEW_OWN_ORDERS'
  | 'VIEW_ALL_TENANTS'
  | 'STAGE_SERVICE_CREDIT'
  | 'STAGE_CANCELLATION_WAIVER'
  | 'OVERRIDE_CARRIER_FAULT'
  | 'GLOBAL_OPS_RADAR'
  | 'ESCALATE_CRITICAL_TICKETS'
  | 'MANAGE_RBAC_USERS'
  | 'VIEW_TIER1_CONTRACTS'
  | 'EXECUTE_LEDGER_ACTIONS';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountId: AccountId;
  department?: string;
  jobTitle?: string;
  status?: 'active' | 'suspended' | 'pending_verification';
  createdAt: string;
  lastLoginAt: string;
  lastPasswordChangedAt?: string;
  customPermissions?: PermissionKey[];
}

export interface PolicyClause {
  clause: string;
  title: string;
  document: string;
  rule: string;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  isDeprecated?: boolean;
}

export interface Account {
  id: AccountId;
  name: string;
  tier: 'Enterprise Tier 1' | 'Standard Tier 2';
  monthlyCreditCap: number;
  monthlyCreditUsed: number;
  activeContracts: string[];
  clauses: PolicyClause[];
}

export interface Order {
  order_id: string;
  account_id: AccountId;
  carrier: string;
  service_tier: string;
  status: 'Scheduled' | 'In Transit' | 'Delayed' | 'Delivered' | 'Cancelled';
  booked_at?: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  actual_pickup?: string;
  scheduled_pickup?: string;
  scheduled_delivery?: string;
  actual_delivery?: string;
  fee_USD?: number;
  fee_INR?: number;
  costUSD?: number;
  costINR?: number;
  carrier_fault?: boolean;
  customer_fault?: boolean;
  root_cause?: string;
  origin?: string;
  destination?: string;
  notes?: string;
}

export interface Ticket {
  ticket_id: string;
  order_id: string;
  account_id: AccountId;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  sla_breached: boolean;
  issue: string;
  status: 'OPEN' | 'STAGED_ESCALATION' | 'ESCALATED' | 'RESOLVED';
}

export interface ToolCall {
  id: string;
  name: 'lookup_order_data' | 'audit_policy_entitlements' | 'stage_state_action' | 'radar_anomaly_scan' | 'execute_state_action';
  params: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executionTimeMs?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  text: string;
  toolCalls?: ToolCall[];
  stagedActionRef?: StagedStateAction;
  rbacError?: {
    requestedId: string;
    sessionAccountId: string;
    errorCode?: string;
    message?: string;
  };
  isWarning?: boolean;
  isSuccess?: boolean;
}
