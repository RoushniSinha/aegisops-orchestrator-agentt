/**
 * Immutable Embedded Policy & Clause Registry
 * ParcelPilot Autonomous Support & Operations Engine
 * 
 * 100% decoupled from physical PDF / Excel disk reads.
 * Provides deterministic evaluation for Tier 1 Enterprise Overrides,
 * Tier 2 Active SOP Baseline, and Tier 3 Deprecated/Banned Quarantine.
 */

import { AccountId, PolicyClause } from '../types';
import { SLA_THRESHOLDS } from '../config/constants';

export interface EvaluatedCancellationResult {
  feeUSD: number;
  feeINR: number;
  isWaived: boolean;
  governingTier: 'Tier 1' | 'Tier 2';
  document: string;
  clause: string;
  clauseTitle: string;
  reasoning: string;
  verbatimRule: string;
}

export interface EvaluatedCreditResult {
  creditPercentage: number;
  amountUSD: number;
  amountINR: number;
  isEligible: boolean;
  governingTier: 'Tier 1' | 'Tier 2';
  document: string;
  clause: string;
  clauseTitle: string;
  reasoning: string;
  verbatimRule: string;
}

export const EMBEDDED_POLICY_REGISTRY: Record<string, PolicyClause[]> = {
  'ACC-NORTHSTAR': [
    {
      clause: 'Clause 4.1',
      title: 'Enterprise Cancellation Fee Waiver',
      document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
      rule: 'Waives 100% of standard cancellation fees ($0.00 / ₹0.00) whenever notice is provided >= 2.0 hours prior to scheduled pickup window start.',
      tier: 'Tier 1'
    },
    {
      clause: 'Clause 4.2',
      title: 'Carrier-Fault Delay Service Credit',
      document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
      rule: '100% Service Credit of shipment fee for any carrier-fault delay >= 2.0 hours from scheduled delivery window.',
      tier: 'Tier 1'
    },
    {
      clause: 'Clause 7.3',
      title: 'Priority Escalation Tier & Carrier Liaison',
      document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
      rule: 'Direct Tier-3 Carrier Liaison dispatch for SLA breaches exceeding 2.0 hours.',
      tier: 'Tier 1'
    }
  ],
  'ACC-LUMENWORKS': [
    {
      clause: 'Clause 3.4',
      title: 'Carrier Delay Service Credit',
      document: '06_LumenWorks_Service_Agreement.pdf',
      rule: '50% Service Credit of shipment fee for carrier-fault delays >= 3.0 hours.',
      tier: 'Tier 1'
    },
    {
      clause: 'Clause 3.2',
      title: 'Notice Cancellation Schedule',
      document: '06_LumenWorks_Service_Agreement.pdf',
      rule: 'Standard cancellation fee reduced to $25 (₹2,000) when notice >= 3.0 hours prior to pickup. Within 3.0h standard $50 fee applies.',
      tier: 'Tier 1'
    }
  ],
  'STANDARD_TIER2': [
    {
      clause: 'Section 5.2',
      title: 'Standard Service Guarantee',
      document: '01_Support_Policy_v3.pdf',
      rule: '25% Service Credit for carrier-fault delays >= 4.0 hours from scheduled delivery window.',
      tier: 'Tier 2'
    },
    {
      clause: 'Section 5.1',
      title: 'Non-Carrier Exclusion',
      document: '01_Support_Policy_v3.pdf',
      rule: 'Delays caused by weather, customs, or incorrect destination address are ineligible for automated credits.',
      tier: 'Tier 2'
    },
    {
      clause: 'Section 3.1',
      title: 'Standard Cancellation Assessment',
      document: '03_Cancellation_SOP_v4.pdf',
      rule: 'Standard flat $50.00 (₹4,000) cancellation fee applies to all cancellations requested < 24 hours before pickup.',
      tier: 'Tier 2'
    }
  ],
  'DEPRECATED_TIER3': [
    {
      clause: 'Section 8.2 (BANNED)',
      title: 'Deprecated 10% Discretionary Buffer',
      document: '02_Support_Policy_v2_DEPRECATED.pdf',
      rule: 'STRICTLY BANNED: Past discretionary 10% credit without threshold verification is prohibited under Governance v4.',
      tier: 'Tier 3',
      isDeprecated: true
    }
  ]
};

