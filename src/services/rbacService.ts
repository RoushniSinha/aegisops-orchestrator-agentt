import { UserProfile, UserRole, AccountId, PermissionKey } from '../types';
import { ACCOUNTS } from '../data/mockData';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: 'Orders & Shipments' | 'Billing & Credits' | 'Operations & Radar' | 'Administration';
  allowedRoles: UserRole[];
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'VIEW_OWN_ORDERS',
    label: 'View Assigned Tenant Orders',
    description: 'Inspect order history, tracking details, and pickup timestamps for the assigned account.',
    category: 'Orders & Shipments',
    allowedRoles: ['customer', 'internal_ops']
  },
  {
    key: 'VIEW_ALL_TENANTS',
    label: 'Cross-Tenant Access',
    description: 'Query, audit, and switch between any enterprise or standard customer tenant accounts.',
    category: 'Orders & Shipments',
    allowedRoles: ['internal_ops']
  },
  {
    key: 'STAGE_SERVICE_CREDIT',
    label: 'Stage SLA Service Credits',
    description: 'Calculate carrier-fault delays and stage contractually entitled service credit proposals.',
    category: 'Billing & Credits',
    allowedRoles: ['customer', 'internal_ops']
  },
  {
    key: 'STAGE_CANCELLATION_WAIVER',
    label: 'Request Cancellation Fee Waivers',
    description: 'Request shipment cancellations and evaluate enterprise notice waiver clauses.',
    category: 'Billing & Credits',
    allowedRoles: ['customer', 'internal_ops']
  },
  {
    key: 'OVERRIDE_CARRIER_FAULT',
    label: 'Carrier Fault Assessment Override',
    description: 'Review carrier telemetry logs and reclassify fault attributions with supervisor notes.',
    category: 'Operations & Radar',
    allowedRoles: ['internal_ops']
  },
  {
    key: 'GLOBAL_OPS_RADAR',
    label: 'Global Carrier Anomaly Radar',
    description: 'Access cross-carrier delay clusters, fleet risk telemetry, and systemic failure queues.',
    category: 'Operations & Radar',
    allowedRoles: ['internal_ops']
  },
  {
    key: 'ESCALATE_CRITICAL_TICKETS',
    label: 'Escalate High-Priority SLA Tickets',
    description: 'Triage critical SLA breaches and route tickets to engineering or tier-2 logistics.',
    category: 'Operations & Radar',
    allowedRoles: ['customer', 'internal_ops']
  },
  {
    key: 'MANAGE_RBAC_USERS',
    label: 'Manage Users & RBAC Directory',
    description: 'Inspect registered user accounts, modify role assignments, and review security audits.',
    category: 'Administration',
    allowedRoles: ['internal_ops']
  },
  {
    key: 'VIEW_TIER1_CONTRACTS',
    label: 'View Enterprise Agreement PDFs',
    description: 'Inspect full legal clauses for custom enterprise contracts (Northstar, LumenWorks).',
    category: 'Billing & Credits',
    allowedRoles: ['customer', 'internal_ops']
  },
  {
    key: 'EXECUTE_LEDGER_ACTIONS',
    label: 'Commit Staged Actions to Firestore',
    description: 'Authorize and execute financial credits, fee waivers, and cancellations in the ledger.',
    category: 'Billing & Credits',
    allowedRoles: ['customer', 'internal_ops']
  }
];

export const rbacService = {
  /**
   * Checks if a user profile has a specific permission
   */
  hasPermission: (profile: UserProfile | null, permission: PermissionKey): boolean => {
    if (!profile) return false;
    
    // Internal ops role has all permissions by default
    if (profile.role === 'internal_ops') return true;

    // Check custom permissions override if present
    if (profile.customPermissions?.includes(permission)) return true;

    // Standard role check
    const def = PERMISSION_DEFINITIONS.find(p => p.key === permission);
    return def ? def.allowedRoles.includes(profile.role) : false;
  },

  /**
   * Verifies if a user has authorization to access data belonging to targetAccountId
   */
  canAccessAccount: (profile: UserProfile | null, targetAccountId: AccountId): boolean => {
    if (!profile) return false;
    if (profile.role === 'internal_ops') return true;
    return profile.accountId === targetAccountId;
  },

  /**
   * Returns human-readable role metadata
   */
  getRoleBadgeInfo: (role: UserRole, accountId?: AccountId) => {
    if (role === 'internal_ops') {
      return {
        label: 'Internal Ops Admin',
        tier: 'Global Administrator',
        colorClass: 'bg-purple-950/40 text-purple-300 border-purple-500/40',
        ringColor: 'ring-purple-500',
        tagBg: 'bg-purple-500/20 text-purple-300'
      };
    }

    const account = accountId ? ACCOUNTS[accountId] : undefined;
    const isTier1 = account?.tier.includes('Tier 1');

    return {
      label: isTier1 ? 'Enterprise Customer' : 'Standard Customer',
      tier: isTier1 ? 'Tier 1 Enterprise Agreement' : 'Tier 2 Active SOP',
      colorClass: isTier1 
        ? 'bg-amber-950/40 text-amber-300 border-amber-500/40' 
        : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40',
      ringColor: isTier1 ? 'ring-amber-500' : 'ring-emerald-500',
      tagBg: isTier1 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
    };
  }
};
