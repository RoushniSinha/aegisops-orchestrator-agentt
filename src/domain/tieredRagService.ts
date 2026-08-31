import { AccountId } from '../types';
import { ContractClauseNotFoundError } from './errors';

export interface ClauseSummaryNode {
  clauseId: string;
  clauseNumber: string;
  title: string;
  document: string;
  accountId: AccountId | 'GLOBAL';
  tier: 'Tier 1' | 'Tier 2';
  keywords: string[];
  summaryRule: string;
  confidenceScore: number;
}

export interface DocumentChunk {
  chunkId: string;
  document: string;
  accountId: AccountId;
  section: string;
  verbatimText: string;
  pageNumber: number;
}

export interface RagQueryResult {
  retrievalTier: 'CLAUSE_SUMMARY_FAST_INDEX' | 'FULL_DOCUMENT_DEEP_SCAN';
  confidenceScore: number;
  clauseNumber: string;
  clauseTitle: string;
  documentName: string;
  legalRule: string;
  verbatimSnippet?: string;
  governingTier: 'Tier 1' | 'Tier 2';
  arithmeticParameters?: {
    thresholdHours?: number;
    creditPercentage?: number;
    feeWaiverEligible?: boolean;
    cancellationFeeUSD?: number;
    cancellationFeeINR?: number;
  };
}

/**
 * High-Level Clause Summary Index (Tier 1 RAG)
 */
const CLAUSE_SUMMARY_INDEX: ClauseSummaryNode[] = [
  {
    clauseId: 'NS-4.1',
    clauseNumber: 'Clause 4.1',
    title: 'Enterprise Cancellation Fee Waiver',
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    tier: 'Tier 1',
    keywords: ['cancel', 'cancellation', 'fee', 'waiver', 'notice', 'pickup', '2 hours', 'zero fee'],
    summaryRule: 'Waives 100% of standard cancellation fees ($0.00 / ₹0.00) whenever notice is provided >= 2.0 hours prior to scheduled pickup window start.',
    confidenceScore: 0.98,
  },
  {
    clauseId: 'NS-4.2',
    clauseNumber: 'Clause 4.2',
    title: 'Carrier-Fault Delay Service Credit',
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    tier: 'Tier 1',
    keywords: ['delay', 'carrier fault', 'service credit', '100%', '2.0 hours', 'late pickup', 'sla breach'],
    summaryRule: '100% Service Credit of shipment fee for any carrier-fault delay >= 2.0 hours from scheduled window.',
    confidenceScore: 0.99,
  },
  {
    clauseId: 'NS-7.3',
    clauseNumber: 'Clause 7.3',
    title: 'Priority Escalation Tier & Carrier Liaison',
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    tier: 'Tier 1',
    keywords: ['escalate', 'liaison', 'priority', 'critical', 'tier 3 carrier liaison', 'urgent'],
    summaryRule: 'Immediate Tier-3 Carrier Liaison escalation dispatch for SLA breaches exceeding 2.0 hours.',
    confidenceScore: 0.95,
  },
  {
    clauseId: 'LW-3.4',
    clauseNumber: 'Clause 3.4',
    title: 'Carrier Delay Service Credit',
    document: '06_LumenWorks_Service_Agreement.pdf',
    accountId: 'ACC-LUMENWORKS',
    tier: 'Tier 1',
    keywords: ['delay', 'carrier fault', 'service credit', '50%', '3.0 hours', 'late pickup'],
    summaryRule: '50% Service Credit of shipment fee for carrier-fault delays >= 3.0 hours.',
    confidenceScore: 0.96,
  },
  {
    clauseId: 'LW-3.2',
    clauseNumber: 'Clause 3.2',
    title: 'Notice Cancellation Schedule',
    document: '06_LumenWorks_Service_Agreement.pdf',
    accountId: 'ACC-LUMENWORKS',
    tier: 'Tier 1',
    keywords: ['cancel', 'cancellation', 'fee', 'notice', '3 hours', '$25', '₹2000', '75 minutes'],
    summaryRule: 'Standard cancellation fee reduced to $25 (₹2,000) when notice >= 3.0 hours prior to pickup. Within 3.0h standard $50 fee applies.',
    confidenceScore: 0.94,
  },
  {
    clauseId: 'SOP-2.1',
    clauseNumber: 'Section 2.1',
    title: 'Standard Cancellation Policy',
    document: '01_Support_Policy_v3_CURRENT.pdf',
    accountId: 'GLOBAL',
    tier: 'Tier 2',
    keywords: ['standard cancellation', 'beacon', 'axis', '$50', '₹4000', 'baseline fee'],
    summaryRule: 'Standard cancellation fee of $50 (₹4,000) applies for cancellations requested within 24 hours of scheduled pickup.',
    confidenceScore: 0.92,
  },
  {
    clauseId: 'SOP-4.2',
    clauseNumber: 'Section 4.2',
    title: 'Standard Service Credit Schedule',
    document: '03_Cancellation_and_Service_Credit_SOP_v4.pdf',
    accountId: 'GLOBAL',
    tier: 'Tier 2',
    keywords: ['standard credit', '25%', '4.0 hours', 'beacon', 'axis', 'carrier fault'],
    summaryRule: '25% Service Credit applies only if carrier-fault delay is >= 4.0 hours from scheduled delivery window.',
    confidenceScore: 0.93,
  },
];

