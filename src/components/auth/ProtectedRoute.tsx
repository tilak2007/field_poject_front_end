import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';
import { ShieldAlert, ArrowLeft, LogOut, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user, hasRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-400">Verifying session credentials...</p>
      </div>
    );
  }

  // 1. Unauthenticated users cannot access protected pages
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Deactivated accounts are immediately blocked from application functionality
  if (user.status === 'Deactivated') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-rose-500/30 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white">Account Deactivated</h3>
            <p className="text-xs text-slate-400">
              Your account has been deactivated by the System Administrator. Access to FieldAssist is disabled.
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Return to Login</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Mandatory First Login Password Change Enforcement
  // If mustChangePassword is true, block access to all pages except /change-password
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // 4. Role-based authorization check
  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white">Authorization Restricted</h3>
            <p className="text-xs text-slate-400">
              Your assigned role (<span className="text-amber-400 font-semibold">{user.role}</span>) does not have sufficient permissions to view this resource.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-left text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Required Roles:</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allowedRoles.map((r) => (
                <span key={r} className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 font-medium">
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                if (user.role === 'Sales Representative') {
                  navigate('/rep/attendance');
                } else {
                  navigate('/dashboard');
                }
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>My Dashboard</span>
            </button>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
