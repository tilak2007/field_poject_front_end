import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  LogOut,
  ArrowRight,
} from 'lucide-react';

export const ChangePassword: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password Strength Criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const notTemporary = newPassword !== 'role@123';
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const validCount = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    notTemporary,
  ].filter(Boolean).length;

  const isFormValid =
    currentPassword.length > 0 &&
    validCount === 6 &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    if (newPassword === 'role@123') {
      setErrorMessage('You cannot reuse the temporary password "role@123". Please choose a new secure password.');
      return;
    }

    if (validCount < 6) {
      setErrorMessage('Please ensure your new password satisfies all security requirements.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setSuccessMessage('Password changed successfully! Redirecting to your dashboard...');

      setTimeout(() => {
        if (updatedUser.role === 'Sales Representative') {
          navigate('/rep/attendance', { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Header */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">FieldAssist Security Center</h2>
            <p className="text-[11px] text-slate-400">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Card */}
      <main className="max-w-xl w-full mx-auto my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Banner */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h3 className="font-bold text-white">
                {user?.mustChangePassword ? 'Mandatory First-Time Password Change' : 'Update Your Account Password'}
              </h3>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {user?.mustChangePassword
                  ? 'Your account was created by the administrator with a temporary password. For security compliance, you must set a new permanent password before accessing the FieldAssist portal.'
                  : 'Ensure your account stays secure by periodically updating your password.'}
              </p>
            </div>
          </div>

          {/* User Role & Info Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">User Account:</span>
              <div className="font-semibold text-white">{user?.name}</div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[11px]">Assigned Role:</span>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Password Change Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current / Temporary Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Current Password (or temporary password) *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password (e.g. role@123)"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">New Password *</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Complexity Checklist */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Password Strength Requirements
                </span>
                <span className="text-[11px] font-mono text-brand-400 font-bold">
                  {validCount} / 6 Met
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    validCount <= 2
                      ? 'bg-rose-500 w-1/3'
                      : validCount <= 5
                      ? 'bg-amber-500 w-2/3'
                      : 'bg-emerald-500 w-full'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {hasUppercase ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
                  <span>One uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {hasLowercase ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
                  <span>One lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
                  <span>One number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
                  <span>One special character (!@#$)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${notTemporary ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {notTemporary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span>Different from "role@123"</span>
                </div>
              </div>

              {confirmPassword.length > 0 && (
                <div className={`pt-1 text-[11px] flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {passwordsMatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <span>Save New Password & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-2">
        FieldAssist Protected Authentication System. Passwords are encrypted with SHA-256 / bcrypt and never stored in plain text.
      </footer>
    </div>
  );
};
