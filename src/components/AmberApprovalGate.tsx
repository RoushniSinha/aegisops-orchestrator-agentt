import React, { useState } from 'react';
import { StagedStateAction, Currency, PrecedenceTier } from '../types';
import { ACCOUNTS } from '../data/mockData';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ShieldAlert, 
  ArrowRight, 
  DollarSign, 
  FileCheck, 
  Layers, 
  ChevronRight, 
  Trash2, 
  CheckCheck, 
  ShieldCheck, 
  Tag, 
  Sparkles, 
  ListOrdered, 
  Scale, 
  FileText, 
  Check, 
  Clock 
} from 'lucide-react';

interface AmberApprovalGateProps {
  stagedActions: StagedStateAction[];
  currency: Currency;
  onConfirmSingle: (action: StagedStateAction) => Promise<void> | void;
  onConfirmAll: (actions: StagedStateAction[]) => Promise<void> | void;
  onDismissSingle: (actionId: string) => void;
  onDismissAll: () => void;
  isConfirming?: boolean;
}

/**
 * Animated SVG Progress Ring Component
 * Provides smooth radial loading visualization during atomic Firestore writes
 */
const ProgressRing: React.FC<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  glowColor?: string;
}> = ({
  size = 20,
  strokeWidth = 2.5,
  className = 'text-black',
  glowColor = 'rgba(0, 0, 0, 0.4)'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`animate-spin ${className}`}
        style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.35}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export const AmberApprovalGate: React.FC<AmberApprovalGateProps> = ({
  stagedActions,
  currency,
  onConfirmSingle,
  onConfirmAll,
  onDismissSingle,
  onDismissAll,
  isConfirming = false
}) => {
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(0);
  const [confirmingSingleId, setConfirmingSingleId] = useState<string | null>(null);
  const [isConfirmingBatch, setIsConfirmingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  if (!stagedActions || stagedActions.length === 0) {
    return null;
  }

  const isMultiple = stagedActions.length > 1;
  const validIndex = Math.min(selectedActionIndex, stagedActions.length - 1);
  const currentAction = stagedActions[validIndex] || stagedActions[0];
  const account = ACCOUNTS[currentAction.account_id as any];

  const isCurrentlyProcessing = isConfirming || !!confirmingSingleId || isConfirmingBatch;
  const isCurrentActionProcessing = isConfirming || confirmingSingleId === currentAction.id || isConfirmingBatch;

  // Handle single action confirmation
  const handleSingleConfirm = async (action: StagedStateAction) => {
    if (isCurrentlyProcessing) return;
    setConfirmingSingleId(action.id);
    try {
      await onConfirmSingle(action);
    } finally {
      setConfirmingSingleId(null);
    }
  };

  // Handle batch actions confirmation with real-time sequential progress tracking
  const handleBatchConfirm = async (actions: StagedStateAction[]) => {
    if (isCurrentlyProcessing) return;
    setIsConfirmingBatch(true);
    setBatchProgress({ current: 0, total: actions.length });
    try {
      await onConfirmAll(actions);
    } finally {
      setIsConfirmingBatch(false);
      setBatchProgress(null);
    }
  };

  // Batch summary calculations
  const totalCreditsUSD = stagedActions.reduce((acc, a) => acc + (a.amountUSD || 0), 0);
  const totalCreditsINR = stagedActions.reduce((acc, a) => acc + (a.amountINR || 0), 0);
  const totalFeesUSD = stagedActions.reduce((acc, a) => acc + (a.cancellation_fee_USD || 0), 0);
  const totalFeesINR = stagedActions.reduce((acc, a) => acc + (a.cancellation_fee_INR || 0), 0);

  // Helper for Precedence Tier styling badge
  const renderTierBadge = (tierStr?: string) => {
    const tier = tierStr || currentAction.tierLevel || 'Tier 2: Current SOP';
    if (tier.includes('Tier 1')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <Scale className="w-3 h-3 text-emerald-400" />
          <span>Tier 1: Enterprise Agreement</span>
        </span>
      );
    }
    if (tier.includes('Tier 3') || tier.includes('Deprecated')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          <span>Tier 3: Deprecated (Quarantined)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
        <FileCheck className="w-3 h-3 text-sky-400" />
        <span>Tier 2: Current SOP</span>
      </span>
    );
  };

  return (
    <div
      id="amber-approval-gate"
      className="my-3 w-full bg-[#1a1610] border-2 border-amber-600/70 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.2)] overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      {/* 1. TOP HEADER BANNER */}
      <div className="bg-amber-600 px-5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span className="text-[11px] font-bold text-black uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span>⚠️ Stage State Action Required (HITL Amber Gate)</span>
          </span>
          {isMultiple && (
            <span className="bg-black text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
              {stagedActions.length} Staged in Queue
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="bg-black/30 px-2.5 py-0.5 rounded text-[10px] font-mono text-black font-semibold">
            {isMultiple ? `Batch Tx Pipeline` : `ID: ${currentAction.id.substring(0, 12)}`}
          </span>
        </div>
      </div>

      {/* 2. TOP BATCH SUMMARY BAR (IF MULTIPLE ACTIONS ARE QUEUED) */}
      {isMultiple && (
        <div className="px-5 sm:px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono text-amber-200 font-semibold">
              Multi-Operation Batch Pipeline ({stagedActions.length} Actions Queued)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {totalCreditsUSD > 0 && (
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                Total Credits: {currency === 'USD' ? `$${totalCreditsUSD.toFixed(2)}` : `₹${totalCreditsINR.toLocaleString()}`}
              </span>
            )}
            {totalFeesUSD > 0 && (
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
                Total Fees: {currency === 'USD' ? `$${totalFeesUSD.toFixed(2)}` : `₹${totalFeesINR.toLocaleString()}`}
              </span>
            )}
            
            {/* Discard All Action */}
            <button
              onClick={onDismissAll}
              disabled={isCurrentlyProcessing}
              id="btn-discard-all-staged-actions"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 disabled:opacity-50 text-slate-300 text-xs font-mono transition cursor-pointer border border-white/10"
              title="Clear entire queue with zero database mutations"
            >
              Discard All
            </button>

            {/* Confirm All Action */}
            <button
              onClick={() => handleBatchConfirm(stagedActions)}
              id="btn-confirm-all-staged-actions"
              disabled={isCurrentlyProcessing}
              className={`relative px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition cursor-pointer select-none ${
                isConfirmingBatch
                  ? 'bg-amber-500 text-black ring-2 ring-amber-400 ring-offset-2 ring-offset-[#1a1610] cursor-wait'
                  : isCurrentlyProcessing
                  ? 'bg-emerald-600/50 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 active:scale-95'
              }`}
              title="Sequentially commit all staged items via syncActionToFirestore"
            >
              {isConfirmingBatch ? (
                <>
                  <ProgressRing size={16} strokeWidth={2.5} className="text-black" />
                  <span>Committing Batch ({stagedActions.length})...</span>
                </>
              ) : (
                <>
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Confirm All ({stagedActions.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. TABBED ACTION SWITCHER */}
      {isMultiple && (
        <div className="px-5 sm:px-6 pt-3 flex items-center space-x-2 overflow-x-auto pb-1 border-b border-white/5">
          {stagedActions.map((action, idx) => {
            const isSelected = idx === validIndex;
            return (
              <button
                key={action.id}
                onClick={() => setSelectedActionIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                    : 'bg-black/40 text-slate-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <span>#{idx + 1} {action.target_id}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-black/30 text-black font-semibold' : 'bg-white/10 text-slate-400'
                }`}>
                  {action.action_type === 'ISSUE_SERVICE_CREDIT' && 'Credit'}
                  {action.action_type === 'CANCEL_SHIPMENT' && 'Cancel'}
                  {action.action_type === 'ESCALATE_TICKET' && 'Escalate'}
                  {action.action_type === 'FEE_WAIVER' && 'Waiver'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. ACTIVE ITEM BREAKDOWN */}
      <div className="p-5 sm:p-6 space-y-4">
        
        {/* Title & Type */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 text-xl shrink-0">
              ⚠️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-white font-serif text-lg leading-tight font-medium">
                  {currentAction.action_type === 'ISSUE_SERVICE_CREDIT' && 'Confirm Service Credit Issuance'}
                  {currentAction.action_type === 'CANCEL_SHIPMENT' && 'Confirm Shipment Cancellation'}
                  {currentAction.action_type === 'ESCALATE_TICKET' && 'Confirm Ticket Priority Escalation'}
                  {currentAction.action_type === 'FEE_WAIVER' && 'Confirm Cancellation Fee Waiver'}
                </h4>
                {isMultiple && (
                  <span className="text-xs font-mono text-slate-400">
                    (Item #{validIndex + 1} of {stagedActions.length})
                  </span>
                )}
              </div>
              <p className="text-amber-200/60 text-xs mt-0.5">
                Review proposed state mutation before committing to Firestore ledger.
              </p>
            </div>
          </div>

          {isMultiple && (
            <button
              onClick={() => onDismissSingle(currentAction.id)}
              disabled={isCurrentlyProcessing}
              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-40"
              title="Remove this single action from staging queue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Structured Spec Card */}
        <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-2.5 text-xs font-mono">
          
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Target Resource:</span>
            <span className="text-white font-bold text-xs sm:text-sm">{currentAction.target_id}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Account:</span>
            <span className="text-slate-200">
              {account?.name || currentAction.account_id} <span className="text-slate-500 text-[10px]">({currentAction.account_id})</span>
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Precedence Tier:</span>
            <div>{renderTierBadge(currentAction.tierLevel)}</div>
          </div>

          {currentAction.documentName && (
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Document Source:</span>
              <span className="text-slate-300 font-sans text-[11px] flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" />
                {currentAction.documentName}
              </span>
            </div>
          )}

          {currentAction.action_type === 'ISSUE_SERVICE_CREDIT' && currentAction.amountUSD !== undefined && (
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Credit Value:</span>
              <span className="text-emerald-400 font-bold text-xs sm:text-sm">
                {currency === 'USD' ? `$${currentAction.amountUSD.toFixed(2)}` : `₹${currentAction.amountINR?.toLocaleString()}`}
                <span className="text-slate-400 font-normal text-[11px] ml-1">({currentAction.percentage}% Credit)</span>
              </span>
            </div>
          )}

          {currentAction.action_type === 'CANCEL_SHIPMENT' && currentAction.cancellation_fee_USD !== undefined && (
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Assessed Fee:</span>
              <span className={`font-bold text-xs sm:text-sm ${currentAction.cancellation_fee_USD === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                {currentAction.cancellation_fee_USD === 0
                  ? (currency === 'USD' ? '$0.00 (100% Waived)' : '₹0 (100% Waived)')
                  : (currency === 'USD' ? `$${currentAction.cancellation_fee_USD.toFixed(2)}` : `₹${currentAction.cancellation_fee_INR?.toLocaleString()}`)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Exact Citation:</span>
            <span className="text-amber-300 italic text-[11px] text-right truncate max-w-[280px] sm:max-w-none">
              {currentAction.citation}
            </span>
          </div>
        </div>

        {/* Reason Proof / Justification */}
        <div className="p-3.5 bg-black/30 border border-white/5 rounded-xl text-[11px] text-slate-300 leading-relaxed font-sans">
          <strong className="text-amber-300 font-mono text-[11px] mr-1">Policy Justification Proof:</strong>
          {currentAction.reason}
        </div>

        {/* 5. CONTROLS WITH STATE MACHINE INTEGRATION */}
        <div className="flex items-center space-x-3 pt-1">
          <button
            onClick={() => isMultiple ? onDismissSingle(currentAction.id) : onDismissAll()}
            disabled={isCurrentlyProcessing}
            id="btn-dismiss-staged-action"
            className="flex-1 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition cursor-pointer"
          >
            {isMultiple ? `Discard Item #${validIndex + 1}` : 'Discard'}
          </button>
          
          <button
            onClick={() => handleSingleConfirm(currentAction)}
            disabled={isCurrentlyProcessing}
            id="btn-confirm-staged-action"
            className={`relative flex-1 py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-widest transition cursor-pointer select-none flex items-center justify-center gap-2.5 overflow-hidden ${
              isCurrentActionProcessing
                ? 'bg-amber-500 text-black ring-4 ring-amber-400/60 ring-offset-2 ring-offset-[#1a1610] cursor-wait shadow-[0_0_25px_rgba(245,158,11,0.5)]'
                : 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400 active:scale-98'
            }`}
          >
            {isCurrentActionProcessing ? (
              <>
                <ProgressRing size={20} strokeWidth={3} className="text-black" />
                <span className="font-mono font-extrabold tracking-wider">Committing Atomic Tx...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>{isMultiple ? `Confirm Item #${validIndex + 1}` : 'Confirm & Execute'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