/**
 * Full Document Store Chunks (Tier 2 RAG - Deep Scanner for Ambiguous / Complex Inquiries)
 */
const FULL_DOCUMENT_CHUNKS: DocumentChunk[] = [
  {
    chunkId: 'NS-DOC-PAGE-4',
    document: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    accountId: 'ACC-NORTHSTAR',
    section: 'Article 4: Service Level Guarantees and Liquidated Remedies',
    pageNumber: 4,
    verbatimText: `Section 4.1 Cancellation Fee Waiver: The Customer shall have the right to cancel any scheduled shipment without penalty ($0.00 fee) provided written or electronic notification is transmitted to ParcelPilot not less than two (2.0) hours prior to the commencement of the scheduled pickup window.
Section 4.2 Carrier Fault Remediation: In the event of a verified carrier-fault delay wherein pickup or delivery exceeds the contracted time window by two point zero (2.0) hours or greater, ParcelPilot shall automatically issue a one hundred percent (100%) service credit calculated against the gross shipment billing fee.`,
  },
  {
    chunkId: 'LW-DOC-PAGE-3',
    document: '06_LumenWorks_Service_Agreement.pdf',
    accountId: 'ACC-LUMENWORKS',
    section: 'Section 3: Operations & Cancellation Terms',
    pageNumber: 3,
    verbatimText: `3.4 Carrier Delay Credits: For all scheduled shipments experiencing delay solely attributable to the contracted carrier exceeding three (3.0) continuous hours, LumenWorks is entitled to a 50% credit on the shipment fee.
3.2 Order Modifications & Cancellations: Cancellations lodged with greater than three hours notice incur a discounted administrative fee of $25.00 USD (INR 2,000). Cancellations with less notice incur the standard tier fee of $50.00 USD (INR 4,000).`,
  },
  {
    chunkId: 'DOC04-KNOWN-ISSUES',
    document: '04_Product_Operations_Guide_and_Known_Issues.pdf',
    accountId: 'ACC-NORTHSTAR',
    section: 'Section 5: Known Platform Issues & Temporary Workarounds',
    pageNumber: 8,
    verbatimText: `BUG-1092: Carrier Webhook Ingestion Delay: In rare situations, SwiftShip driver hardware scans do not trigger real-time HTTP webhooks, causing orders to remain in 'BOOKED' status for up to 25 minutes after physical driver pickup. Operations agents must verify physical carrier logs before processing cancellation requests.
BUG-1044: CSV Bulk Ingestion 70% Memory Ceiling: Bulk shipment uploads exceeding 4,000 rows experience Node worker V8 heap exhaustion at approximately 70% completion. Workaround: Advise customer to split batch files into 2,000-row chunks.`,
  },
];

export class TieredRagService {
  private static CONFIDENCE_THRESHOLD = 0.85;

