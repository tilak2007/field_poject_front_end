import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Store,
  Truck,
  Package,
  Boxes,
  ShoppingCart,
  MapPin,
  CalendarCheck,
  Clock,
  Navigation,
  Target,
  TrendingUp,
  FileSpreadsheet,
  X,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavCategory {
  title: string;
  items: {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    allowedRoles?: string[];
  }[];
}

const navCategories: NavCategory[] = [
  {
    title: 'Field Operations',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      {
        name: 'Live GPS Tracking',
        path: '/live-tracking',
        icon: Navigation,
        badge: 'LIVE',
      },
      {
        name: 'Sales Representatives',
        path: '/reps',
        icon: Users,
        badge: '6 Active',
        allowedRoles: ['System Admin', 'Sales Manager'],
      },
      { name: 'Beat Plans', path: '/beat-plans', icon: MapPin },
      { name: 'Visits', path: '/visits', icon: CalendarCheck, badge: '184 Today' },
      { name: 'Attendance', path: '/attendance', icon: Clock },
    ],
  },
  {
    title: 'Network & Supply',
    items: [
      { name: 'Retailers', path: '/retailers', icon: Store },
      {
        name: 'Distributors',
        path: '/distributors',
        icon: Truck,
        allowedRoles: ['System Admin', 'Sales Manager'],
      },
      { name: 'Products', path: '/products', icon: Package },
      {
        name: 'Inventory',
        path: '/inventory',
        icon: Boxes,
        allowedRoles: ['System Admin', 'Sales Manager'],
      },
      { name: 'Orders', path: '/orders', icon: ShoppingCart, badge: 'New' },
    ],
  },
  {
    title: 'Intelligence & Goals',
    items: [
      { name: 'Targets', path: '/targets', icon: Target },
      {
        name: 'Analytics',
        path: '/analytics',
        icon: TrendingUp,
      },
      {
        name: 'Reports',
        path: '/reports',
        icon: FileSpreadsheet,
        allowedRoles: ['System Admin', 'Sales Manager'],
      },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-72 bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col justify-between shadow-2xl',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Brand Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-brand-300">
                    FieldAssist
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Field Force SaaS</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links Filtered by Verified Role */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {navCategories.map((category) => {
              // Filter items based on user role
              const visibleItems = category.items.filter((item) => {
                if (!item.allowedRoles) return true;
                if (!user) return false;
                if (user.role === 'System Admin') return true;
                return item.allowedRoles.includes(user.role);
              });

              if (visibleItems.length === 0) return null;

              return (
                <div key={category.title} className="space-y-1.5">
                  <h3 className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    {category.title}
                  </h3>

                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => {
                            if (window.innerWidth < 1024) onClose();
                          }}
                          className={({ isActive }) =>
                            clsx(
                              'group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                              isActive
                                ? 'bg-gradient-to-r from-brand-600/90 to-brand-700/80 text-white shadow-md shadow-brand-600/30 border border-brand-500/30'
                                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className="flex items-center gap-3">
                                <Icon
                                  className={clsx(
                                    'w-4 h-4 transition-transform duration-200 group-hover:scale-110',
                                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-400'
                                  )}
                                />
                                <span>{item.name}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {item.badge && (
                                  <span
                                    className={clsx(
                                      'text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1',
                                      item.badge === 'LIVE'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                                        : isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-800 text-slate-400 group-hover:bg-brand-500/20 group-hover:text-brand-300'
                                    )}
                                  >
                                    {item.badge === 'LIVE' && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    )}
                                    <span>{item.badge}</span>
                                  </span>
                                )}
                                <ChevronRight
                                  className={clsx(
                                    'w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-400',
                                    isActive && 'opacity-100 translate-x-0 text-white'
                                  )}
                                />
                              </div>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* User Profile Card / Active Role Status */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'}
                    alt={user?.name || 'User'}
                    className="w-9 h-9 rounded-full object-cover border border-brand-500/40"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate max-w-[110px]">
                    {user?.name || 'Authenticated User'}
                  </h4>
                  <p className="text-[10px] text-emerald-400 font-medium truncate">
                    {user?.role || 'Sales Manager'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out and return to Login"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
