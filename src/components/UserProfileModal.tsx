import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, AccountId, PermissionKey } from '../types';
import { PERMISSION_DEFINITIONS, rbacService } from '../services/rbacService';
import { ACCOUNTS } from '../data/mockData';
import {
  User,
  Shield,
  KeyRound,
  Users,
  CheckCircle2,
  XCircle,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Building,
  Briefcase,
  Mail,
  Calendar,
  Clock,
  ShieldAlert,
  Search,
  ArrowRight,
  Sparkles,
  Award
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProfileTab = 'overview' | 'security' | 'rbac_matrix' | 'user_directory';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, changePassword, sendPasswordReset, registeredUsers, updateUserRoleAndAccountByAdmin, updateUserProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Password Change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Profile Edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editDept, setEditDept] = useState(profile?.department || '');
  const [editTitle, setEditTitle] = useState(profile?.jobTitle || '');

  // User Directory Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  if (!isOpen || !profile) return null;

  const roleInfo = rbacService.getRoleBadgeInfo(profile.role, profile.accountId);
  const account = ACCOUNTS[profile.accountId];

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-700' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 4) return { score, label: 'Strong', color: 'bg-sky-500' };
    return { score, label: 'Very Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters in length.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (res.success) {
        setPassSuccess(res.message);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError(res.message);
      }
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName: editName,
      department: editDept,
      jobTitle: editTitle
    });
    setIsEditingProfile(false);
  };

  const handleAdminRoleChange = async (targetUid: string, newRole: UserRole, newAccountId: AccountId) => {
    try {
      await updateUserRoleAndAccountByAdmin(targetUid, newRole, newAccountId);
      setAdminFeedback(`Updated user ${targetUid} permissions successfully.`);
      setTimeout(() => setAdminFeedback(null), 3000);
    } catch (err: any) {
      setAdminFeedback(err.message || 'Failed to update user role');
    }
  };

  const filteredUsers = registeredUsers.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.accountId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-[#0f0f12] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="p-5 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg font-serif">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif italic font-bold text-white text-base sm:text-lg">
                  {profile.displayName}
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold uppercase tracking-wider ${roleInfo.colorClass}`}>
                  {profile.role === 'internal_ops' ? 'Internal Ops Admin' : 'Customer'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {profile.email} • {account?.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-mono px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            ✕ Close
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-white/10 bg-black/30 text-xs font-mono shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 flex items-center space-x-1.5 font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-4 flex items-center space-x-1.5 font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password &amp; Security</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rbac_matrix')}
            className={`py-3 px-4 flex items-center space-x-1.5 font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'rbac_matrix'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>RBAC Matrix</span>
          </button>

          {profile.role === 'internal_ops' && (
            <button
              type="button"
              onClick={() => setActiveTab('user_directory')}
              className={`py-3 px-4 flex items-center space-x-1.5 font-bold transition border-b-2 whitespace-nowrap ${
                activeTab === 'user_directory'
                  ? 'border-purple-400 text-purple-300 bg-purple-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>User Directory (Admin)</span>
            </button>
          )}
        </div>

        {/* MODAL CONTENT */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              
              {/* STATUS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                <div className="bg-black/40 border border-white/5 p-3.5 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Access Tier</span>
                  <div className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>{roleInfo.tier}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {profile.role === 'internal_ops' ? 'Full operational scope' : account?.name}
                  </span>
                </div>

                <div className="bg-black/40 border border-white/5 p-3.5 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Security Status</span>
                  <div className="font-bold text-sm text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Active &amp; Authenticated</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">UID: {profile.uid}</span>
                </div>
              </div>

              {/* PROFILE DETAILS */}
              <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="font-mono text-xs uppercase text-slate-300 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Account Profile Details</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(!isEditingProfile);
                      setEditName(profile.displayName);
                      setEditDept(profile.department || '');
                      setEditTitle(profile.jobTitle || '');
                    }}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline"
                  >
                    {isEditingProfile ? 'Cancel' : 'Edit Info'}
                  </button>
                </div>

                {isEditingProfile ? (
                  <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] font-mono uppercase mb-1">Display Name</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[11px] font-mono uppercase mb-1">Department</label>
                        <input
                          type="text"
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[11px] font-mono uppercase mb-1">Job Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs cursor-pointer"
                    >
                      Save Profile Changes
                    </button>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-mono uppercase text-[10px] block">Full Name</span>
                      <span className="text-white font-medium">{profile.displayName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono uppercase text-[10px] block">Email Address</span>
                      <span className="text-white font-mono">{profile.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono uppercase text-[10px] block">Department</span>
                      <span className="text-slate-300">{profile.department || 'Logistics Operations'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono uppercase text-[10px] block">Job Title</span>
                      <span className="text-slate-300">{profile.jobTitle || 'Account Lead'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono uppercase text-[10px] block">Joined Date</span>
                      <span className="text-slate-400 font-mono">{new Date(profile.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono uppercase text-[10px] block">Last Login</span>
                      <span className="text-slate-400 font-mono">{new Date(profile.lastLoginAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: PASSWORD & SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              
              {/* FEEDBACK BANNERS */}
              {passError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-start space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-start space-x-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{passSuccess}</span>
                </div>
              )}

              {/* CHANGE PASSWORD FORM */}
              <form onSubmit={handlePasswordChange} className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-3.5">
                <div className="border-b border-white/5 pb-2">
                  <h4 className="font-mono text-xs uppercase text-slate-300 font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Change Account Password</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                    Update your account credentials to keep your session secure.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Current Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-white outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* PASSWORD COMPLEXITY INDICATOR */}
                {newPassword && (
                  <div className="p-2.5 bg-black/60 rounded-xl border border-white/5 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-400">Complexity:</span>
                      <span className={`font-bold ${strength.score >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-full flex-1 rounded-full ${
                            level <= strength.score ? strength.color : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isChangingPass ? 'Updating Credentials...' : 'Save New Password'}
                </button>
              </form>

              {/* SECURITY AUDIT INFO */}
              <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-2">
                <h4 className="font-mono text-xs uppercase text-slate-300 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Security &amp; Session Audit</span>
                </h4>
                <div className="text-[11px] text-slate-400 font-mono space-y-1">
                  <p>• Password Last Changed: <span className="text-white">{profile.lastPasswordChangedAt ? new Date(profile.lastPasswordChangedAt).toLocaleString() : 'Default initial creation'}</span></p>
                  <p>• Session Token Duration: <span className="text-white">Active session (Firestore Synchronized)</span></p>
                  <p>• Multi-Tenant Isolation: <span className="text-emerald-400 font-bold">Enforced (RBAC Boundary)</span></p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: RBAC MATRIX */}
          {activeTab === 'rbac_matrix' && (
            <div className="space-y-3 text-xs">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-[11px] text-slate-300 leading-relaxed font-mono">
                🔒 <strong className="text-white">Role-Based Access Control (RBAC) Matrix:</strong> Specific functional permissions granted to your active role (<span className="text-amber-300 font-bold">{profile.role}</span>) vs other roles:
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-black/60 text-slate-400 border-b border-white/10 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Capability / Operation</th>
                      <th className="p-3 text-center">Customer Role</th>
                      <th className="p-3 text-center">Internal Ops Admin</th>
                      <th className="p-3 text-right">Your Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/30">
                    {PERMISSION_DEFINITIONS.map((perm) => {
                      const isCustomerAllowed = perm.allowedRoles.includes('customer');
                      const isOpsAllowed = perm.allowedRoles.includes('internal_ops');
                      const hasCurrentPermission = rbacService.hasPermission(profile, perm.key);

                      return (
                        <tr key={perm.key} className="hover:bg-white/5 transition">
                          <td className="p-3">
                            <div className="font-bold text-white">{perm.label}</div>
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5">{perm.description}</div>
                          </td>
                          <td className="p-3 text-center">
                            {isCustomerAllowed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isOpsAllowed ? (
                              <CheckCircle2 className="w-4 h-4 text-purple-400 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {hasCurrentPermission ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/40 text-emerald-300 border border-emerald-500/40">
                                Authorized
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-500 border border-white/5">
                                Restricted
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: USER DIRECTORY & ADMIN MANAGEMENT (INTERNAL OPS ONLY) */}
          {activeTab === 'user_directory' && profile.role === 'internal_ops' && (
            <div className="space-y-3.5 text-xs">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="font-mono text-xs uppercase text-purple-300 font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Registered User Directory &amp; RBAC Control</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Live directory stored in Firestore <code className="text-amber-300">users</code> collection ({registeredUsers.length} total).
                  </p>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full bg-black/60 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-white outline-none focus:border-purple-500 text-xs font-mono"
                  />
                </div>
              </div>

              {adminFeedback && (
                <div className="p-2.5 bg-purple-950/40 border border-purple-500/40 rounded-xl text-purple-300 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span>{adminFeedback}</span>
                </div>
              )}

              {/* USER CARDS LIST */}
              <div className="space-y-2">
                {filteredUsers.map((u) => {
                  const uRoleInfo = rbacService.getRoleBadgeInfo(u.role, u.accountId);
                  const uAccount = ACCOUNTS[u.accountId];

                  return (
                    <div
                      key={u.uid}
                      className="p-3 bg-black/40 border border-white/5 rounded-xl hover:border-white/10 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">{u.displayName}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border uppercase ${uRoleInfo.colorClass}`}>
                            {u.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {u.email} • <span className="text-amber-300">{uAccount?.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          UID: {u.uid} • Created: {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* ROLE & TENANT CONTROLS */}
                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        <select
                          value={u.role}
                          onChange={(e) => handleAdminRoleChange(u.uid, e.target.value as UserRole, u.accountId)}
                          className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-slate-200 outline-none text-[11px] cursor-pointer"
                        >
                          <option value="customer">Customer</option>
                          <option value="internal_ops">Internal Ops</option>
                        </select>

                        {u.role === 'customer' && (
                          <select
                            value={u.accountId}
                            onChange={(e) => handleAdminRoleChange(u.uid, u.role, e.target.value as AccountId)}
                            className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-amber-300 outline-none text-[11px] cursor-pointer"
                          >
                            <option value="ACC-NORTHSTAR">Northstar</option>
                            <option value="ACC-LUMENWORKS">LumenWorks</option>
                            <option value="ACC-BEACON">Beacon</option>
                            <option value="ACC-AXIS">Axis</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
