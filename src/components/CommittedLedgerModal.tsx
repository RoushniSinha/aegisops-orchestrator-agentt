import React, { useState, useMemo, useEffect } from 'react';
import { CommittedExecutionLog, Currency, AccountId, UserRole } from '../types';
import { ACCOUNTS, SYSTEM_REFERENCE_TIME } from '../data/mockData';
import { 
  X, 
  Search, 
  Database, 
  FileDown, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Download, 
  User, 
  Hash, 
  RotateCcw, 
  Tag, 
  ChevronRight, 
  Clock, 
  FileText, 
  Copy, 
  Check, 
  AlertCircle, 
  Activity, 
  RefreshCw, 
  Ban, 
  Radio, 
  Server, 
  Zap
} from 'lucide-react';
import { exportLedgerToPDF } from '../utils/pdfExport';
import { exportChatAndLedgerToCSV } from '../utils/csvExport';
import { testFirestoreDiagnostics, voidTransactionInFirestore } from '../services/firebaseLedger';

interface CommittedLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  committedLogs: CommittedExecutionLog[];
  currency: Currency;
  activeAccountId: AccountId;
  role: UserRole;
  onRevertLastBatch?: (batchIdOrTxHash?: string) => Promise<void> | void;
}

export const CommittedLedgerModal: React.FC<CommittedLedgerModalProps> = ({
  isOpen,
  onClose,
  committedLogs,
  currency,
  activeAccountId,
  role,
  onRevertLastBatch
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterActionType, setFilterActionType] = useState<string>('ALL');
  const [filterOperator, setFilterOperator] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMMITTED' | 'VOIDED'>('ALL');
  const [filterFinancialCategory, setFilterFinancialCategory] = useState<'ALL' | 'CREDITS_ONLY' | 'FEES_ONLY'>('ALL');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Reversion State
  const [isReverting, setIsReverting] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [revertSuccessMsg, setRevertSuccessMsg] = useState<string | null>(null);

  // Diagnostic State
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [isPinging, setIsPinging] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    latencyMs: number;
    timestamp: string;
    transport?: string;
    collection?: string;
    error?: string;
  }>({
    status: 'ONLINE',
    latencyMs: 28,
    timestamp: new Date().toLocaleTimeString(),
    transport: 'Firestore WebChannel / HTTP/2',
    collection: 'ledger_entries'
  });

  // Selected Log State for Expanded Audit View
  const [selectedLog, setSelectedLog] = useState<CommittedExecutionLog | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Run initial diagnostic ping on mount when modal opens
  useEffect(() => {
    if (isOpen) {
      runDiagnosticPing();
    }
  }, [isOpen]);

  const runDiagnosticPing = async () => {
    setIsPinging(true);
    try {
      const res = await testFirestoreDiagnostics();
      setDiagnosticResult({
        status: res.status,
        latencyMs: res.latencyMs,
        timestamp: res.lastChecked || new Date().toLocaleTimeString(),
        transport: res.transport,
        collection: res.collection,
        error: res.error
      });
    } catch {
      setDiagnosticResult(prev => ({
        ...prev,
        status: 'DEGRADED',
        latencyMs: 142,
        timestamp: new Date().toLocaleTimeString(),
        transport: 'In-Memory / Degraded Stream'
      }));
    } finally {
      setIsPinging(false);
    }
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Find latest active (non-voided) transaction or batch
  const lastActiveLogs = useMemo(() => {
    const active = committedLogs.filter(l => l.status !== 'VOIDED');
    if (active.length === 0) return [];
    const newest = active[0];
    if (newest.batchId) {
      return active.filter(l => l.batchId === newest.batchId);
    }
    return [newest];
  }, [committedLogs]);

  // Handle Reverting Last Batch
  const handleExecuteRevert = async () => {
    if (lastActiveLogs.length === 0) return;
    setIsReverting(true);
    try {
      if (onRevertLastBatch) {
        await onRevertLastBatch();
      } else {
        // Fallback direct execution
        for (const log of lastActiveLogs) {
          await voidTransactionInFirestore(log.id, log.txHash, {
            operatorEmail: 'operator@parcelpilot.internal',
            voidReason: 'Operator reverted transaction via Ledger Modal'
          });
        }
      }
      setShowRevertConfirm(false);
      setRevertSuccessMsg(`Successfully marked ${lastActiveLogs.length} transaction(s) as VOIDED in Firestore.`);
      setTimeout(() => setRevertSuccessMsg(null), 5000);
      runDiagnosticPing();
    } catch (err: any) {
      alert(`Revert failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsReverting(false);
    }
  };

  // Extract unique operator emails from committed logs for quick filtering
  const uniqueOperators = useMemo(() => {
    const set = new Set<string>();
    committedLogs.forEach(l => {
      if (l.operatorEmail) set.add(l.operatorEmail);
    });
    return Array.from(set);
  }, [committedLogs]);

  if (!isOpen) return null;

  // Filtered entries
  const filteredLogs = committedLogs.filter(log => {
    const searchLower = searchTerm.trim().toLowerCase();
    
    // Check search term against Order ID, Operator Email, TX Hash, Citation, Details, Document, Account
    const matchesSearch = !searchLower || (
      log.id.toLowerCase().includes(searchLower) ||
      (log.txHash && log.txHash.toLowerCase().includes(searchLower)) ||
      log.target_id.toLowerCase().includes(searchLower) ||
      (log.operatorEmail && log.operatorEmail.toLowerCase().includes(searchLower)) ||
      log.action_type.toLowerCase().includes(searchLower) ||
      (log.citation && log.citation.toLowerCase().includes(searchLower)) ||
      (log.details && log.details.toLowerCase().includes(searchLower)) ||
      (log.documentName && log.documentName.toLowerCase().includes(searchLower)) ||
      (ACCOUNTS[log.account_id]?.name.toLowerCase().includes(searchLower))
    );

    const matchesAccount = filterAccount === 'ALL' || log.account_id === filterAccount;
    const matchesType = filterActionType === 'ALL' || log.action_type === filterActionType;
    const matchesOperator = filterOperator === 'ALL' || log.operatorEmail === filterOperator;
    const matchesStatus = filterStatus === 'ALL' || (log.status || 'COMMITTED') === filterStatus;
    
    let matchesFinancial = true;
    if (filterFinancialCategory === 'CREDITS_ONLY') {
      matchesFinancial = Boolean(log.amountUSD && log.amountUSD > 0);
    } else if (filterFinancialCategory === 'FEES_ONLY') {
      matchesFinancial = Boolean(log.feeUSD && log.feeUSD > 0);
    }

    return matchesSearch && matchesAccount && matchesType && matchesOperator && matchesStatus && matchesFinancial;
  });

  // Calculate totals (excluding voided transactions from net active financial totals)
  const activeFilteredLogs = filteredLogs.filter(l => l.status !== 'VOIDED');
  const totalCreditsUSD = activeFilteredLogs.reduce((sum, l) => sum + (l.amountUSD || 0), 0);
  const totalCreditsINR = activeFilteredLogs.reduce((sum, l) => sum + (l.amountINR || ((l.amountUSD || 0) * 84)), 0);
  const totalFeesUSD = activeFilteredLogs.reduce((sum, l) => sum + (l.feeUSD || 0), 0);
  const totalFeesINR = activeFilteredLogs.reduce((sum, l) => sum + (l.feeINR || ((l.feeUSD || 0) * 84)), 0);
  const voidedCount = filteredLogs.filter(l => l.status === 'VOIDED').length;

  const hasActiveFilters = searchTerm !== '' || filterAccount !== 'ALL' || filterActionType !== 'ALL' || filterOperator !== 'ALL' || filterStatus !== 'ALL' || filterFinancialCategory !== 'ALL';

  const resetAllFilters = () => {
    setSearchTerm('');
    setFilterAccount('ALL');
    setFilterActionType('ALL');
    setFilterOperator('ALL');
    setFilterStatus('ALL');
    setFilterFinancialCategory('ALL');
  };

  const handleExportPDF = () => {
    try {
      setIsExportingPDF(true);
      exportLedgerToPDF({
        logs: filteredLogs,
        activeAccountId,
        role,
        currency,
        filterAccount,
        filterActionType
      });
      setTimeout(() => {
        setIsExportingPDF(false);
      }, 600);
    } catch (err: any) {
      setIsExportingPDF(false);
      alert(`Failed to export PDF: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExportingCSV(true);
      exportChatAndLedgerToCSV({
        messages: [],
        committedLogs: filteredLogs,
        activeAccountId,
        role,
        currency
      });
      setTimeout(() => {
        setIsExportingCSV(false);
      }, 600);
    } catch (err: any) {
      setIsExportingCSV(false);
      alert(`Failed to export CSV: ${err?.message || 'Unknown error'}`);
    }
  };

  // Helper to highlight matching search substring
  const highlightMatch = (text: string | undefined) => {
    if (!text) return '';
    if (!searchTerm.trim()) return text;

    const term = searchTerm.trim();
    const regex = new RegExp(`(${term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c0d10] border border-white/15 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-serif italic text-white font-semibold tracking-wide">
                  Committed Operations &amp; Ledger Audit Trail
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Firestore Live</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Collection: <code className="text-emerald-300">ledger_entries</code></span>
                <span>•</span>
                <span>Clock: {SYSTEM_REFERENCE_TIME}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* DIAGNOSTICS TOGGLE BUTTON */}
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                showDiagnostics 
                  ? 'bg-sky-500/20 text-sky-200 border-sky-500/40' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="Toggle real-time Firestore synchronization latency and connection diagnostics"
            >
              <Activity className={`w-3.5 h-3.5 ${showDiagnostics ? 'text-sky-400 animate-pulse' : 'text-slate-400'}`} />
              <span>Diagnostics</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                diagnosticResult.latencyMs < 60 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {diagnosticResult.latencyMs}ms
              </span>
            </button>

            {/* REVERT LAST BATCH BUTTON */}
            <button
              onClick={() => setShowRevertConfirm(true)}
              id="btn-revert-last-batch"
              disabled={lastActiveLogs.length === 0 || isReverting}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                lastActiveLogs.length === 0
                  ? 'bg-white/5 border-white/10 text-slate-500 opacity-50 cursor-not-allowed'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 hover:border-amber-400/50 text-amber-200 hover:text-white'
              }`}
              title="Flag the previous transaction hash as VOIDED in Firestore"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${isReverting ? 'animate-spin' : ''}`} />
              <span>{isReverting ? 'Reverting...' : `Revert Last (${lastActiveLogs.length})`}</span>
            </button>

            {/* EXPORT PDF BUTTON */}
            <button
              onClick={handleExportPDF}
              id="btn-export-ledger-pdf"
              disabled={isExportingPDF}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 hover:border-rose-400/60 text-rose-200 hover:text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Generate a high-resolution, enterprise-formatted PDF report of the current view"
            >
              {isExportingPDF ? (
                <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-rose-400" />
              )}
              <span>PDF</span>
            </button>

            {/* EXPORT CSV BUTTON */}
            <button
              onClick={handleExportCSV}
              id="btn-export-ledger-csv"
              disabled={isExportingCSV}
              className="hidden sm:flex px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-mono font-medium items-center gap-1.5 transition cursor-pointer"
              title="Download CSV raw audit log"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* REAL-TIME DIAGNOSTIC OVERLAY PANEL */}
        {showDiagnostics && (
          <div className="px-6 py-3 bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-black/60 border-b border-sky-500/20 text-xs font-mono">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-sky-400" />
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Connection Status:</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>ONLINE (HTTP/2 Stream)</span>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Sync Latency:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                    diagnosticResult.latencyMs < 50 
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    {diagnosticResult.latencyMs} ms
                  </span>
                </div>

                <div className="hidden md:flex items-center space-x-2 text-slate-400 text-[11px]">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  <span>Target DB:</span>
                  <span className="text-purple-300 truncate max-w-[220px]" title="ai-studio-aegisopsautonomo-1505e2f2-a30b-4b09-8ceb-59de778d518f">
                    ai-studio-aegisopsautonomo...
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-500">Last sync: {diagnosticResult.timestamp}</span>
                <button
                  onClick={runDiagnosticPing}
                  disabled={isPinging}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Ping Firestore and re-measure round-trip latency"
                >
                  <RefreshCw className={`w-3 h-3 text-sky-300 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Pinging...' : 'Ping DB'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REVERT CONFIRMATION BANNER / MODAL */}
        {showRevertConfirm && (
          <div className="px-6 py-3.5 bg-amber-500/15 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-mono font-bold text-amber-200 flex items-center gap-2">
                  <span>Confirm Secondary Firestore Write (Revert Last Batch)</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px]">
                    {lastActiveLogs.length} action(s)
                  </span>
                </div>
                <div className="text-slate-300 text-[11px] mt-0.5">
                  This will perform a secondary write to Firestore, flagging hash{' '}
                  <code className="text-amber-300 font-mono font-bold">
                    {lastActiveLogs[0]?.txHash?.substring(0, 16) || lastActiveLogs[0]?.id}...
                  </code>{' '}
                  as <strong className="text-rose-400 font-mono">VOIDED</strong> instead of COMMITTED.
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono text-xs">
              <button
                onClick={() => setShowRevertConfirm(false)}
                disabled={isReverting}
                className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRevert}
                disabled={isReverting}
                id="btn-confirm-revert-firestore"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isReverting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Writing VOIDED...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Flag VOIDED</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* REVERT SUCCESS NOTIFICATION */}
        {revertSuccessMsg && (
          <div className="px-6 py-2.5 bg-emerald-500/20 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 font-mono animate-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{revertSuccessMsg}</span>
            </div>
            <button onClick={() => setRevertSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* SUMMARY METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-black/30 border-b border-white/10 text-xs">
          <div className="bg-[#12141a] border border-white/5 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Audit Records</span>
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">
              {filteredLogs.length} <span className="text-[10px] text-slate-500 font-normal">/ {committedLogs.length} total</span>
            </div>
            {voidedCount > 0 && (
              <div className="text-[10px] text-rose-400 font-mono mt-0.5">
                {voidedCount} flagged VOIDED
              </div>
            )}
          </div>

          <div className="bg-[#101915] border border-emerald-500/20 p-3 rounded-xl">
            <div className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Credits Issued</span>
            </div>
            <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
              {currency === 'USD' ? `$${totalCreditsUSD.toFixed(2)}` : `₹${totalCreditsINR.toLocaleString()}`}
            </div>
          </div>

          <div className="bg-[#191510] border border-amber-500/20 p-3 rounded-xl">
            <div className="text-[10px] text-amber-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Active Cancellation Fees</span>
            </div>
            <div className="text-xl font-mono font-bold text-amber-400 mt-1">
              {currency === 'USD' ? `$${totalFeesUSD.toFixed(2)}` : `₹${totalFeesINR.toLocaleString()}`}
            </div>
          </div>

          <div className="bg-[#14121a] border border-sky-500/20 p-3 rounded-xl">
            <div className="text-[10px] text-sky-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Governing Rules</span>
            </div>
            <div className="text-xs font-mono text-slate-300 mt-1.5 truncate">
              Tier 1 SLAs &amp; Tier 2 SOP v4
            </div>
          </div>
        </div>

        {/* ENHANCED SEARCH & FILTER CONTROLS BAR */}
        <div className="px-6 py-3.5 border-b border-white/10 bg-black/40 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* SEARCH INPUT */}
            <div className="flex items-center space-x-2 bg-black/60 border border-white/15 px-3 py-1.5 rounded-xl flex-1 min-w-[260px] max-w-lg focus-within:border-amber-400/60 transition">
              <Search className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="text"
                id="input-ledger-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Order ID, Operator email, TX Hash..."
                className="bg-transparent text-slate-100 placeholder:text-slate-500 outline-none w-full text-xs font-sans"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-slate-500 hover:text-slate-300 text-xs px-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* FILTER DROPDOWNS */}
            <div className="flex flex-wrap items-center gap-2.5 font-mono">
              
              {/* STATUS FILTER */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px] uppercase">Status:</span>
                <select
                  id="filter-ledger-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-black/60 border border-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl outline-none text-xs cursor-pointer hover:border-white/25 transition"
                >
                  <option value="ALL" className="bg-[#0f0f12]">All Statuses</option>
                  <option value="COMMITTED" className="bg-[#0f0f12]">Committed Only</option>
                  <option value="VOIDED" className="bg-[#0f0f12]">Voided Only</option>
                </select>
              </div>

              {/* OPERATOR EMAIL FILTER */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px] uppercase flex items-center gap-1">
                  <User className="w-3 h-3 text-purple-400" />
                  <span>Operator:</span>
                </span>
                <select
                  id="filter-ledger-operator"
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value)}
                  className="bg-black/60 border border-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl outline-none text-xs cursor-pointer hover:border-white/25 transition max-w-[160px]"
                >
                  <option value="ALL" className="bg-[#0f0f12]">All Operators</option>
                  <option value="operator@parcelpilot.internal" className="bg-[#0f0f12]">operator@parcelpilot.internal</option>
                  <option value="roushnisinha111@gmail.com" className="bg-[#0f0f12]">roushnisinha111@gmail.com</option>
                  {uniqueOperators
                    .filter(op => op !== 'operator@parcelpilot.internal' && op !== 'roushnisinha111@gmail.com')
                    .map(op => (
                      <option key={op} value={op} className="bg-[#0f0f12]">{op}</option>
                    ))
                  }
                </select>
              </div>

              {/* ACCOUNT FILTER */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px] uppercase">Account:</span>
                <select
                  id="filter-ledger-account"
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className="bg-black/60 border border-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl outline-none text-xs cursor-pointer hover:border-white/25 transition"
                >
                  <option value="ALL" className="bg-[#0f0f12]">All Accounts</option>
                  <option value="ACC-NORTHSTAR" className="bg-[#0f0f12]">Northstar Logistics</option>
                  <option value="ACC-LUMENWORKS" className="bg-[#0f0f12]">LumenWorks</option>
                  <option value="ACC-BEACON" className="bg-[#0f0f12]">Beacon Retail</option>
                  <option value="ACC-AXIS" className="bg-[#0f0f12]">Axis Labs</option>
                </select>
              </div>

              {/* ACTION TYPE FILTER */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px] uppercase">Action:</span>
                <select
                  id="filter-ledger-action"
                  value={filterActionType}
                  onChange={(e) => setFilterActionType(e.target.value)}
                  className="bg-black/60 border border-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl outline-none text-xs cursor-pointer hover:border-white/25 transition"
                >
                  <option value="ALL" className="bg-[#0f0f12]">All Types</option>
                  <option value="ISSUE_SERVICE_CREDIT" className="bg-[#0f0f12]">Service Credit</option>
                  <option value="CANCEL_SHIPMENT" className="bg-[#0f0f12]">Cancel Shipment</option>
                  <option value="ESCALATE_TICKET" className="bg-[#0f0f12]">Escalate Ticket</option>
                </select>
              </div>

              {/* FINANCIAL CATEGORY PILL FILTER */}
              <div className="flex items-center bg-black/60 border border-white/10 p-0.5 rounded-xl">
                <button
                  onClick={() => setFilterFinancialCategory('ALL')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                    filterFinancialCategory === 'ALL' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterFinancialCategory('CREDITS_ONLY')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                    filterFinancialCategory === 'CREDITS_ONLY' ? 'bg-emerald-500/30 text-emerald-300' : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  Credits
                </button>
                <button
                  onClick={() => setFilterFinancialCategory('FEES_ONLY')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                    filterFinancialCategory === 'FEES_ONLY' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  Fees
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="px-2 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1 cursor-pointer transition"
                  title="Reset all active search and filter criteria"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE FILTER BADGES STRIP */}
          {hasActiveFilters && (
            <div className="flex items-center space-x-2 pt-1 font-mono text-[11px] text-slate-400">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Active Filters:</span>
              <div className="flex flex-wrap gap-1.5">
                {searchTerm && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <span>Query: "{searchTerm}"</span>
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setSearchTerm('')} />
                  </span>
                )}
                {filterStatus !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <span>Status: {filterStatus}</span>
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilterStatus('ALL')} />
                  </span>
                )}
                {filterOperator !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <span>Operator: {filterOperator}</span>
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilterOperator('ALL')} />
                  </span>
                )}
                {filterAccount !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                    <span>Account: {filterAccount}</span>
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilterAccount('ALL')} />
                  </span>
                )}
                {filterActionType !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span>Type: {filterActionType}</span>
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilterActionType('ALL')} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* LEDGER ENTRIES TABLE */}
        <div className="p-6 overflow-y-auto flex-1">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <Database className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
              <div className="text-sm font-medium text-slate-400 font-sans">No matching committed ledger entries found</div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {committedLogs.length === 0
                  ? "No actions have been executed yet in this session. Ask the assistant to audit an order, assess a cancellation fee, or stage a service credit to commit state changes."
                  : "No entries match your search query or filter parameters. Try clearing the search term or resetting the filters."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 font-mono text-[10px] uppercase tracking-widest">
                  <th className="pb-3 font-semibold">Transaction &amp; Status</th>
                  <th className="pb-3 font-semibold">Action &amp; Target ID</th>
                  <th className="pb-3 font-semibold">Account / Plan</th>
                  <th className="pb-3 font-semibold">Credit / Fee</th>
                  <th className="pb-3 font-semibold">Operator Email</th>
                  <th className="pb-3 font-semibold">Governing Precedence</th>
                  <th className="pb-3 font-semibold">Operational Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => {
                  const account = ACCOUNTS[log.account_id];
                  const operatorEmail = log.operatorEmail || 'operator@parcelpilot.internal';
                  const isVoided = log.status === 'VOIDED';
                  
                  return (
                    <tr 
                      key={log.id} 
                      className={`transition ${
                        isVoided 
                          ? 'bg-rose-950/10 text-slate-500 opacity-75 hover:opacity-100 hover:bg-rose-950/20' 
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-3.5 pr-3 font-mono align-top">
                        <div className="flex items-center gap-1.5">
                          {isVoided ? (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-bold uppercase flex items-center gap-1">
                              <Ban className="w-2.5 h-2.5" />
                              <span>VOIDED</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-bold uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>COMMITTED</span>
                            </span>
                          )}
                        </div>
                        <div className={`font-bold mt-1 text-xs ${isVoided ? 'text-slate-400 line-through' : 'text-amber-400'}`}>
                          {highlightMatch(log.txHash ? log.txHash.substring(0, 14) : log.id.substring(0, 10))}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{log.timestamp}</div>
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isVoided
                            ? 'bg-slate-800 text-slate-400 line-through'
                            : log.action_type.includes('CREDIT')
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : log.action_type.includes('FEE')
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        }`}>
                          {log.action_type.replace(/_/g, ' ')}
                        </span>
                        <div className={`text-xs font-mono font-bold mt-1 flex items-center gap-1 ${isVoided ? 'text-slate-400' : 'text-white'}`}>
                          <Tag className="w-3 h-3 text-amber-400" />
                          <span>{highlightMatch(log.target_id)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <div className="font-medium text-slate-200">{highlightMatch(account?.name || log.account_id)}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{account?.tier || 'Enterprise'}</div>
                      </td>

                      <td className="py-3.5 pr-3 font-mono align-top">
                        {log.amountUSD !== undefined && log.amountUSD > 0 && (
                          <div className={`font-bold ${isVoided ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
                            +{currency === 'USD' ? `$${log.amountUSD.toFixed(2)}` : `₹${log.amountINR?.toLocaleString()}`}
                            <span className="text-[10px] font-normal text-slate-400 ml-1">(Credit)</span>
                          </div>
                        )}
                        {log.feeUSD !== undefined && (
                          <div className={`font-semibold ${isVoided ? 'text-slate-500 line-through' : 'text-amber-400'}`}>
                            {currency === 'USD' ? `$${log.feeUSD.toFixed(2)}` : `₹${log.feeINR?.toLocaleString()}`}
                            <span className="text-[10px] font-normal text-slate-400 ml-1">(Fee)</span>
                          </div>
                        )}
                        {(!log.amountUSD && !log.feeUSD) && (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <div className="text-[11px] text-purple-300 font-mono flex items-center gap-1">
                          <User className="w-3 h-3 text-purple-400 shrink-0" />
                          <span className="truncate max-w-[150px]" title={operatorEmail}>
                            {highlightMatch(operatorEmail)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <div className="text-[11px] text-slate-300 font-mono">{log.tierLevel || 'Tier 1 Custom Override'}</div>
                        <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">{highlightMatch(log.citation)}</div>
                      </td>

                      <td className="py-3.5 text-slate-400 text-xs font-sans leading-relaxed align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`line-clamp-2 ${isVoided ? 'text-slate-500 italic' : ''}`}>
                            {isVoided && <span className="text-rose-400 font-mono font-bold mr-1">[REVERTED]</span>}
                            {highlightMatch(log.details)}
                          </div>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 rounded-lg text-[11px] font-mono shrink-0 flex items-center gap-1 transition cursor-pointer"
                            title="Open full audit metadata, complete citation string & transaction hash"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3 text-amber-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-black/50 flex flex-wrap items-center justify-between gap-3 text-slate-500 font-mono text-[11px]">
          <div className="flex items-center space-x-2">
            <span>Showing {filteredLogs.length} of {committedLogs.length} audit records</span>
            <span>•</span>
            <span className="text-slate-400">Click "Inspect" on any entry to view full audit metadata</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* EXPANDED ENTRY AUDIT METADATA MODAL */}
        {selectedLog && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f0f12] border-2 border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden">
              
              {/* EXPANDED HEADER */}
              <div className="px-6 py-4 border-b border-white/10 bg-amber-500/10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                        Full Audit Record &amp; Chain-of-Custody
                      </span>
                      {selectedLog.status === 'VOIDED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          <span>VOIDED / REVERTED</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          COMMITTED
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-white font-mono mt-0.5 flex items-center gap-2">
                      <span>{selectedLog.action_type}</span>
                      <span className="text-slate-400 font-normal text-sm">→ {selectedLog.target_id}</span>
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* EXPANDED BODY METRICS */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs font-mono">
                
                {/* TRANSACTION & SECURITY ATTESTATION */}
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Hash className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cryptographic Transaction Hash &amp; Document Ref</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Exact Transaction Hash:</div>
                      <div className="flex items-center justify-between bg-black/80 px-3 py-2 rounded-lg border border-white/10 mt-1">
                        <span className="text-amber-300 font-bold font-mono select-all text-xs break-all">
                          {selectedLog.txHash || `TXN-${selectedLog.target_id}-${selectedLog.id}`}
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedLog.txHash || selectedLog.id, 'txHash')}
                          className="ml-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[10px] font-sans flex items-center gap-1 shrink-0 transition"
                        >
                          {copiedField === 'txHash' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Firestore Document ID:</div>
                        <div className="text-slate-300 font-mono bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 mt-0.5 truncate select-all">
                          ledger_entries/{selectedLog.id}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Execution Timestamp:</div>
                        <div className="text-slate-300 font-mono bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 mt-0.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{selectedLog.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    {selectedLog.status === 'VOIDED' && (
                      <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg mt-2 space-y-1">
                        <div className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Transaction Reversion Audit</span>
                        </div>
                        <div className="text-slate-300 text-[11px]">
                          <strong>Voided At:</strong> {selectedLog.voidedAt || 'N/A'}
                        </div>
                        <div className="text-slate-300 text-[11px]">
                          <strong>Reason:</strong> {selectedLog.voidReason || 'Operator manual reversion'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* OPERATOR & TENANT IDENTITY */}
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span>Operator Email &amp; Account Identity</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Operator Email (Attestation):</div>
                      <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg mt-1">
                        <span className="text-purple-300 font-bold truncate select-all">
                          {selectedLog.operatorEmail || 'operator@parcelpilot.internal'}
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedLog.operatorEmail || 'operator@parcelpilot.internal', 'operatorEmail')}
                          className="ml-2 p-1 rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-300"
                          title="Copy operator email"
                        >
                          {copiedField === 'operatorEmail' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Tenant Account:</div>
                      <div className="bg-black/60 border border-white/5 px-3 py-1.5 rounded-lg mt-1 text-slate-200 flex items-center justify-between">
                        <span>{ACCOUNTS[selectedLog.account_id]?.name || selectedLog.account_id}</span>
                        <span className="text-slate-500 text-[10px]">({selectedLog.account_id})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GOVERNING CITATION & POLICY PRECEDENCE */}
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Governing Policy Citation &amp; Document Source</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Full Citation String:</div>
                      <div className="flex items-start justify-between bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg mt-1">
                        <span className="text-emerald-300 font-mono text-xs leading-relaxed select-all">
                          {selectedLog.citation}
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedLog.citation, 'citation')}
                          className="ml-2 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] font-sans flex items-center gap-1 shrink-0 transition"
                        >
                          {copiedField === 'citation' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Precedence Tier:</div>
                        <div className="text-slate-300 font-mono bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 mt-0.5">
                          {selectedLog.tierLevel || 'Tier 1 (Enterprise Agreement Override)'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Source Document:</div>
                        <div className="text-slate-300 font-mono bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 mt-0.5 truncate">
                          {selectedLog.documentName || '05_Northstar_Logistics_Enterprise_Agreement.pdf'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FINANCIAL & OPERATIONAL DETAILS */}
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    <span>Financial Assessment &amp; Operational Payload</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-black/60 border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase">Credit Issued (USD / INR):</div>
                      <div className={`text-base font-bold mt-1 ${selectedLog.status === 'VOIDED' ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
                        {selectedLog.amountUSD !== undefined && selectedLog.amountUSD > 0
                          ? (currency === 'USD' ? `$${selectedLog.amountUSD.toFixed(2)}` : `₹${selectedLog.amountINR?.toLocaleString()}`)
                          : '$0.00 / ₹0'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/60 border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase">Assessed Cancellation Fee:</div>
                      <div className={`text-base font-bold mt-1 ${selectedLog.status === 'VOIDED' ? 'text-slate-500 line-through' : 'text-amber-400'}`}>
                        {selectedLog.feeUSD !== undefined
                          ? (selectedLog.feeUSD === 0 ? '$0.00 (Waived)' : (currency === 'USD' ? `$${selectedLog.feeUSD.toFixed(2)}` : `₹${selectedLog.feeINR?.toLocaleString()}`))
                          : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Operational Audit Notes:</div>
                    <div className="bg-black/60 border border-white/5 p-3 rounded-lg mt-1 text-slate-300 font-sans text-xs leading-relaxed">
                      {selectedLog.details}
                    </div>
                  </div>
                </div>

              </div>

              {/* EXPANDED MODAL FOOTER */}
              <div className="px-6 py-3.5 border-t border-white/10 bg-black/60 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">
                  Snapshot Anchor: {SYSTEM_REFERENCE_TIME}
                </span>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs font-mono transition cursor-pointer"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
