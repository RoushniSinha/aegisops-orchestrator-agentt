import React, { useEffect, useRef } from 'react';
import { ShieldAlert, Lock, AlertOctagon, ShieldX, Terminal, Shield } from 'lucide-react';
import { traceSpan } from '../telemetry/tracer';
import { ACCOUNTS } from '../data/mockData';
import { AccountId } from '../types';

export interface RbacErrorCardProps {
  orderId?: string;
  targetId?: string;
  sessionAccountId: string | AccountId;
  errorCode?: string;
  message?: string;
  onSwitchToInternalOps?: () => void;
}

/**
 * 403 Security Boundary Intercept Card
 * Renders high-contrast red/rose alert container when cross-tenant access is blocked
 * at the tool execution boundary with zero metadata leakage.
 */
export const RbacErrorCard: React.FC<RbacErrorCardProps> = ({
  orderId,
  targetId,
  sessionAccountId,
  errorCode = 'RBAC_TENANT_ISOLATION_VIOLATION',
  message = 'Resource not accessible within your tenant scope.',
  onSwitchToInternalOps
}) => {
  const requestedId = orderId || targetId || 'RESOURCE';
  const hasLoggedSpan = useRef(false);

  useEffect(() => {
    if (!hasLoggedSpan.current) {
      hasLoggedSpan.current = true;
      // Log OpenTelemetry span for RBAC security boundary denial
      traceSpan(
        'rbac_boundary_denial',
        {
          'requested_id': requestedId,
          'tenant_id': sessionAccountId,
          'rbac.error_code': errorCode,
          'rbac.policy': 'Anti-Snooping / BOLA Defense',
          'security.boundary': 'TOOL_LAYER_INTERCEPTOR',
          'security.zero_metadata_disclosed': true
        },
        async () => {
          return { status: 'DENIED', code: 403 };
        }
      ).catch(err => {
        console.warn('[OTel RBAC Trace] Error recording boundary denial:', err);
      });
    }
  }, [requestedId, sessionAccountId, errorCode]);

  const tenantAccount = ACCOUNTS[sessionAccountId as AccountId];
  const tenantDisplayName = tenantAccount ? `${tenantAccount.name} (${sessionAccountId})` : sessionAccountId;

  return (
    <div
      id="rbac-security-intercept-card"
      className="my-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-950/90 via-red-950/80 to-black border-2 border-rose-500/80 shadow-2xl shadow-rose-950/60 text-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* HEADER WITH SHIELD ALERT ICON & 403 BADGE */}
      <div className="flex items-start justify-between border-b border-rose-500/30 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/60 flex items-center justify-center text-rose-300 shadow-inner">
            <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[10px] font-mono font-bold tracking-wider uppercase">
                403 FORBIDDEN
              </span>
              <span className="text-[10px] font-mono text-rose-400/80 font-bold uppercase tracking-wider">
                {errorCode}
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide mt-0.5">
              403: SECURITY BOUNDARY INTERCEPT — DATA ISOLATION GUARD
            </h4>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1 text-[10px] font-mono text-rose-300/80 bg-black/50 px-2.5 py-1 rounded-lg border border-rose-500/20">
          <Lock className="w-3 h-3 text-rose-400" />
          <span>BOLA Defense Active</span>
        </div>
      </div>

      {/* TARGET & TENANT SCOPE METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-black/60 border border-rose-500/20 flex flex-col">
          <span className="text-[10px] text-rose-400/80 uppercase font-semibold">Target Requested ID</span>
          <span className="text-sm font-bold text-white tracking-wider mt-0.5">
            {requestedId}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/60 border border-rose-500/20 flex flex-col">
          <span className="text-[10px] text-rose-400/80 uppercase font-semibold">Active Tenant Scope</span>
          <span className="text-sm font-bold text-amber-300 tracking-wide mt-0.5 truncate" title={tenantDisplayName}>
            {tenantDisplayName}
          </span>
        </div>
      </div>

      {/* SECURITY ISOLATION EXPLANATION */}
      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs leading-relaxed space-y-1.5 font-sans">
        <p className="text-rose-200 font-medium">
          <strong>Cross-tenant resource query blocked at tool execution boundary. Zero target metadata disclosed.</strong>
        </p>
        <p className="text-[11px] text-rose-300/90 font-mono">
          {message}
        </p>
        <div className="pt-1.5 border-t border-rose-500/20 flex items-center justify-between text-[10px] font-mono text-rose-400/90">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-rose-400" />
            <span>OpenTelemetry Span: `rbac_boundary_denial`</span>
          </span>
          <span className="text-slate-400">Status: Enforced (403)</span>
        </div>
      </div>

      {/* OPTIONAL INTERNAL OPS HINT / ACTION */}
      {onSwitchToInternalOps && (
        <div className="pt-1 flex items-center justify-between">
          <span className="text-[11px] text-rose-300/70 font-sans">
            Need cross-tenant operations access?
          </span>
          <button
            onClick={onSwitchToInternalOps}
            className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>Switch to Internal Ops</span>
          </button>
        </div>
      )}
    </div>
  );
};
