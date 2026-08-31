import { ChatMessage, CommittedExecutionLog, AccountId, UserRole, Currency } from '../types';
import { ACCOUNTS, SYSTEM_REFERENCE_TIME } from '../data/mockData';

/**
 * Escapes a single string field for safe RFC-4180 compliant CSV output.
 */
function escapeCSVCell(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const stringValue = String(value);
  // Replace internal double quotes with double-double quotes
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

export interface CSVExportOptions {
  messages: ChatMessage[];
  committedLogs?: CommittedExecutionLog[];
  activeAccountId: AccountId | string;
  role: UserRole | string;
  currency: Currency;
}

/**
 * Generates and triggers download of a structured CSV report containing
 * both the Chat Conversation log and the Operations & Ledger Action trail.
 */
export function exportChatAndLedgerToCSV({
  messages,
  committedLogs = [],
  activeAccountId,
  role,
  currency
}: CSVExportOptions): void {
  const accountInfo = ACCOUNTS[activeAccountId];
  const nowISO = new Date().toISOString();
  const fileDateStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `parcelpilot_audit_report_${activeAccountId}_${fileDateStamp}.csv`;

  const rows: string[] = [];

  // ==========================================
  // 1. SYSTEM & REPORT METADATA
  // ==========================================
  rows.push(['# PARCELPILOT AUTONOMOUS SUPPORT & OPERATIONS REPORT'].map(escapeCSVCell).join(','));
  rows.push(['Metadata Attribute', 'Value'].map(escapeCSVCell).join(','));
  rows.push(['Export Timestamp (UTC)', nowISO].map(escapeCSVCell).join(','));
  rows.push(['Snapshot Reference Clock', SYSTEM_REFERENCE_TIME].map(escapeCSVCell).join(','));
  rows.push(['Active Tenant ID', activeAccountId].map(escapeCSVCell).join(','));
  rows.push(['Active Tenant Name', accountInfo?.name || activeAccountId].map(escapeCSVCell).join(','));
  rows.push(['Active Plan / Tier', accountInfo?.tier || 'Enterprise Tier 1'].map(escapeCSVCell).join(','));
  rows.push(['Operator Role', role].map(escapeCSVCell).join(','));
  rows.push(['Reporting Currency', currency].map(escapeCSVCell).join(','));
  rows.push(['Total Messages in Thread', messages.length].map(escapeCSVCell).join(','));
  rows.push(['Total Committed Ledger Actions', committedLogs.length].map(escapeCSVCell).join(','));
  rows.push(''); // Empty line separator

  // ==========================================
  // 2. CHAT CONVERSATION LOG
  // ==========================================
  rows.push(['SECTION 1: CHAT CONVERSATION HISTORY'].map(escapeCSVCell).join(','));
  const chatHeaders = [
    'Message #',
    'Message ID',
    'Timestamp',
    'Sender',
    'Text Content',
    'Tool Calls Count',
    'Executed Tools Summary',
    'Flag / Notice'
  ];
  rows.push(chatHeaders.map(escapeCSVCell).join(','));

  messages.forEach((msg, idx) => {
    let toolsSummary = 'None';
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      toolsSummary = msg.toolCalls
        .map(t => `${t.name} (${t.status})`)
        .join('; ');
    }

    let flag = 'Normal';
    if (msg.isWarning) flag = 'Warning / Security Alert';
    if (msg.isSuccess) flag = 'Action Confirmed';

    rows.push([
      idx + 1,
      msg.id,
      msg.timestamp,
      msg.sender.toUpperCase(),
      msg.text,
      msg.toolCalls?.length || 0,
      toolsSummary,
      flag
    ].map(escapeCSVCell).join(','));
  });

  rows.push(''); // Empty line separator

  // ==========================================
  // 3. COMMITTED LEDGER ACTIONS & STATE AUDIT
  // ==========================================
  rows.push(['SECTION 2: COMMITTED OPERATIONS & LEDGER ACTIONS'].map(escapeCSVCell).join(','));
  const ledgerHeaders = [
    'Entry #',
    'Transaction Hash',
    'Firestore Doc ID',
    'Timestamp',
    'Action Type',
    'Target ID',
    'Account ID',
    'Credit Amount (USD)',
    'Credit Amount (INR)',
    'Cancellation Fee (USD)',
    'Cancellation Fee (INR)',
    'Precedence Tier',
    'Governing Citation',
    'Details / Justification',
    'Operator'
  ];
  rows.push(ledgerHeaders.map(escapeCSVCell).join(','));

  if (committedLogs.length === 0) {
    rows.push([
      'N/A',
      'No committed ledger actions in current session',
      '-',
      '-',
      '-',
      '-',
      '-',
      '0',
      '0',
      '0',
      '0',
      '-',
      '-',
      'No state changes executed yet',
      '-'
    ].map(escapeCSVCell).join(','));
  } else {
    committedLogs.forEach((log, idx) => {
      rows.push([
        idx + 1,
        log.txHash || `TXN-${log.id}`,
        log.id,
        log.timestamp,
        log.action_type,
        log.target_id,
        log.account_id,
        log.amountUSD !== undefined ? `$${log.amountUSD.toFixed(2)}` : '$0.00',
        log.amountINR !== undefined ? `₹${log.amountINR.toLocaleString()}` : '₹0',
        log.feeUSD !== undefined ? `$${log.feeUSD.toFixed(2)}` : '$0.00',
        log.feeINR !== undefined ? `₹${log.feeINR.toLocaleString()}` : '₹0',
        log.tierLevel || 'Tier 1 / Tier 2',
        log.citation || 'Standard Policy',
        log.details || '-',
        log.operatorEmail || 'system_operator'
      ].map(escapeCSVCell).join(','));
    });
  }

  // Prepend UTF-8 Byte Order Mark (BOM) so Excel properly parses non-ASCII chars (like ₹)
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // Trigger browser download
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
