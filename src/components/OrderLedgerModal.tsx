import React, { useState } from 'react';
import { Order, Currency } from '../types';
import { ACCOUNTS, REF_TIMESTAMP } from '../data/mockData';
import { X, Search, Database, ChevronRight, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface OrderLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  currency: Currency;
  onSelectOrder: (orderId: string) => void;
}

export const OrderLedgerModal: React.FC<OrderLedgerModalProps> = ({
  isOpen,
  onClose,
  orders,
  currency,
  onSelectOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.carrier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.destination.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = filterAccount === 'ALL' || o.account_id === filterAccount;
    return matchesSearch && matchesAccount;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f0f12] border border-white/10 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif italic text-white font-medium">
                ParcelPilot Fleet Order Ledger
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                Active Operational Shipments &amp; Live Tracking Ledger
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="px-6 py-3 border-b border-white/10 bg-black/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Order ID, Carrier, City..."
              className="bg-transparent text-slate-100 placeholder:text-slate-500 outline-none w-full text-xs font-sans"
            />
          </div>

          <div className="flex items-center space-x-2 font-mono">
            <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">Account:</span>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="bg-black/40 border border-white/10 text-slate-200 px-3 py-1.5 rounded-xl outline-none text-xs cursor-pointer font-sans"
            >
              <option value="ALL" className="bg-[#0f0f12]">All Accounts</option>
              <option value="ACC-NORTHSTAR" className="bg-[#0f0f12]">Northstar Logistics</option>
              <option value="ACC-LUMENWORKS" className="bg-[#0f0f12]">LumenWorks</option>
              <option value="ACC-BEACON" className="bg-[#0f0f12]">Beacon Retail</option>
              <option value="ACC-AXIS" className="bg-[#0f0f12]">Axis Labs</option>
            </select>
          </div>
        </div>

        {/* ORDERS TABLE */}
        <div className="p-6 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 font-mono text-[10px] uppercase tracking-widest">
                <th className="pb-3 font-semibold">Order ID</th>
                <th className="pb-3 font-semibold">Account</th>
                <th className="pb-3 font-semibold">Carrier / Tier</th>
                <th className="pb-3 font-semibold">Route</th>
                <th className="pb-3 font-semibold">Cost</th>
                <th className="pb-3 font-semibold">Status / Delay</th>
                <th className="pb-3 font-semibold text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.map(order => {
                const account = ACCOUNTS[order.account_id];
                let delayHours = 0;
                if (order.scheduled_delivery && order.status === 'Delayed') {
                  const sched = new Date(order.scheduled_delivery).getTime();
                  delayHours = Math.max(0, (REF_TIMESTAMP - sched) / (1000 * 60 * 60));
                }

                return (
                  <tr key={order.order_id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 font-mono font-bold text-amber-400">
                      {order.order_id}
                    </td>

                    <td className="py-3 text-slate-300">
                      <div className="font-medium">{account?.name || order.account_id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{order.account_id}</div>
                    </td>

                    <td className="py-3 text-slate-300">
                      <div>{order.carrier}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{order.service_tier}</div>
                    </td>

                    <td className="py-3 text-slate-400 font-mono text-[11px]">
                      {order.origin} → {order.destination}
                    </td>

                    <td className="py-3 font-mono font-semibold text-slate-200">
                      {currency === 'USD' ? `$${order.costUSD.toFixed(2)}` : `₹${order.costINR.toLocaleString()}`}
                    </td>

                    <td className="py-3">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : order.status === 'Delayed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : order.status === 'Cancelled'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        }`}>
                          {order.status}
                        </span>

                        {delayHours > 0 && (
                          <span className="text-[10px] font-mono text-rose-400 font-bold">
                            +{delayHours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      {order.carrier_fault && (
                        <div className="text-[9px] text-rose-300 font-mono mt-0.5">Carrier Fault Verified</div>
                      )}
                    </td>

                    <td className="py-3 text-right">
                      <button
                        onClick={() => {
                          onClose();
                          onSelectOrder(order.order_id);
                        }}
                        className="px-2.5 py-1 bg-black/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 hover:border-amber-500/40 rounded-lg text-[10px] font-bold font-mono transition inline-flex items-center space-x-1 uppercase tracking-wider"
                      >
                        <span>Audit</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-slate-500 font-mono text-[11px]">
          <span>Showing {filteredOrders.length} of {orders.length} shipments</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close Ledger
          </button>
        </div>

      </div>
    </div>
  );
};
