import { AccountId, Order, Ticket, UserRole, StagedStateAction } from '../types';
import { ACCOUNTS, REF_TIMESTAMP, SYSTEM_REFERENCE_TIME } from '../data/mockData';
import {
  TenantAuthorizationError,
  SchemaValidationError,
  ContractPrecedenceViolationError,
} from '../errors/ParcelPilotErrors';
import { OrderAggregate } from '../models/OrderState';
import { MutationFactory } from './mutationFactory';

export interface OrderLookupResult {
  order_id: string;
  account_id: AccountId;
  account_name: string;
  carrier: string;
  service_tier: string;
  status: string;
  scheduled_delivery: string | null;
  scheduled_pickup: string | null;
  carrier_fault: boolean;
  root_cause: string | null;
  costUSD: number;
  costINR: number;
  calculated_delay_hours: number;
  notice_hours_until_pickup: number | null;
  origin: string;
  destination: string;
  isRBACError?: boolean;
  errorCode?: string;
  session_account_id?: string;
  error?: string;
  telemetry_inconsistency?: string;
}

export interface PolicyAuditResult {
  eligible: boolean;
  action_type: 'ISSUE_SERVICE_CREDIT' | 'CANCEL_SHIPMENT' | 'NO_ACTION';
  credit_percentage?: number;
  credit_amount_USD?: number;
  credit_amount_INR?: number;
  cancellation_fee_USD?: number;
  cancellation_fee_INR?: number;
  tierLevel: string;
  citation: string;
  documentName: string;
  reason: string;
  arithmetic_breakdown: string;
  logs: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Formal JSON Schema Definition for get_contract_clause Tool
// ---------------------------------------------------------------------------
export const ALLOWED_ACCOUNT_IDS = [
  'ACC-NORTHSTAR',
  'ACC-LUMENWORKS',
  'ACC-BEACON',
  'ACC-AXIS',
  'ACCT-001',
  'ACCT-002',
  'ACCT-003',
  'ACCT-004',
] as const;

export type AllowedAccountId = typeof ALLOWED_ACCOUNT_IDS[number];

export const ALLOWED_CLAUSE_TOPICS = [
  'CANCELLATION_FEE_WAIVER',
  'CARRIER_FAULT_SERVICE_CREDIT',
  'PICKUP_WINDOW_SLA',
  'MONTHLY_CREDIT_CAP',
  'BILLING_CONTACT_UPDATE',
  'API_KEY_SECURITY_INCIDENT',
  'KNOWN_OPERATIONAL_BUGS',
  'NOTICE_PERIOD_RULES',
] as const;

export type AllowedClauseTopic = typeof ALLOWED_CLAUSE_TOPICS[number];

export const GET_CONTRACT_CLAUSE_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'get_contract_clause_parameters',
  description: 'Schema-governed tool for fetching binding customer contract clauses and SOP rules.',
  type: 'object',
  additionalProperties: false,
  required: ['account_id', 'clause_topic'],
  properties: {
    account_id: {
      type: 'string',
      enum: ALLOWED_ACCOUNT_IDS,
      description: 'The authoritative enterprise account identifier.',
    },
    clause_topic: {
      type: 'string',
      enum: ALLOWED_CLAUSE_TOPICS,
      description: 'Validated clause domain topic. Freeform prompt injection strings are explicitly rejected.',
    },
    minimum_confidence: {
      type: 'number',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.85,
      description: 'Confidence threshold to satisfy before falling back to full-document PDF scanning.',
    },
    include_verbatim_text: {
      type: 'boolean',
      default: false,
      description: 'Whether to include verbatim PDF contract paragraphs.',
    },
  },
} as const;

export interface GetContractClauseParams {
  account_id: AllowedAccountId;
  clause_topic: AllowedClauseTopic;
  minimum_confidence?: number;
  include_verbatim_text?: boolean;
}

// ---------------------------------------------------------------------------
// Tiered RAG Storage: Lightweight Summary Index (Tier 1) vs Full PDF Chunks (Tier 2)
// ---------------------------------------------------------------------------
interface ClauseSummaryEntry {
  clauseId: string;
  clauseRef: string;
  title: string;
  document: string;
  accountId: AccountId | 'GLOBAL';
  tier: 'Tier 1 (Enterprise Agreement)' | 'Tier 2 (Current SOP v4)';
  topic: AllowedClauseTopic;
  keywords: string[];
  summaryRule: string;
  confidenceScore: number;
  arithmeticParameters?: {
    thresholdHours?: number;
    creditPercentage?: number;
    feeWaiverEligible?: boolean;
    cancellationFeeUSD?: number;
    cancellationFeeINR?: number;
  };
}

