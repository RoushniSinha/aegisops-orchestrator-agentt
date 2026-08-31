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
  Zap, 
  Scale, 
  ShieldAlert, 
  FileCheck 
} from 'lucide-react';
import { exportLedgerToPDF } from '../utils/pdfExport';
import { exportChatAndLedgerToCSV } from '../utils/csvExport';
import { testFirestoreDiagnostics, voidTransactionInFirestore } from '../db/firebaseLedger';

export interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  committedLogs: CommittedExecutionLog[];
  currency: Currency;
  activeAccountId: AccountId;
  role: UserRole;
  onRevertLastBatch?: (batchIdOrTxHash?: string) => Promise<void> | void;
  onVoidTransaction?: (docId: string, txHash: string) => Promise<void> | void;
}

export const LedgerModal: React.FC<LedgerModalProps> = ({
  isOpen,
  onClose,
  committedLogs,
  currency,
  activeAccountId,
  role,
  onRevertLastBatch,
  onVoidTransaction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterActionType, setFilterActionType] = useState<string>('ALL');
  const [filterOperator, setFilterOperator] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMMITTED' | 'VOIDED'>('ALL');
  const [filterFinancialCategory, setFilterFinancialCategory] = useState<'ALL' | 'CREDITS_ONLY' | 'FEES_ONLY'>('ALL');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Local Reversion State
  const [isReverting, setIsReverting] = useState(false);
  const [revertingDocId, setRevertingDocId] = useState<string | null>(null);
  const [revertSuccessMsg, setRevertSuccessMsg] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<CommittedExecutionLog[]>(committedLogs);

  // Sync localLogs with incoming committedLogs
  useEffect(() => {
    setLocalLogs(committedLogs);
  }, [committedLogs]);

  // Selected Log State for Expanded Audit View
  const [selectedLog, setSelectedLog] = useState<CommittedExecutionLog | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Handle individual transaction voiding
  const handleVoidItem = async (log: CommittedExecutionLog) => {
    if (log.status === 'VOIDED' || isReverting || revertingDocId) return;
    const confirmVoid = window.confirm(`Are you sure you want to void transaction ${log.txHash || log.id}? This will flag the entry as VOIDED in Firestore.`);
    if (!confirmVoid) return;

    setRevertingDocId(log.id);
    setIsReverting(true);
    try {
      if (onVoidTransaction) {
        await onVoidTransaction(log.id, log.txHash);
      } else {
        await voidTransactionInFirestore(log.id, log.txHash, {
          operatorEmail: 'operator@aegisops.internal',
          voidReason: 'Manual operator void execution via Ledger Audit Modal'
        });
      }

      // Optimistically update local state
      const nowIso = new Date().toISOString();
      setLocalLogs(prev => prev.map(l => (l.id === log.id || l.txHash === log.txHash) ? {
        ...l,
        status: 'VOIDED',
        voidedAt: nowIso,
        voidReason: 'Manual operator void execution via Ledger Audit Modal',
        voidedBy: 'operator@aegisops.internal'
      } : l));

      if (selectedLog && (selectedLog.id === log.id || selectedLog.txHash === log.txHash)) {
        setSelectedLog(prev => prev ? {
          ...prev,
          status: 'VOIDED',
          voidedAt: nowIso,
          voidReason: 'Manual operator void execution via Ledger Audit Modal',
          voidedBy: 'operator@aegisops.internal'
        } : null);
      }

      setRevertSuccessMsg(`Transaction ${log.txHash || log.id} marked as VOIDED in Firestore ledger.`);
      setTimeout(() => setRevertSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Failed to void transaction: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsReverting(false);
      setRevertingDocId(null);
    }
  };

  if (!isOpen) return null;

  // Filter entries
  const filteredLogs = localLogs.filter(log => {
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesSearch = !searchLower || (
      log.id.toLowerCase().includes(searchLower) ||
      (log.txHash && log.txHash.toLowerCase().includes(searchLower)) ||
      log.target_id.toLowerCase().includes(searchLower) ||
      (log.operatorEmail && log.operatorEmail.toLowerCase().includes(searchLower)) ||
      log.action_type.toLowerCase().includes(searchLower) ||
      (log.citation && log.citation.toLowerCase().includes(searchLower)) ||
      (log.details && log.details.toLowerCase().includes(searchLower)) ||
      (log.documentName && log.documentName.toLowerCase().includes(searchLower)) ||
      (ACCOUNTS[log.account_id as any]?.name.toLowerCase().includes(searchLower))
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

  // Calculate metrics (excluding voided transactions from net totals)
  const activeFilteredLogs = filteredLogs.filter(l => l.status !== 'VOIDED');
  const totalCreditsUSD = activeFilteredLogs.reduce((sum, l) => sum + (l.amountUSD || 0), 0);
  const totalCreditsINR = activeFilteredLogs.reduce((sum, l) => sum + (l.amountINR || ((l.amountUSD || 0) * 84)), 0);
  const totalFeesUSD = activeFilteredLogs.reduce((sum, l) => sum + (l.feeUSD || 0), 0);
  const totalFeesINR = activeFilteredLogs.reduce((sum, l) => sum + (l.feeINR || ((l.feeUSD || 0) * 84)), 0);
  const voidedCount = filteredLogs.filter(l => l.status === 'VOIDED').length;

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
                  AegisOps Firestore Audit Ledger
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold">
                  2PC Committed State
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Immutable record of atomic state transitions, financial authorizations, and void reversals.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              id="btn-close-ledger-modal"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUCCESS MESSAGE NOTIFICATION */}
        {revertSuccessMsg && (
          <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between text-xs font-mono text-emerald-300">
            <div className="flex items-center gap-2">
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
              {filteredLogs.length} <span className="text-[10px] text-slate-500 font-normal">/ {localLogs.length} total</span>
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

        {/* SEARCH & FILTERS BAR */}
        <div className="px-6 py-3.5 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 bg-black/60 border border-white/15 px-3 py-1.5 rounded-xl flex-1 min-w-[240px] max-w-md focus-within:border-amber-400/60 transition">
            <Search className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              id="input-ledger-modal-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Order ID, Operator, TX Hash..."
              className="bg-transparent text-slate-100 placeholder:text-slate-500 outline-none w-full text-xs font-sans"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-black/60 border border-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl outline-none text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMMITTED">Committed Only</option>
              <option value="VOIDED">Voided Only</option>
            </select>

            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="bg-black/60 border border-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl outline-none text-xs"
            >
              <option value="ALL">All Accounts</option>
              <option value="ACC-NORTHSTAR">Northstar</option>
              <option value="ACC-LUMENWORKS">LumenWorks</option>
              <option value="ACC-BEACON">Beacon Retail</option>
              <option value="ACC-AXIS">Axis Labs</option>
            </select>
          </div>
        </div>

        {/* LEDGER TABLE */}
        <div className="p-6 overflow-y-auto flex-1">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 font-mono text-xs">
              No audit records matching query filters.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 font-mono text-[10px] uppercase tracking-widest">
                  <th className="pb-3 font-semibold">Transaction &amp; Status</th>
                  <th className="pb-3 font-semibold">Action &amp; Target</th>
                  <th className="pb-3 font-semibold">Account</th>
                  <th className="pb-3 font-semibold">Financial Impact</th>
                  <th className="pb-3 font-semibold">Operator</th>
                  <th className="pb-3 font-semibold">Precedence &amp; Citation</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => {
                  const isVoided = log.status === 'VOIDED';
                  const isBeingVoided = revertingDocId === log.id;
                  const account = ACCOUNTS[log.account_id as any];

                  return (
                    <tr 
                      key={log.id} 
                      className={`transition ${isVoided ? 'bg-rose-950/10 text-slate-500 opacity-75' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="py-3.5 pr-3 font-mono align-top">
                        <div className="flex items-center gap-1.5">
                          {isVoided ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold uppercase flex items-center gap-1">
                              <Ban className="w-2.5 h-2.5" />
                              <span>VOIDED</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>COMMITTED</span>
                            </span>
                          )}
                        </div>
                        <div className={`font-bold mt-1 text-xs ${isVoided ? 'text-slate-400 line-through' : 'text-amber-400'}`}>
                          {log.txHash ? log.txHash.substring(0, 16) : log.id.substring(0, 12)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{log.timestamp}</div>
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isVoided ? 'bg-slate-800 text-slate-400 line-through' : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}>
                          {log.action_type.replace(/_/g, ' ')}
                        </span>
                        <div className={`text-xs font-mono font-bold mt-1 flex items-center gap-1 ${isVoided ? 'text-slate-400' : 'text-white'}`}>
                          <Tag className="w-3 h-3 text-amber-400" />
                          <span>{log.target_id}</span>
                        </div>
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <div className="font-medium text-slate-200">{account?.name || log.account_id}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{log.account_id}</div>
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
                        {!log.amountUSD && !log.feeUSD && <span className="text-slate-500">-</span>}
                      </td>

                      <td className="py-3.5 pr-3 align-top font-mono text-[11px] text-purple-300">
                        <div className="truncate max-w-[140px]" title={log.operatorEmail || 'operator@aegisops.internal'}>
                          {log.operatorEmail || 'operator@aegisops.internal'}
                        </div>
                      </td>

                      <td className="py-3.5 pr-3 align-top">
                        <div className="text-[11px] text-slate-300 font-mono">{log.tierLevel || 'Tier 1 / Tier 2'}</div>
                        <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5 truncate max-w-[200px]" title={log.citation}>
                          {log.citation}
                        </div>
                      </td>

                      <td className="py-3.5 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-lg text-[11px] font-mono transition cursor-pointer"
                          >
                            Inspect
                          </button>

                          {!isVoided && (
                            <button
                              onClick={() => handleVoidItem(log)}
                              disabled={isReverting || isBeingVoided}
                              className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded-lg text-[11px] font-mono transition cursor-pointer disabled:opacity-40"
                              title="Flag this committed transaction as VOIDED in Firestore"
                            >
                              {isBeingVoided ? 'Voiding...' : 'Revert / Void'}
                            </button>
                          )}
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
            <span>Showing {filteredLogs.length} of {localLogs.length} audit records</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* EXPANDED INSPECT MODAL */}
        {selectedLog && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f0f12] border-2 border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden">
              
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
                          <span>VOIDED</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          COMMITTED
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-white font-mono mt-0.5">
                      {selectedLog.action_type} → {selectedLog.target_id}
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

              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs font-mono">
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase">Exact Transaction Hash:</div>
                  <div className="flex items-center justify-between bg-black/80 px-3 py-2 rounded-lg border border-white/10">
                    <span className="text-amber-300 font-bold font-mono select-all text-xs break-all">
                      {selectedLog.txHash || selectedLog.id}
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedLog.txHash || selectedLog.id, 'txHash')}
                      className="ml-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[10px] font-sans flex items-center gap-1"
                    >
                      {copiedField === 'txHash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedField === 'txHash' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase">Citation &amp; Policy Authority:</div>
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-emerald-300 leading-relaxed font-sans text-xs">
                    {selectedLog.citation}
                  </div>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase">Operational Justification Proof:</div>
                  <div className="p-3 bg-black/60 border border-white/5 rounded-lg text-slate-300 leading-relaxed font-sans text-xs">
                    {selectedLog.details}
                  </div>
                </div>

                {selectedLog.status === 'VOIDED' && (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg space-y-1">
                    <div className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Transaction Reversion Record</span>
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

              <div className="px-6 py-3.5 border-t border-white/10 bg-black/60 flex items-center justify-between">
                <div>
                  {selectedLog.status !== 'VOIDED' && (
                    <button
                      onClick={() => handleVoidItem(selectedLog)}
                      disabled={isReverting}
                      className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold transition cursor-pointer"
                    >
                      Void This Transaction
                    </button>
                  )}
                </div>
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
