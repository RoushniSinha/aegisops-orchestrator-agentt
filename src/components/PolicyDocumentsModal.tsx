import React, { useState } from 'react';
import { ACCOUNTS, STANDARD_POLICIES } from '../data/mockData';
import { X, BookOpen, FileText, AlertOctagon, CheckCircle2, ShieldCheck, Scale, Ban, Sparkles, UserCheck, ShieldAlert, Check } from 'lucide-react';

interface PolicyDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyDocumentsModal: React.FC<PolicyDocumentsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'tier1' | 'tier2' | 'tier3'>('tier1');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f0f12] border border-white/10 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif italic text-white font-medium">
                AegisOps Governing Policy &amp; Architecture Inspector
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Source of Truth Architecture (Reference Snapshot: 2026-08-16 11:00 IST)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TIER NAVIGATION TABS */}
        <div className="px-6 pt-3 border-b border-white/10 flex flex-wrap items-center gap-2 bg-black/30 text-xs font-mono">
          <button
            onClick={() => setActiveTab('tier1')}
            className={`pb-3 px-3.5 border-b-2 transition flex items-center space-x-1.5 font-semibold cursor-pointer ${
              activeTab === 'tier1'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Tier 1: Enterprise Agreements</span>
          </button>

          <button
            onClick={() => setActiveTab('tier2')}
            className={`pb-3 px-3.5 border-b-2 transition flex items-center space-x-1.5 font-semibold cursor-pointer ${
              activeTab === 'tier2'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Tier 2: Standard SOPs</span>
          </button>

          <button
            onClick={() => setActiveTab('tier3')}
            className={`pb-3 px-3.5 border-b-2 transition flex items-center space-x-1.5 font-semibold cursor-pointer ${
              activeTab === 'tier3'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Ban className="w-4 h-4 text-rose-400" />
            <span>Tier 3: Deprecated (Banned)</span>
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs leading-relaxed">
          
          {/* TAB 1: TIER 1 ENTERPRISE AGREEMENTS */}
          {activeTab === 'tier1' && (
            <div className="space-y-6">
              
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono">
                <strong>Precedence Rule 1:</strong> Customer Enterprise Agreements supersede standard SOPs and flat fee schedules for all explicitly negotiated clauses.
              </div>

              {/* NORTHSTAR AGREEMENT */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-white font-serif text-sm font-medium">Northstar Logistics Master Enterprise Agreement</h3>
                    <div className="text-slate-500 font-mono text-[11px]">Document: 05_Northstar_Logistics_Enterprise_Agreement.pdf</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                    ACTIVE TIER 1
                  </span>
                </div>

                <div className="space-y-2 text-slate-300 font-sans">
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-amber-400 font-mono font-bold block mb-1">Clause 4.1 — Cancellation Fee Waiver:</span>
                    If written cancellation notice is received &ge; 2.0 hours prior to the scheduled pickup window start, all standard cancellation fees are waived to $0.00 (₹0).
                  </div>
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-amber-400 font-mono font-bold block mb-1">Clause 4.2 — Carrier Fault SLA Service Credit:</span>
                    If a carrier-fault pickup delay exceeds 2.0 hours, Northstar Logistics is automatically entitled to a 100% service credit of the booking fee.
                  </div>
                </div>
              </div>

              {/* LUMENWORKS AGREEMENT */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-white font-serif text-sm font-medium">LumenWorks Service Agreement</h3>
                    <div className="text-slate-500 font-mono text-[11px]">Document: 06_LumenWorks_Service_Agreement.pdf</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                    ACTIVE TIER 1
                  </span>
                </div>

                <div className="space-y-2 text-slate-300 font-sans">
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-amber-400 font-mono font-bold block mb-1">Clause 3.4 — Delayed Pickup Service Credit:</span>
                    For carrier-fault delays &ge; 3.0 hours, LumenWorks is entitled to a 50% service credit against the shipment invoice.
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TIER 2 ACTIVE OPERATING SOPS */}
          {activeTab === 'tier2' && (
            <div className="space-y-6">
              
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-mono">
                <strong>Precedence Rule 2:</strong> Applies to all standard accounts (Beacon Retail, Axis Labs) or non-negotiated operational workflows.
              </div>

              {/* SUPPORT POLICY V3 */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-white font-serif text-sm font-medium">ParcelPilot Support Policy (v3 - CURRENT)</h3>
                    <div className="text-emerald-400 font-mono text-[11px]">Document: 01_Support_Policy_v3_CURRENT.pdf</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                    ACTIVE TIER 2 BASELINE
                  </span>
                </div>

                <div className="space-y-2 text-slate-300 font-sans">
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-emerald-400 font-mono font-bold block mb-1">Section 8.2 — API Credential Security Response:</span>
                    In case of reported API key exposure (e.g., TKT-505), immediately revoke active tokens, initiate credential rotation, and notify assigned CSM.
                  </div>
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-emerald-400 font-mono font-bold block mb-1">Section 4.5 — Standard Carrier Fault Delay Credit:</span>
                    Standard accounts receive a 25% service credit only if carrier-fault delay is &ge; 4.0 hours.
                  </div>
                </div>
              </div>

              {/* CANCELLATION SOP V4 */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-white font-serif text-sm font-medium">Cancellation &amp; Service Credit SOP (v4)</h3>
                    <div className="text-emerald-400 font-mono text-[11px]">Document: 03_Cancellation_and_Service_Credit_SOP_v4.pdf</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                    ACTIVE TIER 2 BASELINE
                  </span>
                </div>

                <div className="space-y-2 text-slate-300 font-sans">
                  <div className="p-2.5 rounded bg-black/30 border border-white/5">
                    <span className="text-emerald-400 font-mono font-bold block mb-1">Section 3.2 — Standard Notice Windows:</span>
                    Cancellations requested &ge; 6.0 hours before pickup incur $0.00 fee. Notice &lt; 6.0 hours incurs a flat $50.00 short-notice cancellation fee.
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: TIER 3 DEPRECATED V2 POLICY */}
          {activeTab === 'tier3' && (
            <div className="space-y-6">
              
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-200 text-xs font-mono">
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>STRICT ENGINE BAN — BINDING DECISION PROHIBITION</span>
                </div>
                The v2 policy and historical ticket notes are strictly banned from governing active decisions. Any calculation relying on deprecated v2 metrics is invalid.
              </div>

              <div className="bg-black/40 border border-rose-800/30 rounded-xl p-4 space-y-3 opacity-80">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-slate-300 font-serif text-sm font-medium line-through">Deprecated Support Policy (v2 - Sunsetted Dec 2025)</h3>
                    <div className="text-rose-400 font-mono text-[11px]">Document: 00_Deprecated_Support_Policy_v2.pdf (INVALID)</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-700/50 text-[10px] font-mono font-bold">
                    BANNED SOURCE
                  </span>
                </div>

                <div className="space-y-2 text-slate-400 font-sans">
                  <div className="p-2.5 rounded bg-black/30 border border-rose-900/30 line-through">
                    <span className="text-slate-500 font-mono block mb-1">Deprecated Rule:</span>
                    "10% automatic goodwill credit on any 1-hour delay without carrier fault verification." — SUPERSEDED &amp; BANNED.
                  </div>
                  <div className="p-2.5 rounded bg-black/30 border border-rose-900/30 line-through">
                    <span className="text-slate-500 font-mono block mb-1">Deprecated Rule:</span>
                    "Unconditional $25 flat cancellation fee regardless of notice window." — SUPERSEDED &amp; BANNED.
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-slate-500 font-mono text-[11px]">
          <span>Enforcement Engine: ParcelPilot Deterministic Policy Resolver</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