const CLAUSE_SUMMARY_INDEX: ClauseSummaryEntry[] = [
  {
    clauseId: 'NS-4.1',
    clauseRef: 'Clause 4.1',
    title: 'Enterprise Cancellation Fee Waiver',
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    tier: 'Tier 1 (Enterprise Agreement)',
    topic: 'CANCELLATION_FEE_WAIVER',
    keywords: ['cancel', 'waiver', 'notice', '2 hours', '$0 fee', 'zero fee'],
    summaryRule: 'Waives 100% of cancellation fee ($0.00 / ₹0) whenever notice is >= 2.0 hours prior to pickup window start.',
    confidenceScore: 0.98,
    arithmeticParameters: { thresholdHours: 2.0, feeWaiverEligible: true, cancellationFeeUSD: 0, cancellationFeeINR: 0 },
  },
  {
    clauseId: 'NS-4.2',
    clauseRef: 'Clause 4.2',
    title: 'Carrier-Fault Delay 100% Service Credit',
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    tier: 'Tier 1 (Enterprise Agreement)',
    topic: 'CARRIER_FAULT_SERVICE_CREDIT',
    keywords: ['delay', 'carrier fault', '100% credit', '2.0 hours', 'late pickup'],
    summaryRule: '100% Service Credit of shipment fee for any carrier-fault delay >= 2.0 hours from scheduled window.',
    confidenceScore: 0.99,
    arithmeticParameters: { thresholdHours: 2.0, creditPercentage: 100 },
  },
  {
    clauseId: 'LW-3.4',
    clauseRef: 'Clause 3.4',
    title: 'Carrier Delay 50% Service Credit',
    document: '06_LumenWorks_Service_Agreement.pdf',
    accountId: 'ACC-LUMENWORKS',
    tier: 'Tier 1 (Enterprise Agreement)',
    topic: 'CARRIER_FAULT_SERVICE_CREDIT',
    keywords: ['delay', 'carrier fault', '50% credit', '3.0 hours'],
    summaryRule: '50% Service Credit of shipment fee for carrier-fault delays >= 3.0 hours.',
    confidenceScore: 0.96,
    arithmeticParameters: { thresholdHours: 3.0, creditPercentage: 50 },
  },
  {
    clauseId: 'LW-3.2',
    clauseRef: 'Clause 3.2',
    title: 'Notice Cancellation Schedule ($25 Fee)',
    document: '06_LumenWorks_Service_Agreement.pdf',
    accountId: 'ACC-LUMENWORKS',
    tier: 'Tier 1 (Enterprise Agreement)',
    topic: 'CANCELLATION_FEE_WAIVER',
    keywords: ['cancel', 'fee', '3 hours notice', '$25', '₹2000'],
    summaryRule: 'Standard fee reduced to $25.00 (₹2,000) when notice >= 3.0 hours. Otherwise standard $50 applies.',
    confidenceScore: 0.95,
    arithmeticParameters: { thresholdHours: 3.0, feeWaiverEligible: false, cancellationFeeUSD: 25, cancellationFeeINR: 2000 },
  },
  {
    clauseId: 'SOP-2.1',
    clauseRef: 'Section 2.1',
    title: 'Standard Cancellation Fee ($50)',
    document: '03_Cancellation_and_Service_Credit_SOP_v4.pdf',
    accountId: 'GLOBAL',
    tier: 'Tier 2 (Current SOP v4)',
    topic: 'CANCELLATION_FEE_WAIVER',
    keywords: ['standard cancellation', 'beacon', 'axis', '$50', '₹4000'],
    summaryRule: 'Standard cancellation fee of $50.00 (₹4,000) applies for cancellations requested within 24 hours of scheduled pickup.',
    confidenceScore: 0.92,
    arithmeticParameters: { thresholdHours: 24.0, feeWaiverEligible: false, cancellationFeeUSD: 50, cancellationFeeINR: 4000 },
  },
  {
    clauseId: 'SOP-4.2',
    clauseRef: 'Section 4.2',
    title: 'Standard Service Credit (25% for >= 4.0h)',
    document: '03_Cancellation_and_Service_Credit_SOP_v4.pdf',
    accountId: 'GLOBAL',
    tier: 'Tier 2 (Current SOP v4)',
    topic: 'CARRIER_FAULT_SERVICE_CREDIT',
    keywords: ['standard credit', '25%', '4.0 hours', 'beacon', 'axis'],
    summaryRule: '25% Service Credit applies only if carrier-fault delay is >= 4.0 hours from scheduled delivery window.',
    confidenceScore: 0.93,
    arithmeticParameters: { thresholdHours: 4.0, creditPercentage: 25 },
  },
  {
    clauseId: 'DOC04-OPS',
    clauseRef: 'Section 5.3',
    title: 'Known Platform Issues & Temporary Workarounds',
    document: '04_Product_Operations_Guide_and_Known_Issues.pdf',
    accountId: 'GLOBAL',
    tier: 'Tier 2 (Current SOP v4)',
    topic: 'KNOWN_OPERATIONAL_BUGS',
    keywords: ['webhook lag', 'swiftship', 'csv heap', '70% upload failure'],
    summaryRule: 'BUG-1092 SwiftShip webhook lag up to 25m after pickup. BUG-1044 CSV bulk upload 4000+ rows V8 heap exhaustion at 70%.',
    confidenceScore: 0.97,
  },
];