export const BANNED_DOCUMENTS = [
  '02_Support_Policy_v2_DEPRECATED.pdf',
  'historical_ticket_notes_untrusted'
];

/**
 * Deterministically evaluates the cancellation fee and waiver policy
 */
export function evaluateCancellationPolicy(
  accountId: AccountId,
  noticeHours: number
): EvaluatedCancellationResult {
  // Tier 1: Northstar Logistics Override
  if (accountId === 'ACC-NORTHSTAR') {
    if (noticeHours >= SLA_THRESHOLDS.NORTHSTAR_TIER1_CANCELLATION_NOTICE_HOURS) {
      return {
        feeUSD: 0.0,
        feeINR: 0.0,
        isWaived: true,
        governingTier: 'Tier 1',
        document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
        clause: 'Clause 4.1',
        clauseTitle: 'Enterprise Cancellation Fee Waiver',
        reasoning: `Northstar Tier 1 Enterprise Agreement Clause 4.1 waives 100% of cancellation fee ($0.00 / ₹0) since notice (${noticeHours.toFixed(1)}h) >= 2.0h threshold.`,
        verbatimRule: EMBEDDED_POLICY_REGISTRY['ACC-NORTHSTAR'][0].rule
      };
    }
  }

  // Tier 1: LumenWorks Override
  if (accountId === 'ACC-LUMENWORKS') {
    if (noticeHours >= SLA_THRESHOLDS.LUMENWORKS_TIER1_CANCELLATION_NOTICE_HOURS) {
      return {
        feeUSD: SLA_THRESHOLDS.LUMENWORKS_REDUCED_FEE_USD,
        feeINR: SLA_THRESHOLDS.LUMENWORKS_REDUCED_FEE_INR,
        isWaived: false,
        governingTier: 'Tier 1',
        document: '06_LumenWorks_Service_Agreement.pdf',
        clause: 'Clause 3.2',
        clauseTitle: 'Notice Cancellation Schedule',
        reasoning: `LumenWorks Service Agreement Clause 3.2 reduces cancellation fee to $25.00 (₹2,000) for notice (${noticeHours.toFixed(1)}h) >= 3.0h.`,
        verbatimRule: EMBEDDED_POLICY_REGISTRY['ACC-LUMENWORKS'][1].rule
      };
    }
  }

  // Tier 2: Standard SOP v4 Baseline
  if (noticeHours >= SLA_THRESHOLDS.STANDARD_SOP_CANCELLATION_NOTICE_HOURS) {
    return {
      feeUSD: 0.0,
      feeINR: 0.0,
      isWaived: true,
      governingTier: 'Tier 2',
      document: '03_Cancellation_SOP_v4.pdf',
      clause: 'Section 3.1',
      clauseTitle: 'Standard Cancellation Notice',
      reasoning: `Cancellation notice (${noticeHours.toFixed(1)}h) >= 24h before pickup window. Standard cancellation fee is $0.00.`,
      verbatimRule: EMBEDDED_POLICY_REGISTRY['STANDARD_TIER2'][2].rule
    };
  }

  return {
    feeUSD: SLA_THRESHOLDS.STANDARD_CANCELLATION_FEE_USD,
    feeINR: SLA_THRESHOLDS.STANDARD_CANCELLATION_FEE_INR,
    isWaived: false,
    governingTier: 'Tier 2',
    document: '03_Cancellation_SOP_v4.pdf',
    clause: 'Section 3.1',
    clauseTitle: 'Standard Cancellation Assessment',
    reasoning: `Standard flat cancellation fee of $50.00 (₹4,000) applies under Cancellation SOP v4 for cancellations < 24 hours prior to pickup.`,
    verbatimRule: EMBEDDED_POLICY_REGISTRY['STANDARD_TIER2'][2].rule
  };
}

/**
 * Deterministically evaluates service credit eligibility
 */
