import { SchemaValidationError } from './errors';
import { AccountId } from '../types';

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
] as const;

export type AllowedClauseTopic = typeof ALLOWED_CLAUSE_TOPICS[number];

/**
 * Formal JSON Schema definition for get_contract_clause tool
 */
export const GET_CONTRACT_CLAUSE_TOOL_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'GetContractClauseParameters',
  type: 'object',
  additionalProperties: false,
  required: ['account_id', 'clause_topic'],
  properties: {
    account_id: {
      type: 'string',
      enum: ALLOWED_ACCOUNT_IDS,
      description: 'The authoritative enterprise account identifier to fetch binding contract clauses for.',
    },
    clause_topic: {
      type: 'string',
      enum: ALLOWED_CLAUSE_TOPICS,
      description: 'Strictly validated domain topic. Freeform injection strings are rejected.',
    },
    minimum_confidence: {
      type: 'number',
      minimum: 0.0,
      maximum: 1.0,
      default: 0.85,
      description: 'Minimum confidence score required before triggering deep document chunk fallback.',
    },
    include_verbatim_text: {
      type: 'boolean',
      default: false,
      description: 'Whether to include verbatim PDF contract excerpts alongside summary arithmetic.',
    },
  },
} as const;

export interface GetContractClauseInput {
  account_id: AllowedAccountId;
  clause_topic: AllowedClauseTopic;
  minimum_confidence?: number;
  include_verbatim_text?: boolean;
}

export class ContractToolValidator {
  /**
   * Authoritatively normalizes and validates parameters against the JSON schema,
   * preventing prompt injection and freeform text bypasses.
   */
  public static validate(input: unknown): GetContractClauseInput {
    if (!input || typeof input !== 'object') {
      throw new SchemaValidationError('get_contract_clause', ['Input parameters must be a non-null JSON object.']);
    }

    const raw = input as Record<string, any>;
    const errors: string[] = [];

    // Account ID validation
    if (!raw.account_id) {
      errors.push("Missing required parameter: 'account_id'");
    } else if (!ALLOWED_ACCOUNT_IDS.includes(raw.account_id)) {
      errors.push(
        `Invalid 'account_id': '${raw.account_id}'. Allowed values: ${ALLOWED_ACCOUNT_IDS.join(', ')}`
      );
    }

    // Clause Topic validation
    if (!raw.clause_topic) {
      errors.push("Missing required parameter: 'clause_topic'");
    } else if (!ALLOWED_CLAUSE_TOPICS.includes(raw.clause_topic)) {
      errors.push(
        `Invalid 'clause_topic': '${raw.clause_topic}'. Allowed values: ${ALLOWED_CLAUSE_TOPICS.join(', ')}. Freeform prompt text is prohibited.`
      );
    }

    // Check for unexpected extra properties (additionalProperties: false)
    const allowedKeys = ['account_id', 'clause_topic', 'minimum_confidence', 'include_verbatim_text'];
    for (const key of Object.keys(raw)) {
      if (!allowedKeys.includes(key)) {
        errors.push(`Disallowed extra property detected: '${key}'. Schema prohibits extraneous parameters.`);
      }
    }

    if (errors.length > 0) {
      throw new SchemaValidationError('get_contract_clause', errors);
    }

    // Map ACCT-xxx aliases to standard internal IDs
    let normalizedAccountId = raw.account_id as AllowedAccountId;
    if (normalizedAccountId === 'ACCT-001') normalizedAccountId = 'ACC-NORTHSTAR' as any;
    if (normalizedAccountId === 'ACCT-002') normalizedAccountId = 'ACC-LUMENWORKS' as any;
    if (normalizedAccountId === 'ACCT-003') normalizedAccountId = 'ACC-BEACON' as any;
    if (normalizedAccountId === 'ACCT-004') normalizedAccountId = 'ACC-AXIS' as any;

    return {
      account_id: normalizedAccountId,
      clause_topic: raw.clause_topic,
      minimum_confidence: typeof raw.minimum_confidence === 'number' ? raw.minimum_confidence : 0.85,
      include_verbatim_text: Boolean(raw.include_verbatim_text),
    };
  }
}
