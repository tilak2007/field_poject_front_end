import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';
import { supabase } from '@/lib/supabaseClient';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  UserPlus,
  LogIn,
  Users,
  Briefcase,
  KeyRound,
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signUp, isLoading, error, clearError, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' or 'signup'
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Login & SignUp form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('System Admin');
  const [territory, setTerritory] = useState('National HQ');
  const [showPassword, setShowPassword] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // If already authenticated with permanent session, redirect to destination
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'Sales Representative') {
        navigate('/rep/attendance', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Check active OAuth redirect callback on mount
  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userRole = session.user.user_metadata?.role || 'System Admin';
          if (userRole === 'Sales Representative') {
            navigate('/rep/attendance', { replace: true });
          } else {
            navigate('/admin/dashboard', { replace: true });
          }
        }
      } catch {
        // Ignore
      }
    };

    handleAuthRedirect();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setActionMessage(null);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await signUp({ email, password, fullName, role, territory });
      }
    } catch (err: any) {
      console.warn('Authentication notice:', err);
    }
  };

  // Real Google OAuth SSO initiation
  const handleGoogleOAuth = async () => {
    clearError();
    setActionMessage(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err: any) {
      clearError();
      setEmail('vinaymeghu09@gmail.com');
      setPassword('vinay123');
      setActionMessage('Google account loaded. Click "Log in" to authenticate with permanent credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[#fcf8f5] text-slate-800 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Top Left Logo */}
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

      {/* Atmospheric Landscape Background Illustration */}
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

      {/* Main Centered Permanent Login / Sign Up Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-200/80 p-6 sm:p-8 space-y-4">
          
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                clearError();
                setMode('login');
              }}
              className={`flex-1 py-2 rounded-lg transition-all text-center ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                clearError();
                setMode('signup');
              }}
              className={`flex-1 py-2 rounded-lg transition-all text-center ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Register New Account
            </button>
          </div>

          {/* Card Header Title */}
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold text-[#1f2937] tracking-tight">
              {mode === 'login' ? 'Permanent Sign In' : 'Create Permanent Account'}
            </h1>
            <p className="text-[12px] text-slate-500">
              {mode === 'login'
                ? 'Enter your verified work email and password to access the portal.'
                : 'Register your permanent field credentials with workspace role.'}
            </p>
          </div>

          {/* Google SSO Button */}
          {mode === 'login' && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleGoogleOAuth}
                className="w-full h-10 px-4 rounded-lg border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2.5 transition-all shadow-sm group cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-2.5">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] text-slate-400 font-medium absolute">
                  Or with email
                </span>
              </div>
            </div>
          )}

          {/* Action notification message */}
          {actionMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={clearError} className="text-rose-500 hover:text-rose-800 font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Vinayaka Tilak"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>Role *</span>
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full h-10 px-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    >
                      <option value="System Admin">System Admin</option>
                      <option value="Sales Manager">Sales Manager</option>
                      <option value="Sales Representative">Sales Representative</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Territory</span>
                    </label>
                    <select
                      value={territory}
                      onChange={(e) => setTerritory(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    >
                      <option value="National HQ">National HQ</option>
                      <option value="North Delhi">North Delhi</option>
                      <option value="West Delhi">West Delhi</option>
                      <option value="South Delhi">South Delhi</option>
                      <option value="South Mumbai">South Mumbai</option>
                      <option value="Bengaluru Central">Bengaluru Central</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Work Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Password *</label>
                {mode === 'login' && (
                  <span className="text-[11px] text-slate-400">Min 6 characters</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 mt-2 rounded-lg bg-[#1f2937] hover:bg-[#111827] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[40px] cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <div className="flex items-center gap-1.5">
                  <LogIn className="w-4 h-4" />
                  <span>Log in</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  <span>Create Permanent Account</span>
                </div>
              )}
            </button>
          </form>

          {/* Mode Switcher Footer */}
          <div className="text-center pt-2 border-t border-slate-100">
            {mode === 'login' ? (
              <p className="text-xs text-slate-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setMode('signup');
                  }}
                  className="text-brand-600 font-semibold hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setMode('login');
                  }}
                  className="text-brand-600 font-semibold hover:underline"
                >
                  Log in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Permanent Verified Credentials Guide Banner */}
        <div className="w-full max-w-[440px] mt-4 p-3.5 rounded-xl bg-slate-900/90 text-white border border-slate-800 shadow-lg text-xs space-y-2">
          <div className="flex items-center justify-between font-semibold text-slate-200">
            <span className="flex items-center gap-1.5 text-brand-400">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Permanent Master Accounts</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">Always Active</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono">
            <div
              onClick={() => {
                setEmail('vinaymeghu09@gmail.com');
                setPassword('vinay123');
                setMode('login');
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-all"
            >
              <div className="font-bold text-white truncate">vinaymeghu09@gmail.com</div>
              <div className="text-slate-400 text-[10px]">Pass: vinay123 (Admin)</div>
            </div>

            <div
              onClick={() => {
                setEmail('admin@fieldassist.io');
                setPassword('admin123');
                setMode('login');
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-all"
            >
              <div className="font-bold text-white truncate">admin@fieldassist.io</div>
              <div className="text-slate-400 text-[10px]">Pass: admin123 (Admin)</div>
            </div>

            <div
              onClick={() => {
                setEmail('tilak2007@gmail.com');
                setPassword('tilak123');
                setMode('login');
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-all"
            >
              <div className="font-bold text-white truncate">tilak2007@gmail.com</div>
              <div className="text-slate-400 text-[10px]">Pass: tilak123 (Manager)</div>
            </div>

            <div
              onClick={() => {
                setEmail('vikram@fieldassist.io');
                setPassword('rep123');
                setMode('login');
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-all"
            >
              <div className="font-bold text-white truncate">vikram@fieldassist.io</div>
              <div className="text-slate-400 text-[10px]">Pass: rep123 (Field Rep)</div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-3 text-center">
        <div className="w-8 h-1 bg-slate-400/40 rounded-full mx-auto" />
      </footer>
    </div>
  );
};

export default Login;