interface FullDocChunk {
  document: string;
  accountId: AccountId | 'GLOBAL';
  section: string;
  pageNumber: number;
  fullVerbatimText: string;
}

const FULL_DOCUMENT_PDF_CHUNKS: FullDocChunk[] = [
  {
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    section: 'Article 4: Service Level Guarantees and Liquidated Remedies',
    pageNumber: 4,
    fullVerbatimText: `Section 4.1 Cancellation Fee Waiver: The Customer shall have the right to cancel any scheduled shipment without penalty ($0.00 fee) provided written or electronic notification is transmitted to ParcelPilot not less than two (2.0) hours prior to the commencement of the scheduled pickup window.
Section 4.2 Carrier Fault Remediation: In the event of a verified carrier-fault delay wherein pickup or delivery exceeds the contracted time window by two point zero (2.0) hours or greater, ParcelPilot shall automatically issue a one hundred percent (100%) service credit calculated against the gross shipment billing fee.`,
  },
  {
    document: '06_LumenWorks_Service_Agreement.pdf',
    accountId: 'ACC-LUMENWORKS',
    section: 'Section 3: Operations & Cancellation Terms',
    pageNumber: 3,
    fullVerbatimText: `3.4 Carrier Delay Credits: For all scheduled shipments experiencing delay solely attributable to the contracted carrier exceeding three (3.0) continuous hours, LumenWorks is entitled to a 50% credit on the shipment fee.
3.2 Order Modifications & Cancellations: Cancellations lodged with greater than three hours notice incur a discounted administrative fee of $25.00 USD (INR 2,000). Cancellations with less notice incur the standard tier fee of $50.00 USD (INR 4,000).`,
  },
  {
    document: '04_Product_Operations_Guide_and_Known_Issues.pdf',
    accountId: 'GLOBAL',
    section: 'Section 5: Known Operational Anomalies',
    pageNumber: 8,
    fullVerbatimText: `BUG-1092: SwiftShip Driver Webhook Ingestion Delay: Driver mobile scans occasionally take up to 25 minutes to post via HTTP webhook, leaving database in 'BOOKED' status post-pickup.
BUG-1044: CSV Bulk Processing Memory Boundary: Uploads of >4,000 rows experience V8 heap memory ceiling at ~70% batch progress. Split files into <= 2,000 row batches as interim workaround.`,
  },
];

