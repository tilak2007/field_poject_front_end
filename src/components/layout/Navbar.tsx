import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Menu,
  Search,
  Bell,
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X,
  LogOut,
  Shield,
  Server,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  selectedRegion,
  onRegionChange
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManagerOrAdmin = user?.role === 'System Admin' || user?.role === 'Sales Manager';

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notifications = [
    {
      id: 1,
      title: 'Geofence Check-in Alert',
      desc: 'Vikram Sharma checked in at Gupta Kirana (CP)',
      time: '2 mins ago',
      type: 'success',
      icon: CheckCircle2,
    },
    {
      id: 2,
      title: 'High Value Order Booked',
      desc: 'Ananya Verma logged order ₹73,200 from Metro Supermarket',
      time: '18 mins ago',
      type: 'order',
      icon: FileText,
    },
    {
      id: 3,
      title: 'Rep Offline Warning',
      desc: 'Karan Patel battery dropped below 15%',
      time: '45 mins ago',
      type: 'warning',
      icon: AlertTriangle,
    },
  ];

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between transition-all">
      {/* Left: Mobile Sidebar Hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar - Desktop (Managers / Admins only) */}
        {isManagerOrAdmin ? (
          <div className="relative w-full max-w-md hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reps, retailers, orders, SKU or beat..."
              className="w-full h-10 pl-10 pr-12 text-xs bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
              /
            </kbd>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400">Beat Territory:</span>
            <span className="font-bold text-white">{user?.territory || 'North Delhi Beat A'}</span>
          </div>
        )}

        {/* Mobile Search Button Toggle (Managers / Admins only) */}
        {isManagerOrAdmin && (
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Right: GPS Sync, Region Selector, Notifications & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* GPS Live Sync Status Pill (Managers / Admins only) */}
        {isManagerOrAdmin && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Live GPS Active</span>
          </div>
        )}

        {/* Region / Territory Selector (Managers / Admins only) */}
        {isManagerOrAdmin && (
          <div className="relative hidden lg:flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-1.5">
            <Globe className="w-4 h-4 text-brand-400" />
            <select
              value={selectedRegion}
              onChange={(e) => onRegionChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="All Regions" className="bg-slate-900 text-slate-200">
                All India Zones
              </option>
              <option value="North Zone" className="bg-slate-900 text-slate-200">
                North Zone (Delhi-NCR)
              </option>
              <option value="West Zone" className="bg-slate-900 text-slate-200">
                West Zone (Mumbai-Guj)
              </option>
              <option value="South Zone" className="bg-slate-900 text-slate-200">
                South Zone (BLR-CHN)
              </option>
              <option value="East Zone" className="bg-slate-900 text-slate-200">
                East Zone (Kolkata)
              </option>
            </select>
          </div>
        )}

        {/* Notifications Dropdown Toggle (Managers / Admins only) */}
        {isManagerOrAdmin && (
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-slate-900 animate-ping" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-slate-900" />
            </button>

            {/* Notifications Modal Popup */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Live Activity Alerts</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                      3 New
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/50 transition-colors border border-slate-800/40"
                      >
                        <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0 mt-0.5">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-slate-200">{n.title}</h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{n.desc}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">{n.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="w-full py-2.5 text-center text-xs font-semibold text-brand-400 hover:text-brand-300 hover:bg-slate-800/40 rounded-xl transition-colors">
                  View All Activity Logs →
                </button>
              </div>
            )}
          </div>
        )}

        {/* User Profile & Auth Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all min-h-[44px]"
          >
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'}
              alt={user?.name || 'User Profile'}
              className="w-8 h-8 rounded-lg object-cover ring-2 ring-brand-500/30"
            />
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-xs font-semibold text-slate-100 truncate max-w-[120px]">
                {user?.name || 'Guest User'}
              </div>
              <div className="text-[10px] font-medium text-brand-400 truncate">
                {user?.role || 'Guest'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 p-4 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <img
                  src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'}
                  alt={user?.name}
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-brand-500/50"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{user?.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold rounded-full bg-brand-500/20 text-brand-300">
                    {user?.role}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="p-2 rounded-xl bg-slate-950/60 flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Territory:</span>
                  <span className="font-semibold">{user?.territory || 'National HQ'}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/60 flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-right">{user?.department || 'Field Ops'}</span>
                </div>
              </div>

              {/* API Integration Details Card */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cloud Connected</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">ONLINE</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  api.fieldassist.io (Enterprise)
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/login');
                  }}
                  className="flex-1 py-2 text-center text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Switch Account</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2 text-center text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Overlay Bar (Managers / Admins only) */}
      {showMobileSearch && isManagerOrAdmin && (
        <div className="absolute top-16 left-0 right-0 p-3 bg-slate-900 border-b border-slate-800 sm:hidden z-40">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reps, retailers, orders..."
              autoFocus
              className="w-full h-10 pl-10 pr-10 text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => setShowMobileSearch(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
