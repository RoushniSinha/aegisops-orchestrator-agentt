import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CommittedExecutionLog, AccountId, UserRole, Currency } from '../types';
import { ACCOUNTS, SYSTEM_REFERENCE_TIME } from '../data/mockData';

export interface PDFExportOptions {
  logs: CommittedExecutionLog[];
  activeAccountId: AccountId | string;
  role: UserRole | string;
  currency: Currency;
  filterAccount?: string;
  filterActionType?: string;
  dateRangeLabel?: string;
}

export function exportLedgerToPDF({
  logs,
  activeAccountId,
  role,
  currency,
  filterAccount = 'ALL',
  filterActionType = 'ALL',
  dateRangeLabel = 'Complete Session Audit'
}: PDFExportOptions): void {
  // Create landscape A4 document for rich tabular audit layout
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accountInfo = ACCOUNTS[activeAccountId];

  // Colors
  const primaryNavy = [15, 23, 42]; // #0f172a
  const emeraldGreen = [5, 150, 105]; // #059669
  const slateMuted = [100, 116, 139]; // #64748b
  const amberAccent = [217, 119, 6]; // #d97706
  const lightBg = [248, 250, 252]; // #f8fafc

  // =========================================================================
  // 1. HEADER BANNER & BRANDING
  // =========================================================================
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 0, pageWidth, 75, 'F');

  // Emerald Top Accent Line
  doc.setFillColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PARCELPILOT AUTONOMOUS SUPPORT & OPERATIONS', 35, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Official Immutable Operational Ledger & State Changes Audit Report', 35, 48);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Reference Clock: ${SYSTEM_REFERENCE_TIME}  |  3-Tier Precedence Policy Enforced`, 35, 62);

  // Top Right Metadata Pill
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - 210, 15, 175, 46, 4, 4, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('GENERATED ON', pageWidth - 200, 27);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC', pageWidth - 200, 39);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(52, 211, 153);
  doc.text('● PERSISTED TO FIRESTORE', pageWidth - 200, 52);

  // =========================================================================
  // 2. EXECUTIVE METRICS & FILTER SUMMARY
  // =========================================================================
  const summaryTop = 90;

  // Filter logs according to view parameters
  const filteredLogs = logs.filter(log => {
    const matchAcc = filterAccount === 'ALL' || log.account_id === filterAccount;
    const matchType = filterActionType === 'ALL' || log.action_type === filterActionType;
    return matchAcc && matchType;
  });

  const totalCreditsUSD = filteredLogs.reduce((acc, l) => acc + (l.amountUSD || 0), 0);
  const totalCreditsINR = filteredLogs.reduce((acc, l) => acc + (l.amountINR || ((l.amountUSD || 0) * 84)), 0);
  const totalFeesUSD = filteredLogs.reduce((acc, l) => acc + (l.feeUSD || 0), 0);
  const totalFeesINR = filteredLogs.reduce((acc, l) => acc + (l.feeINR || ((l.feeUSD || 0) * 84)), 0);

  // 4 Metric Boxes
  const cardWidth = (pageWidth - 70 - 36) / 4;
  const cardHeight = 48;

  const metrics = [
    {
      label: 'TOTAL EXECUTED ACTIONS',
      value: `${filteredLogs.length} COMMITS`,
      sub: `Filter: ${filterActionType === 'ALL' ? 'All Types' : filterActionType}`,
      color: primaryNavy
    },
    {
      label: 'TOTAL CREDITS ISSUED',
      value: currency === 'USD' ? `$${totalCreditsUSD.toFixed(2)}` : `₹${totalCreditsINR.toLocaleString()}`,
      sub: `${filteredLogs.filter(l => (l.amountUSD || 0) > 0).length} Credit Notes`,
      color: emeraldGreen
    },
    {
      label: 'TOTAL FEES ASSESSED',
      value: currency === 'USD' ? `$${totalFeesUSD.toFixed(2)}` : `₹${totalFeesINR.toLocaleString()}`,
      sub: `${filteredLogs.filter(l => (l.feeUSD || 0) > 0).length} Cancellation Fees`,
      color: amberAccent
    },
    {
      label: 'ACTIVE TENANT & ROLE',
      value: accountInfo?.name ? accountInfo.name.substring(0, 16) : activeAccountId,
      sub: `Operator: ${role.toUpperCase()}`,
      color: slateMuted
    }
  ];

  metrics.forEach((m, idx) => {
    const x = 35 + idx * (cardWidth + 12);
    
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, summaryTop, cardWidth, cardHeight, 4, 4, 'FD');

    // Left color bar
    doc.setFillColor(m.color[0], m.color[1], m.color[2]);
    doc.rect(x, summaryTop, 3.5, cardHeight, 'F');

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(m.label, x + 10, summaryTop + 14);

    doc.setFontSize(11.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(m.value, x + 10, summaryTop + 29);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(m.sub, x + 10, summaryTop + 41);
  });

  // =========================================================================
  // 3. COMMITTED LEDGER TABLE (autoTable)
  // =========================================================================
  const tableData = filteredLogs.map((log, index) => {
    const formattedCredit = currency === 'USD' 
      ? (log.amountUSD !== undefined && log.amountUSD > 0 ? `$${log.amountUSD.toFixed(2)}` : '-')
      : (log.amountINR !== undefined && log.amountINR > 0 ? `₹${log.amountINR.toLocaleString()}` : '-');

    const formattedFee = currency === 'USD'
      ? (log.feeUSD !== undefined && log.feeUSD > 0 ? `$${log.feeUSD.toFixed(2)}` : '-')
      : (log.feeINR !== undefined && log.feeINR > 0 ? `₹${log.feeINR.toLocaleString()}` : '-');

    const accountName = ACCOUNTS[log.account_id]?.name || log.account_id;

    return [
      `#${index + 1}\n${log.txHash ? log.txHash.substring(0, 12) : log.id.substring(0, 8)}`,
      `${log.timestamp}\n[Ref: 2026-03-01]`,
      log.action_type.replace(/_/g, ' '),
      `${log.target_id}\n${accountName}`,
      formattedCredit,
      formattedFee,
      `${log.tierLevel || 'Tier 1 / 2'}\n${log.citation || 'Governing SLA Policy'}`,
      log.details || 'Automated compliance rule commit',
      log.operatorEmail || 'system-operator'
    ];
  });

  if (tableData.length === 0) {
    tableData.push([
      'N/A',
      new Date().toLocaleDateString(),
      'NO ENTRIES FOUND',
      'No state changes match current filters',
      '-',
      '-',
      '-',
      'No committed ledger entries in current view scope',
      '-'
    ]);
  }

  autoTable(doc, {
    startY: summaryTop + cardHeight + 14,
    head: [[
      'TX Hash / ID',
      'Timestamp',
      'Action Type',
      'Target / Account',
      `Credit (${currency})`,
      `Fee (${currency})`,
      'Precedence & Citation',
      'Operational Justification',
      'Operator Signature'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 4.5,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 70, font: 'courier', fontStyle: 'bold' },
      1: { cellWidth: 75, fontSize: 7 },
      2: { cellWidth: 85, fontStyle: 'bold', textColor: [5, 150, 105] },
      3: { cellWidth: 95 },
      4: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 55, halign: 'right' },
      6: { cellWidth: 120, fontSize: 7 },
      7: { cellWidth: 'auto' },
      8: { cellWidth: 85, font: 'courier', fontSize: 6.8 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      // FOOTER
      const totalPages = doc.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      // Left footer
      doc.text(
        'ParcelPilot Autonomous Operations Engine • Immutable Ledger Collection `ledger_entries` in Firestore',
        35,
        pageHeight - 16
      );

      // Right footer
      doc.text(
        `Page ${currentPage} of ${totalPages}  |  CONFIDENTIAL & GOVERNED BY ENTERPRISE SLA`,
        pageWidth - 250,
        pageHeight - 16
      );

      // Bottom dividing line
      doc.setDrawColor(226, 232, 240);
      doc.line(35, pageHeight - 24, pageWidth - 35, pageHeight - 24);
    },
    margin: { top: 75, left: 35, right: 35, bottom: 35 }
  });

  // Save the generated PDF report
  const filename = `parcelpilot_ledger_report_${activeAccountId}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