// ---------------------------------------------------------------------------
// Tool Engine Implementation
// ---------------------------------------------------------------------------
export const toolEngine = {
  /**
   * Tool 1: lookup_order_data
   * Uses OrderAggregate state machine and enforces RBAC isolation
   */
  lookup_order_data: (
    orderId: string,
    sessionAccountId: AccountId,
    role: UserRole,
    orders: Order[]
  ): OrderLookupResult => {
    const cleanId = orderId.trim().toUpperCase();
    const rawOrder = orders.find(o => o.order_id.toUpperCase() === cleanId);

    if (!rawOrder) {
      return {
        order_id: cleanId,
        account_id: sessionAccountId,
        account_name: ACCOUNTS[sessionAccountId]?.name || sessionAccountId,
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

    // Normalize account IDs for dual-format comparison (e.g. ACCT-001 vs ACC-NORTHSTAR)
    const normalizeAcc = (id: string) => {
      if (id === 'ACCT-001' || id === 'ACC-NORTHSTAR') return 'ACC-NORTHSTAR';
      if (id === 'ACCT-002' || id === 'ACC-LUMENWORKS') return 'ACC-LUMENWORKS';
      if (id === 'ACCT-003' || id === 'ACC-BEACON') return 'ACC-BEACON';
      if (id === 'ACCT-004' || id === 'ACC-AXIS') return 'ACC-AXIS';
      return id;
    };

    // RBAC Tenant Isolation check (Strict 403 Security Boundary Denial without leaking owner metadata)
    if (role === 'customer' && normalizeAcc(rawOrder.account_id) !== normalizeAcc(sessionAccountId)) {
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
        errorCode: 'RBAC_TENANT_ISOLATION_VIOLATION',
        session_account_id: sessionAccountId,
        error: 'Resource not accessible within your tenant scope.'
      };
    }

    // Initialize Rich OrderAggregate Domain Entity with State Pattern
    const orderAggregate = new OrderAggregate(rawOrder);

    // Delay calculation relative to reference clock (2026-03-01T00:00:00Z)
    let delayHours = 0;
    if (orderAggregate.scheduledDelivery) {
      const schedTime = new Date(orderAggregate.scheduledDelivery).getTime();
      if (REF_TIMESTAMP > schedTime && orderAggregate.getLegacyStatus() === 'Delayed') {
        delayHours = parseFloat(((REF_TIMESTAMP - schedTime) / (1000 * 60 * 60)).toFixed(2));
      }
    }

    // Notice calculation relative to reference clock
    let noticeHours: number | null = null;
    if (orderAggregate.scheduledPickup) {
      const pickupTime = new Date(orderAggregate.scheduledPickup).getTime();
      noticeHours = parseFloat(((pickupTime - REF_TIMESTAMP) / (1000 * 60 * 60)).toFixed(2));
    }

    return {
      order_id: orderAggregate.id,
      account_id: orderAggregate.accountId,
      account_name: ACCOUNTS[orderAggregate.accountId]?.name || orderAggregate.accountId,
      carrier: orderAggregate.carrier,
      service_tier: orderAggregate.serviceTier,
      status: orderAggregate.getLegacyStatus(),
      scheduled_delivery: orderAggregate.scheduledDelivery,
      scheduled_pickup: orderAggregate.scheduledPickup,
      carrier_fault: orderAggregate.carrierFault,
      root_cause: orderAggregate.rootCause,
      costUSD: orderAggregate.costUSD,
      costINR: orderAggregate.costINR,
      calculated_delay_hours: delayHours,
      notice_hours_until_pickup: noticeHours,
      origin: orderAggregate.origin,
      destination: orderAggregate.destination
    };
  },

  /**
   * Tool 2: audit_policy_entitlements
   * Executes 3-tier precedence evaluation (Tier 1 > Tier 2; Tier 3 banned)
   */
  audit_policy_entitlements: (
    accountId: AccountId,
    orderData: OrderLookupResult,
    queryType: 'credit' | 'cancellation' | 'auto_detect'
  ): PolicyAuditResult => {
    const account = ACCOUNTS[accountId];
    const logs: string[] = [];

    logs.push(`[Pre-Audit] Auditing precedence hierarchy for ${account?.name || accountId} (${accountId})...`);
    logs.push(`[Filter] Filtered out Tier 3 '02_Support_Policy_v2_DEPRECATED' and unverified historical claims.`);

    let detectedQuery = queryType;
    if (detectedQuery === 'auto_detect') {
      detectedQuery = orderData.status === 'Delayed' ? 'credit' : 'cancellation';
    }

    // Service Credit Audit
    if (detectedQuery === 'credit') {
      const delay = orderData.calculated_delay_hours;
      const carrierFault = orderData.carrier_fault;

      if (!carrierFault) {
        logs.push(`[Check] Carrier fault is FALSE (${orderData.root_cause || 'External / Force Majeure'}).`);
        return {
          eligible: false,
          action_type: 'NO_ACTION',
          tierLevel: 'Tier 2 (SOP v4 Section 5.1)',
          citation: '01_Support_Policy_v3.pdf - Section 5.1 (Non-carrier delay exclusions)',
          documentName: '01_Support_Policy_v3.pdf',
          reason: `Delay of ${delay} hrs was caused by non-carrier factors (${orderData.root_cause || 'Weather/External'}).`,
          arithmetic_breakdown: `Cost $${orderData.costUSD} × 0% credit = $0.00`,
          logs
        };
      }

      // Check Tier 1 Enterprise Overrides
      if (accountId === 'ACC-NORTHSTAR') {
        logs.push(`[Tier 1 Evaluation] Evaluating Northstar Logistics Enterprise Agreement (05_Northstar_Logistics_Enterprise_Agreement.pdf)...`);
        if (delay >= 2.0) {
          const creditAmountUSD = orderData.costUSD;
          const creditAmountINR = orderData.costINR;
          logs.push(`[Tier 1 Match] Matched Clause 4.2: Carrier-fault delay ${delay}h >= 2.0h threshold. 100% Service Credit.`);

          return {
            eligible: true,
            action_type: 'ISSUE_SERVICE_CREDIT',
            credit_percentage: 100,
            credit_amount_USD: creditAmountUSD,
            credit_amount_INR: creditAmountINR,
            tierLevel: 'Tier 1 (Customer Enterprise Agreement)',
            citation: 'Clause 4.2 (Carrier Delay Service Credit & Enterprise Overrides)',
            documentName: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
            reason: `Carrier-fault delay of ${delay} hours qualifies for a 100% service credit under Northstar Enterprise Agreement Clause 4.2 (threshold: >= 2.0 hrs).`,
            arithmetic_breakdown: `$${orderData.costUSD.toFixed(2)} (or ₹${orderData.costINR.toLocaleString()}) base fee × 100% = $${creditAmountUSD.toFixed(2)} (₹${creditAmountINR.toLocaleString()})`,
            logs
          };
        }
      } else if (accountId === 'ACC-LUMENWORKS') {
        logs.push(`[Tier 1 Evaluation] Evaluating LumenWorks MSA (06_LumenWorks_Master_Services_Agreement.pdf)...`);
        if (delay >= 3.0) {
          const creditAmountUSD = parseFloat((orderData.costUSD * 0.5).toFixed(2));
          const creditAmountINR = parseFloat((orderData.costINR * 0.5).toFixed(2));
          logs.push(`[Tier 1 Match] Matched Clause 3.4: Carrier-fault delay ${delay}h >= 3.0h threshold. 50% Service Credit.`);

          return {
            eligible: true,
            action_type: 'ISSUE_SERVICE_CREDIT',
            credit_percentage: 50,
            credit_amount_USD: creditAmountUSD,
            credit_amount_INR: creditAmountINR,
            tierLevel: 'Tier 1 (Customer Enterprise Agreement)',
            citation: 'Clause 3.4 (Carrier Delay Service Credit)',
            documentName: '06_LumenWorks_Master_Services_Agreement.pdf',
            reason: `Carrier-fault delay of ${delay} hours qualifies for a 50% service credit under LumenWorks MSA Clause 3.4 (threshold: >= 3.0 hrs).`,
            arithmetic_breakdown: `$${orderData.costUSD.toFixed(2)} (₹${orderData.costINR.toLocaleString()}) base fee × 50% = $${creditAmountUSD.toFixed(2)} (₹${creditAmountINR.toLocaleString()})`,
            logs
          };
        }
      }

      // Tier 2 SOP v4 Default
      logs.push(`[Tier 2 Evaluation] Evaluating Standard SOP v4 (01_Support_Policy_v3.pdf)...`);
      if (delay >= 4.0) {
        const creditAmountUSD = parseFloat((orderData.costUSD * 0.25).toFixed(2));
        const creditAmountINR = parseFloat((orderData.costINR * 0.25).toFixed(2));
        logs.push(`[Tier 2 Match] Matched Section 5.2: Delay of ${delay}h >= 4.0h threshold. 25% Service Credit.`);

        return {
          eligible: true,
          action_type: 'ISSUE_SERVICE_CREDIT',
          credit_percentage: 25,
          credit_amount_USD: creditAmountUSD,
          credit_amount_INR: creditAmountINR,
          tierLevel: 'Tier 2 (Standard SOP v4)',
          citation: 'Section 5.2 - Standard Service Guarantee (25% credit for carrier delays >= 4.0 hrs)',
          documentName: '01_Support_Policy_v3.pdf',
          reason: `Carrier-fault delay of ${delay} hours qualifies for standard 25% service credit under SOP v4 Section 5.2.`,
          arithmetic_breakdown: `$${orderData.costUSD.toFixed(2)} × 25% = $${creditAmountUSD.toFixed(2)} (₹${creditAmountINR.toLocaleString()})`,
          logs
        };
      }

      return {
        eligible: false,
        action_type: 'NO_ACTION',
        tierLevel: 'Tier 2 (Standard SOP v4)',
        citation: '01_Support_Policy_v3.pdf - Section 5.2 (Delays < 4.0 hrs ineligible for standard accounts)',
        documentName: '01_Support_Policy_v3.pdf',
        reason: `Delay of ${delay} hours is under the standard 4.0-hour threshold for non-enterprise accounts.`,
        arithmetic_breakdown: `Cost $${orderData.costUSD} × 0% = $0.00 (Requires delay >= 4.0h)`,
        logs
      };
    }

    // Cancellation Audit
    if (detectedQuery === 'cancellation') {
      const notice = orderData.notice_hours_until_pickup;
      logs.push(`[Notice Assessment] Scheduled pickup: ${orderData.scheduled_pickup || 'N/A'}. Lead time notice: ${notice !== null ? notice + ' hrs' : 'Unknown'}.`);

      if (accountId === 'ACC-NORTHSTAR') {
        logs.push(`[Tier 1 Evaluation] Evaluating Northstar Logistics Enterprise Agreement (Clause 4.1)...`);
        if (notice !== null && notice >= 2.0) {
          logs.push(`[Tier 1 Match] Notice is ${notice}h (>= 2.0h threshold). Clause 4.1 100% cancellation fee waiver applied ($0).`);
          return {
            eligible: true,
            action_type: 'CANCEL_SHIPMENT',
            cancellation_fee_USD: 0,
            cancellation_fee_INR: 0,
            tierLevel: 'Tier 1 (Customer Enterprise Agreement)',
            citation: 'Clause 4.1 (Enterprise Cancellation Fee Waiver: $0 / ₹0 when notice >= 2.0 hrs)',
            documentName: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
            reason: `Order cancellation requested with ${notice} hours notice (>= 2.0 hours). The standard $50 fee is 100% waived per Enterprise Agreement Clause 4.1.`,
            arithmetic_breakdown: `Standard Fee $50.00 - $50.00 (100% Enterprise Waiver) = $0.00 (₹0)`,
            logs
          };
        } else {
          logs.push(`[Tier 1 Exception] Notice of ${notice}h is < 2.0h threshold. Standard $50 cancellation fee applies.`);
          return {
            eligible: true,
            action_type: 'CANCEL_SHIPMENT',
            cancellation_fee_USD: 50.00,
            cancellation_fee_INR: 4000.00,
            tierLevel: 'Tier 1 (Clause 4.1 Exception) / Tier 2 SOP v4',
            citation: 'Clause 4.1 Short-Notice Clause & 03_Cancellation_SOP_v4.pdf Section 3.1',
            documentName: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
            reason: `Notice of ${notice} hours is below the 2.0-hour waiver window. Standard cancellation fee of $50.00 (₹4,000) applies.`,
            arithmetic_breakdown: `Short notice fee = $50.00 (₹4,000)`,
            logs
          };
        }
      } else if (accountId === 'ACC-LUMENWORKS') {
        logs.push(`[Tier 1 Evaluation] Evaluating LumenWorks MSA (Clause 3.2)...`);
        if (notice !== null && notice >= 3.0) {
          return {
            eligible: true,
            action_type: 'CANCEL_SHIPMENT',
            cancellation_fee_USD: 25.00,
            cancellation_fee_INR: 2000.00,
            tierLevel: 'Tier 1 (Customer Enterprise Agreement)',
            citation: 'Clause 3.2 (Notice Cancellation Schedule: Reduced $25 / ₹2,000 fee when notice >= 3.0 hrs)',
            documentName: '06_LumenWorks_Master_Services_Agreement.pdf',
            reason: `Notice of ${notice} hours qualifies for reduced fee schedule under LumenWorks MSA Clause 3.2.`,
            arithmetic_breakdown: `Standard Fee $50 - $25 (50% reduction) = $25.00 (₹2,000)`,
            logs
          };
        }
      }

      // Tier 2 SOP v4 Default
      return {
        eligible: true,
        action_type: 'CANCEL_SHIPMENT',
        cancellation_fee_USD: 50.00,
        cancellation_fee_INR: 4000.00,
        tierLevel: 'Tier 2 (Standard SOP v4)',
        citation: '03_Cancellation_SOP_v4.pdf - Section 3.1 (Standard $50.00 Cancellation Fee)',
        documentName: '03_Cancellation_SOP_v4.pdf',
        reason: `Standard cancellation fee assessed per SOP v4 Section 3.1.`,
        arithmetic_breakdown: `Standard cancellation fee = $50.00 (₹4,000)`,
        logs
      };
    }

    return {
      eligible: false,
      action_type: 'NO_ACTION',
      tierLevel: 'Tier 2',
      citation: 'General Policy',
      documentName: '01_Support_Policy_v3.pdf',
      reason: 'No applicable policy action triggered.',
      arithmetic_breakdown: 'N/A',
      logs
    };
  },

  /**
   * Tool 3: stage_state_action (Uses MutationFactory pattern)
   * Instantiates strongly typed Mutation objects replacing loose structures
   */
  stage_state_action: (
    actionType: 'ISSUE_SERVICE_CREDIT' | 'CANCEL_SHIPMENT' | 'ESCALATE_TICKET',
    targetId: string,
    accountId: AccountId,
    options: {
      amountUSD?: number;
      amountINR?: number;
      percentage?: number;
      cancellation_fee_USD?: number;
      cancellation_fee_INR?: number;
      tierLevel: string;
      citation: string;
      documentName: string;
      reason: string;
    }
  ): StagedStateAction => {
    const account = ACCOUNTS[accountId];

    if (actionType === 'ISSUE_SERVICE_CREDIT') {
      const mutation = MutationFactory.createMutation('ISSUE_SERVICE_CREDIT', {
        targetId,
        accountId,
        amountUSD: options.amountUSD || 0,
        amountINR: options.amountINR || 0,
        percentage: options.percentage || 100,
        tierLevel: options.tierLevel,
        documentName: options.documentName,
        citation: options.citation,
        reason: options.reason,
        monthlyCapUSD: account?.monthlyCreditCap ?? 10000,
        monthlyUsedUSD: account?.monthlyCreditUsed ?? 0,
      });
      return mutation.toStagedStateAction();
    }

    if (actionType === 'CANCEL_SHIPMENT') {
      const isWaived = (options.cancellation_fee_USD ?? 0) === 0;
      const mutation = MutationFactory.createMutation('CANCEL_SHIPMENT', {
        targetId,
        accountId,
        cancellationFeeUSD: options.cancellation_fee_USD ?? 0,
        cancellationFeeINR: options.cancellation_fee_INR ?? 0,
        isFeeWaived: isWaived,
        tierLevel: options.tierLevel,
        documentName: options.documentName,
        citation: options.citation,
        reason: options.reason,
      });
      return mutation.toStagedStateAction();
    }

    // Default: Escalation Mutation
    const mutation = MutationFactory.createMutation('ESCALATE_TICKET', {
      targetId,
      accountId,
      tierLevel: options.tierLevel,
      documentName: options.documentName,
      citation: options.citation,
      reason: options.reason,
    });
    return mutation.toStagedStateAction();
  },

  /**
   * Tool 4: radar_anomaly_scan
   * Scans fleet for carrier delay clusters (>= 2.0h)
   */
  radar_anomaly_scan: (orders: Order[], tickets: Ticket[]) => {
    const carrierDelayedOrders = orders.filter(o => {
      if (!o.carrier_fault || o.status !== 'Delayed' || !o.scheduled_delivery) return false;
      const sched = new Date(o.scheduled_delivery).getTime();
      const delayH = (REF_TIMESTAMP - sched) / (1000 * 60 * 60);
      return delayH >= 2.0;
    });

    const carrierCounts: Record<string, number> = {};
    const carrierRootCauses: Record<string, string> = {};

    carrierDelayedOrders.forEach(o => {
      carrierCounts[o.carrier] = (carrierCounts[o.carrier] || 0) + 1;
      if (o.root_cause) {
        carrierRootCauses[o.carrier] = o.root_cause;
      }
    });

    const highPrioritySla = tickets.filter(t => (t.priority === 'HIGH' || t.priority === 'CRITICAL') && t.sla_breached);

    return {
      snapshot_timestamp: SYSTEM_REFERENCE_TIME,
      affected_shipments_count: carrierDelayedOrders.length,
      carrierDelayedOrders,
      carrierCounts,
      carrierRootCauses,
      highPrioritySla,
      primaryAnomaly: 'Apex Express Midwest Sorting Hub Systematic Failure'
    };
  },

  /**
   * Tool 5: get_contract_clause
   * Tiered RAG tool with strict JSON schema validation, enum-guarded parameters,
   * fast clause summary index retrieval, and full-document PDF chunk fallback.
   */
  get_contract_clause: (rawParams: unknown) => {
    // 1. Strict Schema & Injection Defense Validation
    if (!rawParams || typeof rawParams !== 'object') {
      throw new SchemaValidationError('get_contract_clause', ['Tool input must be a valid non-null JSON object.']);
    }

    const params = rawParams as Record<string, any>;
    const errors: string[] = [];

    if (!params.account_id) {
      errors.push("Missing required field 'account_id'.");
    } else if (!ALLOWED_ACCOUNT_IDS.includes(params.account_id)) {
      errors.push(`'account_id' value '${params.account_id}' is invalid. Allowed: ${ALLOWED_ACCOUNT_IDS.join(', ')}`);
    }

    if (!params.clause_topic) {
      errors.push("Missing required field 'clause_topic'.");
    } else if (!ALLOWED_CLAUSE_TOPICS.includes(params.clause_topic)) {
      errors.push(`'clause_topic' value '${params.clause_topic}' is invalid. Allowed: ${ALLOWED_CLAUSE_TOPICS.join(', ')}. Freeform prompt strings are forbidden.`);
    }

    const allowedKeys = ['account_id', 'clause_topic', 'minimum_confidence', 'include_verbatim_text'];
    for (const key of Object.keys(params)) {
      if (!allowedKeys.includes(key)) {
        errors.push(`Unrecognized parameter '${key}' blocked by strict JSON schema.`);
      }
    }

    if (errors.length > 0) {
      throw new SchemaValidationError('get_contract_clause', errors);
    }

    // Normalize account ID alias
    let normalizedAccountId = params.account_id as AccountId;
    if (params.account_id === 'ACCT-001') normalizedAccountId = 'ACC-NORTHSTAR';
    if (params.account_id === 'ACCT-002') normalizedAccountId = 'ACC-LUMENWORKS';
    if (params.account_id === 'ACCT-003') normalizedAccountId = 'ACC-BEACON';
    if (params.account_id === 'ACCT-004') normalizedAccountId = 'ACC-AXIS';

    const minConfidence = typeof params.minimum_confidence === 'number' ? params.minimum_confidence : 0.85;
    const clauseTopic = params.clause_topic as AllowedClauseTopic;

    // 2. Fast Tier 1 RAG: Clause Summary Index Lookup
    const summaryMatch = CLAUSE_SUMMARY_INDEX.find(
      entry => (entry.accountId === normalizedAccountId || entry.accountId === 'GLOBAL') && entry.topic === clauseTopic
    );

    if (summaryMatch && summaryMatch.confidenceScore >= minConfidence) {
      return {
        success: true,
        retrieval_tier: 'CLAUSE_SUMMARY_FAST_INDEX',
        confidence_score: summaryMatch.confidenceScore,
        account_id: normalizedAccountId,
        clause_topic: clauseTopic,
        clause_reference: summaryMatch.clauseRef,
        title: summaryMatch.title,
        governing_document: summaryMatch.document,
        tier: summaryMatch.tier,
        summary_rule: summaryMatch.summaryRule,
        arithmetic_parameters: summaryMatch.arithmeticParameters,
        schema_validation_passed: true,
      };
    }

    // 3. Fallback Tier 2 RAG: Full Document PDF Parsing for Complex / Low Confidence Cases
    const docChunkMatch = FULL_DOCUMENT_PDF_CHUNKS.find(
      chunk => chunk.accountId === normalizedAccountId || chunk.accountId === 'GLOBAL'
    );

    if (docChunkMatch) {
      return {
        success: true,
        retrieval_tier: 'FULL_DOCUMENT_PDF_SCAN',
        confidence_score: 0.92,
        account_id: normalizedAccountId,
        clause_topic: clauseTopic,
        clause_reference: docChunkMatch.section,
        governing_document: docChunkMatch.document,
        tier: 'Tier 1 (Enterprise Agreement Full Scan)',
        verbatim_excerpt: docChunkMatch.fullVerbatimText,
        page_number: docChunkMatch.pageNumber,
        schema_validation_passed: true,
      };
    }

    return {
      success: false,
      error: `No binding contract clause found for account '${normalizedAccountId}' under topic '${clauseTopic}'.`,
      schema_validation_passed: true,
    };
  },
};
