import { FunctionDeclaration, Type } from '@google/genai';
import { AccountId, Order, Ticket, UserRole, StagedStateAction, ToolCall } from '../types';
import { toolEngine, OrderLookupResult, PolicyAuditResult } from './toolEngine';
import { ACCOUNTS } from '../data/mockData';

/**
 * Official Gemini 3.5 Flash Function Declarations for AegisOps
 */

export const lookupOrderDataDeclaration: FunctionDeclaration = {
  name: 'lookup_order_data',
  description: 'Fetch real-time operational data for a freight order or consignment, evaluating RBAC tenant isolation boundaries and calculating delay and notice lead times relative to the snapshot clock (2026-08-16 11:00 IST).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      order_id: {
        type: Type.STRING,
        description: 'Authoritative order identifier, e.g. ORD-1001, ORD-2002, ORD-3001, ORD-4001.'
      },
      session_account_id: {
        type: Type.STRING,
        description: 'Active tenant account session ID, e.g. ACC-NORTHSTAR, ACC-LUMENWORKS, ACC-BEACON, ACC-AXIS.'
      },
      role: {
        type: Type.STRING,
        description: 'User permission role in current session: "customer" or "internal_ops".'
      }
    },
    required: ['order_id', 'session_account_id', 'role']
  }
};

export const auditPolicyEntitlementsDeclaration: FunctionDeclaration = {
  name: 'audit_policy_entitlements',
  description: 'Evaluates the 3-tier contract precedence hierarchy (Tier 1 Customer Enterprise Agreement > Tier 2 Active SOP v4; Tier 3 Deprecated v2 Quarantined) to calculate financial credits or cancellation fees.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      account_id: {
        type: Type.STRING,
        description: 'Authoritative enterprise account ID being audited (e.g. ACC-NORTHSTAR, ACC-LUMENWORKS, ACC-BEACON, ACC-AXIS).'
      },
      query_type: {
        type: Type.STRING,
        description: 'Evaluation domain: "credit", "cancellation", or "auto_detect".'
      },
      delay_hours: {
        type: Type.NUMBER,
        description: 'Calculated carrier delay in hours beyond scheduled delivery or pickup window.'
      },
      carrier_fault: {
        type: Type.BOOLEAN,
        description: 'Whether the operational delay is attributable to carrier fault.'
      }
    },
    required: ['account_id', 'query_type']
  }
};

export const stageStateActionDeclaration: FunctionDeclaration = {
  name: 'stage_state_action',
  description: 'Stages an operational mutation (ISSUE_SERVICE_CREDIT, CANCEL_SHIPMENT, ESCALATE_TICKET) into the Human-in-the-Loop Amber Approval Gate for operator confirmation prior to committing to Firestore ledger.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action_type: {
        type: Type.STRING,
        description: 'State action type: "ISSUE_SERVICE_CREDIT", "CANCEL_SHIPMENT", or "ESCALATE_TICKET".'
      },
      target_id: {
        type: Type.STRING,
        description: 'Order ID (e.g. ORD-1001, ORD-2002) or Ticket ID (e.g. TKT-501).'
      },
      amount_inr: {
        type: Type.NUMBER,
        description: 'Credit amount or cancellation fee in INR (₹).'
      },
      reason: {
        type: Type.STRING,
        description: 'Contractual justification citing governing agreement clause or active SOP.'
      }
    },
    required: ['action_type', 'target_id', 'amount_inr', 'reason']
  }
};

export const radarAnomalyScanDeclaration: FunctionDeclaration = {
  name: 'radar_anomaly_scan',
  description: 'Executes a network-wide carrier performance scan across all tenant feeds, isolating carrier delay clusters (>= 2.0h) and flagging critical SEV-0/SEV-1 security and webhook outages.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      scan_scope: {
        type: Type.STRING,
        description: 'Scope of anomaly scan, default "ALL_TENANTS".'
      }
    }
  }
};

export const AEGIS_GEMINI_TOOLS = [
  lookupOrderDataDeclaration,
  auditPolicyEntitlementsDeclaration,
  stageStateActionDeclaration,
  radarAnomalyScanDeclaration
];

export const AEGIS_SYSTEM_INSTRUCTION = `You are the AegisOps Autonomous Support & Operations Engine for B2B logistics.
Reference Snapshot Clock: 2026-08-16 11:00 Asia/Kolkata (2026-08-16 11:00 IST / 2026-08-16T05:30:00Z).
Base Currency: INR (₹), with exchange rate reference of 1 USD = 84.0 INR (₹4,200 = $50, ₹1,200 = $15, ₹2,400 = $30).

3-Tier Precedence Hierarchy (MANDATORY):
1. Tier 1 (Customer Enterprise Agreements - Highest Precedence):
   - Northstar Logistics (05_Northstar_Logistics_Enterprise_Agreement.pdf):
     * Clause 4.1: Waives 100% cancellation fee ($0 / ₹0) IF cancellation notice is >= 2.0 hours prior to scheduled pickup window start. Notice < 2.0h incurs standard fee ₹4,200 ($50).
     * Clause 4.2: 100% Service Credit for carrier-fault delay >= 2.0 hours from scheduled delivery window.
   - LumenWorks (06_LumenWorks_Service_Agreement.pdf):
     * Clause 3.4: 50% Service Credit for carrier-fault delay >= 3.0 hours.
     * Clause 3.2: Reduced cancellation fee of $25 (₹2,000) when notice >= 3.0 hours.
2. Tier 2 (Current SOPs & Guides - Active Baseline):
   - 03_Cancellation_and_Service_Credit_SOP_v4.pdf & 01_Support_Policy_v3_CURRENT.pdf:
     * Standard $50 (₹4,200) fee for cancellations within 24h.
     * 25% Service credit only if carrier delay >= 4.0 hours for non-enterprise accounts.
   - 04_Product_Operations_Guide_and_Known_Issues.pdf (BUG-1092 SwiftShip webhook delay, BUG-1044 CSV memory ceiling).
3. Tier 3 (Deprecated Guidance - STRICTLY QUARANTINED):
   - 02_Support_Policy_v2_DEPRECATED.pdf (10% discretionary credit, 60-minute grace window) and past support ticket notes.
   - NEVER apply Tier 3 rules or 60-minute grace periods. Explicitly defend and quarantine deprecated claims.

Operational Execution Protocol:
- When handling order queries, cancellations, delay disputes, or RBAC audits:
  1. Call lookup_order_data(order_id, session_account_id, role).
  2. If RBAC violation occurs (customer role trying to access another tenant), strictly block with a security boundary denial.
  3. Call audit_policy_entitlements(account_id, query_type, delay_hours, carrier_fault) using governing Tier 1 / Tier 2 clauses.
  4. If a state change is warranted, call stage_state_action(action_type, target_id, amount_inr, reason) into the Amber Approval Gate.
- Format final responses with clean Markdown, bold headers, operational timestamps, and clear arithmetic breakdowns.`;
