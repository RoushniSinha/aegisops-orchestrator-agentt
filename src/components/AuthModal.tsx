import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, AccountId } from '../types';
import {
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Building,
  Briefcase,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  HelpCircle
} from 'lucide-react';
import { ACCOUNTS } from '../data/mockData';

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type AuthTab = 'signin' | 'signup' | 'forgot' | 'quick';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { profile, signIn, signUp, sendPasswordReset, demoLogin } = useAuth();
  
  const [activeTab, setActiveTab] = useState<AuthTab>('signin');
  
  // Sign In / Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up fields
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [accountId, setAccountId] = useState<AccountId>('ACC-NORTHSTAR');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  // Status & Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If not explicitly opened AND user already has an active profile, don't show modal
  if (!isOpen && profile) return null;

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

  const strength = getPasswordStrength(password);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const res = await signIn(email, password);
      if (res.success) {
        if (onClose) onClose();
      } else {
        setError(res.message || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your confirmation password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp({
        email,
        password,
        displayName: displayName || email.split('@')[0],
        role,
        accountId: role === 'internal_ops' ? 'ACC-NORTHSTAR' : accountId,
        department,
        jobTitle
      });

      if (res.success) {
        setSuccessMessage('Account successfully registered! Logged in.');
        setTimeout(() => {
          if (onClose) onClose();
        }, 500);
      } else {
        setError(res.message || 'Registration failed.');
      }
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const res = await sendPasswordReset(email);
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async (presetRole: UserRole, presetAccount: AccountId) => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await demoLogin(presetRole, presetAccount);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-[#0f0f12] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-white/10 bg-black/40 text-center relative shrink-0">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition"
            >
              ✕ Close
            </button>
          )}

          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-2.5 shadow-lg shadow-amber-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif italic text-white font-medium">
            ParcelPilot Gateway
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Role-Based Authentication &amp; Multi-Tenant Authorization
          </p>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-white/10 bg-black/30 text-xs font-mono shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setError(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 text-center font-bold transition border-b-2 ${
              activeTab === 'signin'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 text-center font-bold transition border-b-2 ${
              activeTab === 'signup'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('quick'); setError(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 text-center font-bold transition border-b-2 ${
              activeTab === 'quick'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1-Click Profiles
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* FEEDBACK BANNERS */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-start space-x-2 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-start space-x-2 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: SIGN IN */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@enterprise.com"
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500 font-mono transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 text-[11px] font-mono uppercase">Password</label>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('forgot'); setError(null); }}
                    className="text-[11px] text-amber-400/90 hover:text-amber-300 font-mono transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-white outline-none focus:border-amber-500 font-mono transition"
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono uppercase tracking-wider text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <span className="text-slate-500 text-xs font-mono">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => { setActiveTab('signup'); setError(null); }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-mono underline underline-offset-4"
                >
                  Register new profile
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER (SIGN UP) */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3 text-xs">
              
              {/* ROLE SELECTION */}
              <div>
                <label className="block text-slate-400 text-[11px] mb-1.5 font-mono uppercase font-bold">
                  Select User Role &amp; Access Tier
                </label>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      role === 'customer'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Customer Portal</span>
                      {role === 'customer' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Tenant Scoped Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('internal_ops')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      role === 'internal_ops'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                        : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Internal Ops</span>
                      {role === 'internal_ops' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Global Fleet Admin</span>
                  </button>
                </div>
              </div>

              {/* TENANT ASSIGNMENT (FOR CUSTOMERS) */}
              {role === 'customer' && (
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">
                    Assigned Enterprise Tenant
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value as AccountId)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500 font-mono cursor-pointer"
                    >
                      <option value="ACC-NORTHSTAR">Northstar Logistics (Tier 1 Enterprise)</option>
                      <option value="ACC-LUMENWORKS">LumenWorks (Tier 1 Enterprise)</option>
                      <option value="ACC-BEACON">Beacon Retail (Tier 2 Standard SOP)</option>
                      <option value="ACC-AXIS">Axis Labs (Tier 2 Standard SOP)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* FULL NAME & EMAIL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Priya Mehta"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@enterprise.com"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* DEPARTMENT & JOB TITLE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Department</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Logistics / Ops"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Job Title</label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Supply Chain Director"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* PASSWORD & CONFIRM PASSWORD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-white outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Confirm Password</label>
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

              {/* PASSWORD STRENGTH BAR */}
              {password && (
                <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-400">Password Complexity:</span>
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
                disabled={isSubmitting}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono uppercase tracking-wider text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Creating Profile...' : 'Complete Registration'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-1">
                <span className="text-slate-500 text-xs font-mono">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => { setActiveTab('signin'); setError(null); }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-mono underline underline-offset-4"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: QUICK 1-CLICK ROLE PROFILES */}
          {activeTab === 'quick' && (
            <div className="space-y-3 font-mono">
              <div className="text-[11px] text-slate-400 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
                ⚡ <strong className="text-white">Instant Testing Profiles:</strong> Activate pre-configured enterprise customer or global admin sessions instantly:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <button
                  type="button"
                  id="btn-login-northstar"
                  onClick={() => handleQuickDemo('customer', 'ACC-NORTHSTAR')}
                  disabled={isSubmitting}
                  className="p-3.5 rounded-xl bg-amber-950/25 hover:bg-amber-950/50 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-left transition flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-white text-sm">Northstar Logistics</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Role: Customer</span>
                    <span className="text-amber-400 font-bold">Tier 1 Agreement</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-login-lumenworks"
                  onClick={() => handleQuickDemo('customer', 'ACC-LUMENWORKS')}
                  disabled={isSubmitting}
                  className="p-3.5 rounded-xl bg-sky-950/25 hover:bg-sky-950/50 border border-sky-500/40 hover:border-sky-400 text-sky-300 text-left transition flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-white text-sm">LumenWorks</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Role: Customer</span>
                    <span className="text-sky-400 font-bold">Tier 1 Agreement</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-login-beacon"
                  onClick={() => handleQuickDemo('customer', 'ACC-BEACON')}
                  disabled={isSubmitting}
                  className="p-3.5 rounded-xl bg-emerald-950/25 hover:bg-emerald-950/50 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-left transition flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-white text-sm">Beacon Retail</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Role: Customer</span>
                    <span className="text-emerald-400 font-bold">Tier 2 Standard SOP</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-login-ops"
                  onClick={() => handleQuickDemo('internal_ops', 'ACC-NORTHSTAR')}
                  disabled={isSubmitting}
                  className="p-3.5 rounded-xl bg-purple-950/35 hover:bg-purple-950/60 border border-purple-500/40 hover:border-purple-400 text-purple-300 text-left transition flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-white text-sm">Internal Ops Admin</span>
                    <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Role: Internal Admin</span>
                    <span className="text-purple-400 font-bold">Global RBAC</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: FORGOT PASSWORD */}
          {activeTab === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5 text-xs">
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                Enter your registered email address to receive password reset credentials or trigger security renewal.
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-mono uppercase">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold font-mono uppercase tracking-wider text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Sending Request...' : 'Send Password Reset Link'}</span>
                <KeyRound className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setActiveTab('signin'); setError(null); }}
                  className="text-xs text-slate-400 hover:text-white font-mono underline underline-offset-4"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
