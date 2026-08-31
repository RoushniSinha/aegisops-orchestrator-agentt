import React from 'react';
import { UserRole, AccountId, Currency } from '../types';
import { ACCOUNTS, SYSTEM_REFERENCE_TIME } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { rbacService } from '../services/rbacService';
import {
  ShieldCheck,
  Shield,
  FileText,
  Database,
  Clock,
  LogOut,
  User as UserIcon,
  Flame,
  Lock,
  Unlock,
  KeyRound,
  Sparkles,
  Users,
  Settings,
  DollarSign
} from 'lucide-react';

interface HeaderProps {
  role: UserRole;
  setRole: (role: UserRole) => void;
  accountId: AccountId;
  setAccountId: (id: AccountId) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onOpenPolicyModal: () => void;
  onOpenLedgerModal: () => void;
  onOpenCommittedLedgerModal?: () => void;
  onOpenBillingModal?: () => void;
  onOpenProfileModal: () => void;
  onOpenAuthModal: () => void;
  onOpenWallpaperModal?: () => void;
  committedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  setRole,
  accountId,
  setAccountId,
  currency,
  setCurrency,
  onOpenPolicyModal,
  onOpenLedgerModal,
  onOpenCommittedLedgerModal,
  onOpenBillingModal,
  onOpenProfileModal,
  onOpenAuthModal,
  onOpenWallpaperModal,
  committedCount
}) => {
  const { profile, signOut, updateRoleAndAccountByAdmin, updateUserProfile } = useAuth();
  const currentAccount = ACCOUNTS[accountId];
  const roleInfo = rbacService.getRoleBadgeInfo(role, accountId);

  const isCustomer = role === 'customer';

  const handleRoleChange = async (newRole: UserRole) => {
    setRole(newRole);
    if (profile) {
      await updateUserProfile({ role: newRole });
    }
  };

  const handleAccountChange = async (newAccount: AccountId) => {
    setAccountId(newAccount);
    if (profile && role === 'internal_ops') {
      await updateUserProfile({ accountId: newAccount });
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-3 sm:px-6 border-b border-white/10 bg-[#0f0f12] shrink-0 z-30 select-none">
      
      {/* BRAND & LOGO */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-md shadow-blue-500/20">
            AO
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-serif italic tracking-tight text-white font-semibold">
                AegisOps
              </span>
              {/* Gemini 3.5 Flash Live Badge */}
              <span className="inline-flex items-center space-x-1 text-[10px] uppercase tracking-wider text-cyan-300 font-mono font-bold border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 rounded shadow-sm shadow-cyan-500/10">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>Gemini 3.5 Flash</span>
              </span>
            </div>
            <span className="hidden xl:inline text-[9px] font-mono text-slate-400 -mt-0.5 tracking-tight">
              Autonomous B2B Logistics Orchestrator
            </span>
          </div>
        </div>

        <div className="hidden lg:block h-4 w-[1px] bg-white/10 mx-1"></div>

        <div className="hidden lg:flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 uppercase tracking-tight bg-black/40 border border-white/5 px-2.5 py-1 rounded-md">
          <Clock className="w-3 h-3 text-amber-400" />
          <span className="text-slate-500 font-medium">Snapshot:</span>
          <span className="text-amber-300 font-bold">2026-08-16 11:00 IST</span>
        </div>
      </div>

      {/* CONTROLS & SWITCHERS */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        
        {/* Policy & Ledger Modal Triggers */}
        <button
          onClick={onOpenPolicyModal}
          id="btn-policy-inspector"
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-slate-800/80 border border-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
          title="Inspect Policy Precedence Hierarchy"
        >
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span className="tracking-wide">Policies</span>
        </button>

        {onOpenCommittedLedgerModal && (
          <button
            onClick={onOpenCommittedLedgerModal}
            id="btn-committed-ledger"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-emerald-200 text-xs font-medium transition cursor-pointer"
            title="Inspect Live Firestore Ledger & Export Formatted PDF Report"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tracking-wide font-semibold">Ledger &amp; PDF</span>
            {committedCount > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-full text-[10px] font-mono font-bold">
                {committedCount}
              </span>
            )}
          </button>
        )}

        {onOpenBillingModal && (
          <button
            onClick={onOpenBillingModal}
            id="btn-open-billing-monitor"
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 text-xs font-medium transition cursor-pointer"
            title="Open Real-time Firestore Billing Monitor & Runaway Prevention"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span className="tracking-wide font-semibold">Billing</span>
          </button>
        )}

        <button
          onClick={onOpenLedgerModal}
          id="btn-order-ledger"
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-slate-800/80 border border-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
          title="View Fleet Order Ledger"
        >
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="tracking-wide">Orders</span>
        </button>

        {onOpenWallpaperModal && (
          <button
            onClick={onOpenWallpaperModal}
            id="btn-wallpaper-theme"
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-black/40 hover:bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
            title="Change Chat Wallpaper & Theme"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline tracking-wide">Wallpaper</span>
          </button>
        )}

        {/* Currency Switcher ($ USD / ₹ INR) */}
        <div className="flex items-center bg-black/40 border border-white/10 p-0.5 rounded-lg text-xs font-mono">
          <button
            onClick={() => setCurrency('USD')}
            className={`px-2 py-1 rounded transition font-semibold cursor-pointer ${
              currency === 'USD'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Display in US Dollars ($)"
          >
            $ USD
          </button>
          <button
            onClick={() => setCurrency('INR')}
            className={`px-2 py-1 rounded transition font-semibold cursor-pointer ${
              currency === 'INR'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Display in Indian Rupees (₹)"
          >
            ₹ INR
          </button>
        </div>

        {/* Role Toggle Dropdown */}
        <div className="flex flex-col items-end border-l border-white/10 pl-2 sm:pl-3">
          <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
            Active Role
          </span>
          <select
            id="role-dropdown"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            className={`bg-transparent text-xs font-semibold outline-none cursor-pointer p-0 text-right ${
              role === 'internal_ops' ? 'text-purple-300 font-bold' : 'text-amber-300 font-bold'
            }`}
          >
            <option value="customer" className="bg-[#0f0f12] text-amber-300">
              Customer Portal
            </option>
            <option value="internal_ops" className="bg-[#0f0f12] text-purple-300">
              Internal Operations
            </option>
          </select>
        </div>

        {/* Account Selector (With RBAC Lock status) */}
        <div className="flex flex-col items-end border-l border-white/10 pl-2 sm:pl-3">
          <div className="flex items-center space-x-1">
            {isCustomer ? (
              <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded shadow-sm" title="Session strictly locked to assigned customer tenant">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>🔒 Locked to Tenant Context</span>
              </span>
            ) : (
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1 bg-purple-950/60 border border-purple-500/40 px-1.5 py-0.5 rounded" title="Cross-tenant access unlocked (Global Operations Admin)">
                <Unlock className="w-2.5 h-2.5 text-purple-400" />
                <span>Global Ops (Unlocked)</span>
              </span>
            )}
          </div>

          <select
            id="account-switcher"
            value={accountId}
            disabled={isCustomer}
            onChange={(e) => handleAccountChange(e.target.value as AccountId)}
            className={`bg-transparent text-xs font-semibold outline-none p-0 text-right max-w-[120px] sm:max-w-[160px] truncate mt-0.5 ${
              isCustomer 
                ? 'text-amber-300/90 cursor-not-allowed font-medium' 
                : 'text-purple-200 hover:text-white cursor-pointer font-bold'
            }`}
            title={isCustomer ? 'Locked to Tenant Context: Customer roles cannot tamper with tenant scope' : 'Global Operations: Switch active tenant context'}
          >
            <option value="ACC-NORTHSTAR" className="bg-[#0f0f12] text-slate-200">
              Northstar Logistics
            </option>
            <option value="ACC-LUMENWORKS" className="bg-[#0f0f12] text-slate-200">
              LumenWorks Global
            </option>
            <option value="ACC-BEACON" className="bg-[#0f0f12] text-slate-200">
              Beacon Retail Group
            </option>
            <option value="ACC-AXIS" className="bg-[#0f0f12] text-slate-200">
              Axis Labs Ent.
            </option>
          </select>
        </div>

        {/* User Auth Profile & Settings Trigger */}
        {profile ? (
          <div className="flex items-center space-x-1.5 border-l border-white/10 pl-2 sm:pl-3">
            <button
              onClick={onOpenProfileModal}
              id="btn-user-profile"
              title="Open User Profile & Password Security"
              className="flex items-center space-x-2 p-1 sm:p-1.5 rounded-xl bg-black/40 hover:bg-slate-800/80 border border-white/10 transition cursor-pointer"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-serif font-bold text-xs text-white ${
                profile.role === 'internal_ops' ? 'bg-purple-600' : 'bg-amber-600'
              }`}>
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:flex flex-col items-start text-left">
                <span className="text-[11px] text-white font-medium truncate max-w-[110px]">
                  {profile.displayName}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {profile.role === 'internal_ops' ? 'Admin' : 'Customer'}
                </span>
              </div>
            </button>

            <button
              onClick={() => signOut()}
              id="btn-sign-out"
              title="Sign Out / Switch Account"
              className="p-1.5 rounded-lg bg-black/40 hover:bg-rose-950/40 border border-white/10 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-1 border-l border-white/10 pl-2 sm:pl-3">
            <button
              onClick={onOpenAuthModal}
              id="btn-open-login"
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

      </div>
    </header>
  );
};
