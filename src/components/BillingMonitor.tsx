import React, { useState, useEffect } from 'react';
import { Currency } from '../types';
import { 
  firestoreBillingTracker, 
  FirestoreUsageMetrics, 
  FIRESTORE_RATES 
} from '../services/firestoreBillingTracker';
import { 
  DollarSign, 
  TrendingUp, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Database, 
  RefreshCw, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Zap, 
  Clock, 
  ArrowDownRight, 
  ArrowUpRight,
  Info,
  X
} from 'lucide-react';

interface BillingMonitorProps {
  currency: Currency;
  isOpen?: boolean;
  onClose?: () => void;
  isCompact?: boolean; // When rendered inline in OpsAnomalyRadar
}

export const BillingMonitor: React.FC<BillingMonitorProps> = ({
  currency,
  isOpen = true,
  onClose,
  isCompact = false
}) => {
  const [metrics, setMetrics] = useState<FirestoreUsageMetrics>(firestoreBillingTracker.getMetrics());
  const [budgetInput, setBudgetInput] = useState<string>(metrics.dailyBudgetUSD.toString());
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stream' | 'pricing'>('overview');

  useEffect(() => {
    const unsubscribe = firestoreBillingTracker.subscribe((latest) => {
      setMetrics(latest);
    });
    return unsubscribe;
  }, []);

  const costCalculations = firestoreBillingTracker.calculateEstimatedCostUSD();

  const formatCost = (usdAmount: number) => {
    if (currency === 'USD') {
      return usdAmount < 0.01 && usdAmount > 0 
        ? `$${usdAmount.toFixed(4)}`
        : `$${usdAmount.toFixed(2)}`;
    } else {
      const inrAmount = usdAmount * FIRESTORE_RATES.USD_TO_INR;
      return inrAmount < 0.1 && inrAmount > 0
        ? `₹${inrAmount.toFixed(3)}`
        : `₹${inrAmount.toFixed(2)}`;
    }
  };

  const handleSetBudget = () => {
    const num = parseFloat(budgetInput);
    if (!isNaN(num) && num > 0) {
      firestoreBillingTracker.setDailyBudget(num);
      setIsEditingBudget(false);
    }
  };

  const handleSimulateRead = () => {
    firestoreBillingTracker.recordOperation(
      'READ',
      'ledger_entries',
      5,
      'Manual diagnostic query scan (5 docs)'
    );
  };

  const handleResetMetrics = () => {
    if (window.confirm('Reset Firestore usage counters for this session?')) {
      firestoreBillingTracker.resetMetrics();
    }
  };

  // Compact Widget for Sidebar
  if (isCompact) {
    const isHighRisk = costCalculations.budgetPercent >= 80;
    const isModerateRisk = costCalculations.budgetPercent >= 50 && !isHighRisk;

    return (
      <div 
        id="firestore-billing-monitor-compact"
        className="bg-[#111318] border border-white/10 hover:border-amber-500/30 rounded-xl p-3.5 text-xs font-mono space-y-3 transition shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="uppercase tracking-wider text-[11px]">Firestore Billing Monitor</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
            metrics.runawayProtectionActive
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
          }`}>
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>{metrics.runawayProtectionActive ? 'Guarded' : 'Unguarded'}</span>
          </span>
        </div>

        {/* Progress bar to daily budget */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Est. Daily Run:</span>
            <span className={`font-bold ${isHighRisk ? 'text-rose-400' : isModerateRisk ? 'text-amber-400' : 'text-emerald-400'}`}>
              {formatCost(costCalculations.grossUSD)} <span className="text-slate-500 text-[9px]">/ {formatCost(metrics.dailyBudgetUSD)}</span>
            </span>
          </div>
          <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/5">
            <div 
              className={`h-full transition-all duration-500 ${
                isHighRisk ? 'bg-rose-500' : isModerateRisk ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(4, costCalculations.budgetPercent)}%` }}
            />
          </div>
        </div>

        {/* Operation Stats Pills */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div className="bg-black/40 border border-white/5 rounded-lg p-1.5">
            <div className="text-slate-500 uppercase text-[8px]">Reads</div>
            <div className="text-white font-bold">{metrics.totalReads}</div>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-lg p-1.5">
            <div className="text-slate-500 uppercase text-[8px]">Writes</div>
            <div className="text-amber-300 font-bold">{metrics.totalWrites}</div>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-lg p-1.5">
            <div className="text-slate-500 uppercase text-[8px]">Velocity</div>
            <div className="text-emerald-400 font-bold">{metrics.recentOpsVelocity}/m</div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
          <span className="text-slate-500 text-[9px]">
            Free tier: {Math.max(0, FIRESTORE_RATES.FREE_TIER_DAILY.READS - metrics.totalReads).toLocaleString()} reads left
          </span>
          <button
            onClick={handleSimulateRead}
            id="btn-simulate-firestore-read"
            className="text-amber-400 hover:text-amber-300 text-[9px] uppercase font-bold flex items-center gap-0.5 cursor-pointer"
            title="Perform a live read ping to Firestore"
          >
            <Activity className="w-2.5 h-2.5" />
            <span>Ping Op</span>
          </button>
        </div>
      </div>
    );
  }

  // Full Screen / Modal View
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c0d11] border border-white/15 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-serif italic text-white font-semibold tracking-wide">
                  Firestore Billing &amp; Runaway Protection Monitor
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-mono font-bold">
                  Live Telemetry
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Database: <code className="text-amber-300">ai-studio-parcelpilot-d8c39845</code></span>
                <span>•</span>
                <span>Region: <code className="text-slate-300">asia-east1 / us-multi</code></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetMetrics}
              className="px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
              title="Reset session telemetry counters"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Reset Counters</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center space-x-2 px-6 pt-3 border-b border-white/10 bg-black/30 font-mono text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-3 border-b-2 font-bold transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview &amp; Guardrails
          </button>
          <button
            onClick={() => setActiveTab('stream')}
            className={`pb-2 px-3 border-b-2 font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'stream'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Live Operation Stream</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
              {metrics.history.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`pb-2 px-3 border-b-2 font-bold transition cursor-pointer ${
              activeTab === 'pricing'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Firestore Cost Formula
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'overview' && (
            <>
              {/* RUNAWAY PROTECTION BANNER */}
              <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                metrics.runawayProtectionActive 
                  ? 'bg-[#101a14] border-emerald-500/30 text-emerald-200' 
                  : 'bg-[#1a1212] border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    metrics.runawayProtectionActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {metrics.runawayProtectionActive ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold uppercase tracking-wider">
                      Runaway Billing Circuit Breaker: {metrics.runawayProtectionActive ? 'ACTIVE & ENFORCED' : 'DISABLED'}
                    </div>
                    <div className="text-[11px] text-slate-300 font-sans mt-0.5">
                      Automatically throttles rapid recursive snapshot loops and alerts when daily usage reaches 80% of budget cap.
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 font-mono text-xs">
                  <button
                    onClick={() => firestoreBillingTracker.toggleRunawayProtection()}
                    className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                      metrics.runawayProtectionActive
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-rose-500/20 border-rose-400/40 text-rose-300 hover:bg-rose-500/30'
                    }`}
                  >
                    {metrics.runawayProtectionActive ? 'Disable Guard' : 'Enable Guard'}
                  </button>
                </div>
              </div>

              {/* METRICS SUMMARY CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#12141a] border border-white/10 p-3.5 rounded-xl font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Gross Estimated Cost</span>
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-amber-400 mt-1.5">
                    {formatCost(costCalculations.grossUSD)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Net: {formatCost(costCalculations.afterFreeTierUSD)} (excl. free tier)
                  </div>
                </div>

                <div className="bg-[#12141a] border border-white/10 p-3.5 rounded-xl font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Document Reads</span>
                    <ArrowDownRight className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-xl font-bold text-white mt-1.5">
                    {metrics.totalReads.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-sky-400/80 mt-0.5">
                    {formatCost(costCalculations.readsCostUSD)} accrued
                  </div>
                </div>

                <div className="bg-[#12141a] border border-white/10 p-3.5 rounded-xl font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Document Writes</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-emerald-400 mt-1.5">
                    {metrics.totalWrites.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-400/80 mt-0.5">
                    {formatCost(costCalculations.writesCostUSD)} accrued
                  </div>
                </div>

                <div className="bg-[#12141a] border border-white/10 p-3.5 rounded-xl font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Ops Velocity</span>
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-xl font-bold text-purple-400 mt-1.5">
                    {metrics.recentOpsVelocity} <span className="text-xs text-slate-400">ops/m</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Normal Baseline (&lt; 20/m)
                  </div>
                </div>
              </div>

              {/* BUDGET & THRESHOLD MANAGEMENT */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                      Daily Ops Spend Budget &amp; Alert Limit
                    </span>
                  </div>
                  {!isEditingBudget ? (
                    <button
                      onClick={() => setIsEditingBudget(true)}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs uppercase cursor-pointer"
                    >
                      Edit Budget
                    </button>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="100"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="w-16 bg-black/60 border border-amber-400 px-2 py-0.5 rounded text-white text-xs"
                      />
                      <button
                        onClick={handleSetBudget}
                        className="px-2 py-0.5 bg-amber-500 text-black font-bold rounded cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingBudget(false)}
                        className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Daily Consumption:</span>
                    <span className="text-white font-bold">
                      {formatCost(costCalculations.grossUSD)} of {formatCost(metrics.dailyBudgetUSD)} ({costCalculations.budgetPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        costCalculations.budgetPercent >= 80 
                          ? 'bg-rose-500' 
                          : costCalculations.budgetPercent >= 50 
                            ? 'bg-amber-500' 
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(2, costCalculations.budgetPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-sans flex items-center gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    Google Cloud gives <strong>50,000 document reads</strong> and <strong>20,000 document writes</strong> free every day per project.
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'stream' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Recent Firestore Events ({metrics.history.length})</span>
                <button
                  onClick={handleSimulateRead}
                  className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                >
                  <Activity className="w-3 h-3" />
                  <span>Test Firestore Read Op</span>
                </button>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-500 text-[10px] uppercase tracking-wider bg-black/50">
                      <th className="p-3">Time</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Collection</th>
                      <th className="p-3">Count</th>
                      <th className="p-3">Est. Cost</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {metrics.history.map((h, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition">
                        <td className="p-3 text-slate-500 text-[10px]">
                          {new Date(h.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            h.type === 'READ'
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : h.type === 'WRITE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {h.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 text-[11px]">{h.collection}</td>
                        <td className="p-3 text-white font-bold">{h.count}</td>
                        <td className="p-3 text-amber-400">{formatCost(h.costUSD)}</td>
                        <td className="p-3 text-slate-400 text-[11px] truncate max-w-xs">{h.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-black/40 border border-white/10 p-4 rounded-xl space-y-3">
                <div className="font-bold text-amber-400 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>Google Cloud Firestore Standard Rate Sheet</span>
                </div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">
                  ParcelPilot measures exact document-level invocations to predict and prevent unexpected monthly spikes across automated support pipelines.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-black/50 border border-white/5 rounded-lg space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase">Reads</div>
                    <div className="text-white font-bold text-sm">$0.06 / 100k</div>
                    <div className="text-[10px] text-slate-500">Free 50,000 / day</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/5 rounded-lg space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase">Writes</div>
                    <div className="text-emerald-400 font-bold text-sm">$0.18 / 100k</div>
                    <div className="text-[10px] text-slate-500">Free 20,000 / day</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/5 rounded-lg space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase">Deletes</div>
                    <div className="text-sky-400 font-bold text-sm">$0.02 / 100k</div>
                    <div className="text-[10px] text-slate-500">Free 20,000 / day</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-black/50 flex flex-wrap items-center justify-between gap-3 text-slate-500 font-mono text-[11px]">
          <div className="flex items-center space-x-2">
            <span>Tracking active session for {Math.round((Date.now() - metrics.sessionStartTime) / 60000)} mins</span>
            <span>•</span>
            <span className="text-slate-400">Runaway Protection threshold: 80% daily budget</span>
          </div>

          <div className="flex items-center space-x-2">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
