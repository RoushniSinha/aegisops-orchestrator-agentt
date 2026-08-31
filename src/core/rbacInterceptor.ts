/**
 * RBAC Boundary Interceptor
 * ParcelPilot Autonomous Support & Operations Engine
 */

import { UserRole, AccountId, PermissionKey, UserProfile } from '../types';

export class SecurityBoundaryViolationError extends Error {
  public code: string;
  public details: Record<string, any>;

  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'SecurityBoundaryViolationError';
    this.code = 'ERR_RBAC_CROSS_TENANT_DENIED';
    this.details = details;
  }
}

export function validateTenantAccess(
  role: UserRole,
  activeAccountId: AccountId,
  targetAccountId: AccountId,
  targetResourceId?: string
): void {
  if (role === 'internal_ops') {
    // Internal operations has cross-tenant audit access
    return;
  }

  if (activeAccountId !== targetAccountId) {
    throw new SecurityBoundaryViolationError(
      `[SECURITY BOUNDARY 403]: Cross-tenant access denied. Role 'customer' for tenant '${activeAccountId}' is not authorized to access resource '${targetResourceId || targetAccountId}' belonging to tenant '${targetAccountId}'.`,
      {
        userRole: role,
        userAccount: activeAccountId,
        targetAccount: targetAccountId,
        targetResource: targetResourceId,
        timestamp: new Date().toISOString()
      }
    );
  }
}

export function checkPermission(
  profile: UserProfile | null,
  permission: PermissionKey
): boolean {
  if (!profile) return false;
  if (profile.role === 'internal_ops') return true;
  if (profile.customPermissions?.includes(permission)) return true;
  return false;
}