export function evaluateServiceCreditPolicy(
  accountId: AccountId,
  delayHours: number,
  carrierFault: boolean,
  costUSD: number,
  costINR: number
): EvaluatedCreditResult {
  // Non-carrier fault exclusion
  if (!carrierFault) {
    return {
      creditPercentage: 0,
      amountUSD: 0,
      amountINR: 0,
      isEligible: false,
      governingTier: 'Tier 2',
      document: '01_Support_Policy_v3.pdf',
      clause: 'Section 5.1',
      clauseTitle: 'Non-Carrier Exclusion',
      reasoning: `Delay was not attributed to carrier fault (weather / force majeure / shipper delay). Ineligible for automated service credit.`,
      verbatimRule: EMBEDDED_POLICY_REGISTRY['STANDARD_TIER2'][1].rule
    };
  }

  // Tier 1: Northstar 100% credit >= 2.0h
  if (accountId === 'ACC-NORTHSTAR') {
    if (delayHours >= SLA_THRESHOLDS.NORTHSTAR_TIER1_CREDIT_DELAY_HOURS) {
      return {
        creditPercentage: 100,
        amountUSD: Math.round(costUSD * 100) / 100,
        amountINR: Math.round(costINR * 100) / 100,
        isEligible: true,
        governingTier: 'Tier 1',
        document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
        clause: 'Clause 4.2',
        clauseTitle: 'Carrier-Fault Delay Service Credit',
        reasoning: `Northstar Tier 1 Enterprise Agreement Clause 4.2 entitles 100% Service Credit ($${costUSD} / ₹${costINR}) for carrier-fault delay (${delayHours.toFixed(1)}h >= 2.0h).`,
        verbatimRule: EMBEDDED_POLICY_REGISTRY['ACC-NORTHSTAR'][1].rule
      };
    }
  }

  // Tier 1: LumenWorks 50% credit >= 3.0h
  if (accountId === 'ACC-LUMENWORKS') {
    if (delayHours >= SLA_THRESHOLDS.LUMENWORKS_TIER1_CREDIT_DELAY_HOURS) {
      return {
        creditPercentage: 50,
        amountUSD: Math.round(costUSD * 0.5 * 100) / 100,
        amountINR: Math.round(costINR * 0.5 * 100) / 100,
        isEligible: true,
        governingTier: 'Tier 1',
        document: '06_LumenWorks_Service_Agreement.pdf',
        clause: 'Clause 3.4',
        clauseTitle: 'Carrier Delay Service Credit',
        reasoning: `LumenWorks Service Agreement Clause 3.4 entitles 50% Service Credit ($${(costUSD * 0.5).toFixed(2)} / ₹${(costINR * 0.5).toFixed(0)}) for carrier-fault delay (${delayHours.toFixed(1)}h >= 3.0h).`,
        verbatimRule: EMBEDDED_POLICY_REGISTRY['ACC-LUMENWORKS'][0].rule
      };
    }
  }

  // Tier 2: Standard SOP v3 25% credit >= 4.0h
  if (delayHours >= SLA_THRESHOLDS.STANDARD_SOP_CREDIT_DELAY_HOURS) {
    return {
      creditPercentage: 25,
      amountUSD: Math.round(costUSD * 0.25 * 100) / 100,
      amountINR: Math.round(costINR * 0.25 * 100) / 100,
      isEligible: true,
      governingTier: 'Tier 2',
      document: '01_Support_Policy_v3.pdf',
      clause: 'Section 5.2',
      clauseTitle: 'Standard Service Guarantee',
      reasoning: `Standard Support Policy v3 Section 5.2 entitles 25% Service Credit ($${(costUSD * 0.25).toFixed(2)} / ₹${(costINR * 0.25).toFixed(0)}) for carrier-fault delay >= 4.0 hours (${delayHours.toFixed(1)}h).`,
      verbatimRule: EMBEDDED_POLICY_REGISTRY['STANDARD_TIER2'][0].rule
    };
  }

  return {
    creditPercentage: 0,
    amountUSD: 0,
    amountINR: 0,
    isEligible: false,
    governingTier: 'Tier 2',
    document: '01_Support_Policy_v3.pdf',
    clause: 'Section 5.2',
    clauseTitle: 'Threshold Not Met',
    reasoning: `Carrier delay of ${delayHours.toFixed(1)}h does not meet the minimum contractual threshold for automated credit.`,
    verbatimRule: EMBEDDED_POLICY_REGISTRY['STANDARD_TIER2'][0].rule
  };
}

export function isDocumentDeprecated(documentName: string): boolean {
  return BANNED_DOCUMENTS.some(banned => documentName.toLowerCase().includes(banned.toLowerCase()));
}
