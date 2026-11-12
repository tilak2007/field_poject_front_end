import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Eye, EyeOff, AlertCircle, LogIn, Lock, Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      const authenticatedUser = await login({ email, password });

      // First-login mandatory password change check
      if (authenticatedUser?.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      // Role-based dashboard routing
      if (authenticatedUser?.role === 'Sales Representative') {
        navigate('/rep/attendance', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      console.warn('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcf8f5] text-slate-800 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Top Header */}
      <header className="relative z-20 w-full px-6 lg:px-12 py-5 flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 rounded-lg bg-[#eb5e28] flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#252422]">
            FieldAssist
          </span>
        </div>

        <button
          onClick={() => navigate('/')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          ← Back to Overview
        </button>
      </header>

      {/* Atmospheric Landscape Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg
          viewBox="0 0 1440 900"
          className="w-full h-full object-cover opacity-90"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffcf9" />
              <stop offset="100%" stopColor="#fdf3eb" />
            </linearGradient>
            <linearGradient id="hill1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fcdcd1" />
              <stop offset="100%" stopColor="#f8c9b9" />
            </linearGradient>
            <linearGradient id="hill2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f7bcab" />
              <stop offset="100%" stopColor="#f0a592" />
            </linearGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#skyGrad)" />
          <path
            d="M-100,550 Q300,420 800,520 T1600,480 L1600,900 L-100,900 Z"
            fill="url(#hill1)"
            opacity="0.5"
          />
          <path
            d="M-50,680 Q250,560 700,640 T1500,600 L1500,900 L-50,900 Z"
            fill="url(#hill2)"
            opacity="0.85"
          />
        </svg>
      </div>

      {/* Main Centered Login Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-200/80 p-6 sm:p-8 space-y-5">
          {/* Card Header Title */}
          <div className="space-y-1 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/70 text-[#eb5e28] flex items-center justify-center mx-auto mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-[#1f2937] tracking-tight">
              Enterprise Sign In
            </h1>
            <p className="text-[12px] text-slate-500">
              Sign in with your admin-provisioned Gmail credentials to access your dashboard.
            </p>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm leading-none"
              >
                ✕
              </button>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Gmail Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Gmail Address *</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#eb5e28]/20 focus:border-[#eb5e28] transition-all bg-white"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password *</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#eb5e28]/20 focus:border-[#eb5e28] transition-all font-mono bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-2 rounded-xl bg-[#1f2937] hover:bg-[#111827] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </div>
              )}
            </button>
          </form>

          {/* Quick Credential Testing Guide Drawer */}
          <div className="pt-2">
            <details className="group rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 transition-all">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-slate-700 select-none">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#eb5e28]" />
                  <span>Enterprise Pre-configured Credentials</span>
                </span>
                <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-2.5 space-y-2 border-t border-slate-200/80 pt-2 text-[11px]">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <span className="font-bold text-purple-700">👑 System Admin:</span>
                    <span className="font-mono text-slate-600 ml-1">admin@fieldassist.io</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@fieldassist.io');
                      setPassword('admin123');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold border border-purple-200 cursor-pointer"
                  >
                    Fill
                  </button>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <span className="font-bold text-blue-700">💼 Sales Manager:</span>
                    <span className="font-mono text-slate-600 ml-1">manager@fieldassist.io</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('manager@fieldassist.io');
                      setPassword('manager123');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 cursor-pointer"
                  >
                    Fill
                  </button>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <span className="font-bold text-emerald-700">🏃 Sales Rep:</span>
                    <span className="font-mono text-slate-600 ml-1">vikram@fieldassist.io</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('vikram@fieldassist.io');
                      setPassword('rep123');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 cursor-pointer"
                  >
                    Fill
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 italic pt-0.5">
                  Admin-created accounts receive initial password <code className="font-mono font-bold text-slate-700">role@123</code> and are forced to change it on first login.
                </p>
              </div>
            </details>
          </div>

          {/* Security Notice Footer */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Self-registration is disabled. If you do not have an account or need access, please contact your <strong className="text-slate-700">System Administrator</strong>.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-400">
        © 2026 FieldAssist Enterprise FMCG. Admin-Controlled Role-Based Authorization.
      </footer>
    </div>
  );
};
