import React, { useState } from 'react';
import { Order, Ticket, CommittedExecutionLog, Currency, AccountId, UserRole } from '../types';
import { ACCOUNTS, REF_TIMESTAMP } from '../data/mockData';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Flame, 
  Zap, 
  History, 
  Database, 
  Wifi,
  FileDown,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { exportLedgerToPDF } from '../utils/pdfExport';
import { BillingMonitor } from './BillingMonitor';

interface OpsAnomalyRadarProps {
  orders: Order[];
  tickets: Ticket[];
  committedLogs: CommittedExecutionLog[];
  currency: Currency;
  activeAccountId?: AccountId;
  role?: UserRole;
  onAuditOrder: (orderId: string) => void;
  onStageTicketEscalation: (ticketId: string, orderId: string) => void;
  onStageAllCredits?: () => void;
  onStageAllEscalations?: () => void;
  onOpenLedgerModal?: () => void;
  onOpenBillingModal?: () => void;
}

export const OpsAnomalyRadar: React.FC<OpsAnomalyRadarProps> = ({
  orders,
  tickets,
  committedLogs,
  currency,
  activeAccountId = 'ACC-NORTHSTAR',
  role = 'internal_ops',
  onAuditOrder,
  onStageTicketEscalation,
  onStageAllCredits,
  onStageAllEscalations,
  onOpenLedgerModal,
  onOpenBillingModal
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleQuickPDFExport = () => {
    try {
      setIsExportingPDF(true);
      exportLedgerToPDF({
        logs: committedLogs,
        activeAccountId,
        role,
        currency,
        filterAccount: 'ALL',
        filterActionType: 'ALL'
      });
      setTimeout(() => {
        setIsExportingPDF(false);
      }, 600);
    } catch (err: any) {
      setIsExportingPDF(false);
      alert(`PDF Export error: ${err?.message || 'Unknown error'}`);
    }
  };
  // Carrier-fault delay cluster >= 2.0 hrs relative to 2026-03-01T00:00:00Z
  const carrierDelayedOrders = orders.filter(o => {
    if (!o.carrier_fault || o.status !== 'Delayed' || !o.scheduled_delivery) return false;
    const sched = new Date(o.scheduled_delivery).getTime();
    const delayH = (REF_TIMESTAMP - sched) / (1000 * 60 * 60);
    return delayH >= 2.0;
  });

  const highPrioritySla = tickets.filter(t => (t.priority === 'HIGH' || t.priority === 'CRITICAL') && t.sla_breached);

  // Group by carrier
  const carrierCluster: Record<string, number> = {};
  carrierDelayedOrders.forEach(o => {
    carrierCluster[o.carrier] = (carrierCluster[o.carrier] || 0) + 1;
  });

  const totalAtRiskUSD = carrierDelayedOrders.reduce((sum, o) => sum + o.costUSD, 0);
  const totalAtRiskINR = carrierDelayedOrders.reduce((sum, o) => sum + o.costINR, 0);

  return (
    <aside
      id="ops-anomaly-radar"
      className="w-80 lg:w-96 bg-[#0f0f12] flex flex-col overflow-y-auto border-l border-white/10 shrink-0 select-none"
    >
      {/* SIDEBAR HEADER */}
      <div className="p-4 border-b border-white/10 bg-black/40 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-white font-bold flex items-center gap-1.5">
              <span>Ops Anomaly Radar</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Live Carrier Telemetry</span>
          </div>
        </div>

        <span className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
          Problem 1 Active
        </span>
      </div>

      <div className="p-4 space-y-5">
        
        {/* METRICS ROW */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Delays (≥2h)</span>
            </div>
            <div className="text-2xl font-serif text-rose-400 mt-1">{carrierDelayedOrders.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Carrier fault true</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>SLA Breaches</span>
            </div>
            <div className="text-2xl font-serif text-amber-400 mt-1">{highPrioritySla.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">High / Critical queue</div>
          </div>
        </div>

        {/* ANOMALY CLUSTER BANNER */}
        <div className="bg-[#181113] border border-rose-500/30 rounded-xl p-3.5 text-xs">
          <div className="flex items-center space-x-1.5 text-rose-300 font-bold mb-1">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-mono tracking-wide">Apex Express Hub Sorting Failure</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
            Systemic sorting delay identified at Apex Midwest Hub. {carrierDelayedOrders.length} shipments delayed &gt; 2 hours with carrier fault.
          </p>
          <div className="mt-2.5 pt-2 border-t border-rose-900/30 flex justify-between text-[10px] font-mono text-slate-400">
            <span className="uppercase tracking-wider">Freight At Risk:</span>
            <span className="text-rose-300 font-bold">
              {currency === 'USD' ? `$${totalAtRiskUSD.toFixed(2)}` : `₹${totalAtRiskINR.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* IMPACTED SHIPMENTS LIST */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
            <div className="flex items-center gap-1.5">
              <span>Impacted Orders</span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({carrierDelayedOrders.length})
              </span>
            </div>
            {onStageAllCredits && carrierDelayedOrders.length > 0 && (
              <button
                onClick={onStageAllCredits}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono font-bold uppercase bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 rounded transition cursor-pointer"
                title="Stage all late shipments for bulk credit approval"
              >
                Stage All ({carrierDelayedOrders.length})
              </button>
            )}
          </div>

          <div className="space-y-2">
            {carrierDelayedOrders.map(order => {
              const sched = new Date(order.scheduled_delivery!).getTime();
              const delayH = ((REF_TIMESTAMP - sched) / (1000 * 60 * 60)).toFixed(1);
              const account = ACCOUNTS[order.account_id];

              return (
                <div
                  key={order.order_id}
                  className="bg-black/40 border border-white/5 hover:border-amber-500/40 rounded-xl p-3 text-xs transition space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-400 text-xs">{order.order_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800/60">
                      +{delayH}h Late
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span className="truncate max-w-[140px]">{account?.name || order.account_id}</span>
                    <span className="text-slate-500 font-mono text-[10px]">{order.service_tier}</span>
                  </div>

                  <div className="text-[10px] text-amber-300/90 bg-amber-950/20 px-2 py-1 rounded border border-amber-900/30 font-sans">
                    <strong className="font-mono">Cause:</strong> {order.root_cause}
                  </div>

                  <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-mono text-[10px]">
                      {currency === 'USD' ? `$${order.costUSD.toFixed(2)}` : `₹${order.costINR.toLocaleString()}`}
                    </span>
                    <button
                      onClick={() => onAuditOrder(order.order_id)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider font-mono flex items-center space-x-1"
                    >
                      <span>Audit Credit</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* HIGH PRIORITY SLA ESCALATION QUEUE */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
            <div className="flex items-center gap-1.5">
              <span>High-Priority Breaches</span>
              <span className="text-[10px] text-rose-400 font-mono">({highPrioritySla.length})</span>
            </div>
            {onStageAllEscalations && highPrioritySla.length > 0 && (
              <button
                onClick={onStageAllEscalations}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-mono font-bold uppercase bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded transition cursor-pointer"
                title="Stage all high priority SLA breaches for bulk escalation approval"
              >
                Stage All ({highPrioritySla.length})
              </button>
            )}
          </div>

          <div className="space-y-2">
            {highPrioritySla.map(ticket => (
              <div
                key={ticket.ticket_id}
                className="bg-black/40 border border-white/5 rounded-xl p-3 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400">{ticket.ticket_id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    ticket.priority === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    {ticket.priority}
                  </span>
                </div>

                <div className="text-slate-200 text-[11px] leading-snug">{ticket.issue}</div>
                <div className="text-[10px] text-slate-500 font-mono">Order Ref: {ticket.order_id}</div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => onStageTicketEscalation(ticket.ticket_id, ticket.order_id)}
                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold rounded-lg border border-amber-500/40 transition flex items-center space-x-1 font-mono uppercase tracking-wider"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Stage Escalation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* REAL-TIME FIRESTORE USAGE & RUNAWAY BILLING MONITOR (COMPACT) */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
              Firestore Cost &amp; Quota
            </span>
            {onOpenBillingModal && (
              <button
                onClick={onOpenBillingModal}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-mono font-bold uppercase flex items-center gap-1 cursor-pointer"
                title="Expand full Firestore billing and runaway breaker controls"
              >
                <span>Details</span>
                <ChevronRight className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <BillingMonitor
            currency={currency}
            isCompact={true}
          />
        </div>

        {/* DEDICATED REAL-TIME FIRESTORE LEDGER FEED (LAST 10 COMMITTED ACTIONS) */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Firestore Ledger</span>
            </span>
            <div className="flex items-center space-x-1.5">
              {committedLogs.length > 0 && (
                <button
                  onClick={handleQuickPDFExport}
                  id="btn-radar-pdf-export"
                  disabled={isExportingPDF}
                  className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer"
                  title="Export PDF Report of committed ledger entries"
                >
                  <FileDown className="w-3 h-3 text-rose-400" />
                  <span>PDF</span>
                </button>
              )}
              {onOpenLedgerModal && (
                <button
                  onClick={onOpenLedgerModal}
                  id="btn-radar-open-ledger"
                  className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer"
                  title="Open Full Ledger Modal"
                >
                  <span>{committedLogs.length}</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {committedLogs.length === 0 ? (
            <div className="text-[11px] text-slate-500 italic p-3.5 bg-black/20 rounded-xl border border-white/5 text-center leading-relaxed">
              Listening to <code className="text-emerald-400 font-mono text-[10px]">ledger_entries</code> in Firestore. Confirm any staged action to see live commits.
            </div>
          ) : (
            <div className="space-y-2">
              {committedLogs.slice(0, 10).map(log => (
                <div
                  key={log.id}
                  className="p-2.5 bg-[#101512] border border-emerald-500/30 hover:border-emerald-400/50 rounded-xl text-xs font-mono space-y-1 transition"
                >
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{log.action_type}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                  </div>

                  <div className="text-[11px] text-slate-200">
                    Target: <strong className="text-white">{log.target_id}</strong> ({log.account_id})
                  </div>

                  {log.amountUSD !== undefined && (
                    <div className="text-[10px] text-emerald-300">
                      Credit: {currency === 'USD' ? `$${log.amountUSD.toFixed(2)}` : `₹${log.amountINR?.toLocaleString()}`}
                    </div>
                  )}

                  {log.feeUSD !== undefined && (
                    <div className="text-[10px] text-sky-300">
                      Fee: {currency === 'USD' ? `$${log.feeUSD.toFixed(2)}` : `₹${log.feeINR?.toLocaleString()}`}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 leading-tight">
                    {log.details}
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono truncate pt-0.5 border-t border-emerald-950/40">
                    TX: {log.txHash}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};