  /**
   * Main query entry point: Performs fast clause summary index matching first,
   * falling back to full-document deep scans if confidence is low.
   */
  public static queryContract(params: {
    accountId: AccountId;
    topic: 'CANCELLATION' | 'SERVICE_CREDIT' | 'ESCALATION' | 'KNOWN_BUGS' | 'GENERAL';
    queryText: string;
    requiredConfidence?: number;
  }): RagQueryResult {
    const minConfidence = params.requiredConfidence ?? this.CONFIDENCE_THRESHOLD;
    const normalizedQuery = params.queryText.toLowerCase();

    // 1. Fast Clause Summary Index Retrieval (Tier 1 RAG)
    const summaryMatch = this.searchSummaryIndex(params.accountId, params.topic, normalizedQuery);

    if (summaryMatch && summaryMatch.confidenceScore >= minConfidence) {
      return {
        retrievalTier: 'CLAUSE_SUMMARY_FAST_INDEX',
        confidenceScore: summaryMatch.confidenceScore,
        clauseNumber: summaryMatch.clauseNumber,
        clauseTitle: summaryMatch.title,
        documentName: summaryMatch.document,
        legalRule: summaryMatch.summaryRule,
        governingTier: summaryMatch.tier,
        arithmeticParameters: this.extractArithmeticParameters(summaryMatch.clauseId),
      };
    }

    // 2. Low Confidence / Deep Fallback: Full-Document Deep Scan (Tier 2 RAG)
    const docMatch = this.searchFullDocumentChunks(params.accountId, normalizedQuery);

    if (docMatch) {
      return {
        retrievalTier: 'FULL_DOCUMENT_DEEP_SCAN',
        confidenceScore: 0.91,
        clauseNumber: docMatch.section,
        clauseTitle: 'Verbatim Contract Section',
        documentName: docMatch.document,
        legalRule: docMatch.verbatimText,
        verbatimSnippet: docMatch.verbatimText,
        governingTier: 'Tier 1',
      };
    }

    // Fallback: If not found, throw typed domain error
    throw new ContractClauseNotFoundError(params.accountId, params.topic);
  }

  private static searchSummaryIndex(
    accountId: AccountId,
    topic: string,
    query: string
  ): ClauseSummaryNode | null {
    // Priority: Specific customer Tier 1 matches first
    const candidates = CLAUSE_SUMMARY_INDEX.filter(
      node => node.accountId === accountId || node.accountId === 'GLOBAL'
    );

    let bestMatch: ClauseSummaryNode | null = null;
    let highestScore = 0;

    for (const node of candidates) {
      let score = 0;
      for (const keyword of node.keywords) {
        if (query.includes(keyword.toLowerCase())) {
          score += 0.2;
        }
      }
      if (topic === 'CANCELLATION' && node.clauseId.includes('4.1') || node.clauseId.includes('3.2') || node.clauseId.includes('2.1')) {
        score += 0.4;
      }
      if (topic === 'SERVICE_CREDIT' && (node.clauseId.includes('4.2') || node.clauseId.includes('3.4') || node.clauseId.includes('4.2'))) {
        score += 0.4;
      }

      // Prioritize customer specific Tier 1
      if (node.accountId === accountId) {
        score += 0.3;
      }

      const normalizedScore = Math.min(score, node.confidenceScore);
      if (normalizedScore > highestScore) {
        highestScore = normalizedScore;
        bestMatch = { ...node, confidenceScore: normalizedScore };
      }
    }

    return bestMatch;
  }

  private static searchFullDocumentChunks(
    accountId: AccountId,
    query: string
  ): DocumentChunk | null {
    const chunks = FULL_DOCUMENT_CHUNKS.filter(
      c => c.accountId === accountId || c.accountId === 'ACC-NORTHSTAR'
    );

    for (const chunk of chunks) {
      if (
        query.includes('webhook') ||
        query.includes('driver') ||
        query.includes('csv') ||
        query.includes('heap') ||
        query.includes('article 4') ||
        query.includes('section 3')
      ) {
        return chunk;
      }
    }

    return chunks[0] || null;
  }

  private static extractArithmeticParameters(clauseId: string) {
    switch (clauseId) {
      case 'NS-4.1':
        return { thresholdHours: 2.0, feeWaiverEligible: true, cancellationFeeUSD: 0, cancellationFeeINR: 0 };
      case 'NS-4.2':
        return { thresholdHours: 2.0, creditPercentage: 100 };
      case 'LW-3.4':
        return { thresholdHours: 3.0, creditPercentage: 50 };
      case 'LW-3.2':
        return { thresholdHours: 3.0, feeWaiverEligible: false, cancellationFeeUSD: 25, cancellationFeeINR: 2000 };
      case 'SOP-2.1':
        return { thresholdHours: 24.0, feeWaiverEligible: false, cancellationFeeUSD: 50, cancellationFeeINR: 4000 };
      case 'SOP-4.2':
        return { thresholdHours: 4.0, creditPercentage: 25 };
      default:
        return undefined;
    }
  }
}
