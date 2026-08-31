/**
 * System Configuration & Deterministic Temporal Anchors
 * ParcelPilot Autonomous Support & Operations Engine
 */

export const SNAPSHOT_TIME = '2026-08-16T05:30:00Z'; // 2026-08-16 11:00:00 Asia/Kolkata
export const SYSTEM_REFERENCE_TIME = '2026-03-01T00:00:00Z';
export const REF_TIMESTAMP = new Date(SYSTEM_REFERENCE_TIME).getTime();

export const DEFAULT_CURRENCY: 'USD' | 'INR' = 'USD';
export const USD_TO_INR_RATE = 83.0; // Standard reference exchange rate

export const ACCOUNT_IDS = [
  'ACC-NORTHSTAR',
  'ACC-LUMENWORKS',
  'ACC-BEACON',
  'ACC-AXIS'
] as const;

export const CARRIER_LIST = [
  'Apex Express',
  'SwiftFreight',
  'BlueDart Pro',
  'RoadRunner',
  'FastTrack'
] as const;

export const SLA_THRESHOLDS = {
  CARRIER_DELAY_ANOMALY_HOURS: 2.0,
  STANDARD_SOP_CREDIT_DELAY_HOURS: 4.0,
  NORTHSTAR_TIER1_CREDIT_DELAY_HOURS: 2.0,
  LUMENWORKS_TIER1_CREDIT_DELAY_HOURS: 3.0,
  STANDARD_SOP_CANCELLATION_NOTICE_HOURS: 24.0,
  NORTHSTAR_TIER1_CANCELLATION_NOTICE_HOURS: 2.0,
  LUMENWORKS_TIER1_CANCELLATION_NOTICE_HOURS: 3.0,
  STANDARD_CANCELLATION_FEE_USD: 50.0,
  STANDARD_CANCELLATION_FEE_INR: 4000.0,
  LUMENWORKS_REDUCED_FEE_USD: 25.0,
  LUMENWORKS_REDUCED_FEE_INR: 2000.0
} as const;

export const STORAGE_KEYS = {
  ACTIVE_ROLE: 'parcelpilot_active_role',
  ACTIVE_ACCOUNT: 'parcelpilot_active_account',
  ACTIVE_CURRENCY: 'parcelpilot_active_currency',
  LEDGER_CACHE: 'parcelpilot_ledger_cache_v2'
} as const;
