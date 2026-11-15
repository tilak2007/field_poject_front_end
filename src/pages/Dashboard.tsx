import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Store,
  CalendarCheck,
  ArrowUpRight,
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Package,
  ShieldCheck,
  AlertTriangle,
  Navigation,
  Target as TargetIcon,
  MapPin,
  Clock,
  Lock,
  Phone,
  Plus,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import {
  mockRevenueTrends,
  mockTerritoryPerformance,
  mockTopProducts,
  mockOrders,
  mockVisits,
  mockRetailers,
} from '../data/mockData';
import { dashboardApi, targetsApi } from '../api';
import { useAuth } from '../context/AuthContext';

interface DashboardStats {
  today_orders_count: number;
  today_orders_total: number;
  today_visits_count: number;
  today_attendance_count: number;
  total_retailers_count: number;
  total_products_count: number;
  low_stock_products_count: number;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'System Admin' || user?.role === 'Sales Manager';
  const isRep = !isManagerOrAdmin;
  const isNewRep = isRep && user?.email !== 'vikram@fieldassist.io';
  const userTerritory = user?.territory || 'Bengaluru South';

  const [stats, setStats] = useState<DashboardStats>({
    today_orders_count: 6,
    today_orders_total: 8000.0,
    today_visits_count: 4,
    today_attendance_count: 3,
    total_retailers_count: 12,
    total_products_count: 25,
    low_stock_products_count: 2,
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Today shift telemetry for representative
  const [userCheckedInToday, setUserCheckedInToday] = useState(false);
  const [userPunchInTime, setUserPunchInTime] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : 'usr_default');
    const userRecord = localStorage.getItem(`fieldassist_attendance_${userKey}_${today}`);
    const localRecord = userRecord || localStorage.getItem(`attendance_${today}`);
    if (localRecord) {
      try {
        const parsed = JSON.parse(localRecord);
        if (parsed?.check_in_time) {
          setUserCheckedInToday(true);
          setUserPunchInTime(parsed.check_in_time);
        }
      } catch {}
    }
  }, [user]);

  // Specified Area Retail Network: Load all retail outlets in the representative's assigned territory
  const areaRetailers = useMemo(() => {
    try {
      const stored = localStorage.getItem('fieldassist_retailers');
      const list = stored ? JSON.parse(stored) : mockRetailers;
      if (Array.isArray(list) && list.length > 0) {
        const matched = list.filter((r: any) =>
          r.territory?.toLowerCase().includes(userTerritory.toLowerCase()) ||
          userTerritory.toLowerCase().includes(r.territory?.toLowerCase() || '')
        );
        if (matched.length > 0) return matched;
      }
    } catch {}

    const matched = mockRetailers.filter((r) =>
      r.territory?.toLowerCase().includes(userTerritory.toLowerCase()) ||
      userTerritory.toLowerCase().includes(r.territory?.toLowerCase() || '')
    );
    return matched.length > 0 ? matched : mockRetailers.slice(0, 5);
  }, [userTerritory]);

  // Dynamically load target assigned to the current Sales Rep from targetsApi
  const repAssignedTarget = useMemo(() => {
    return targetsApi.getTargetForRep(user);
  }, [user]);

  // Sales Representative personal trajectory
  const repSalesTrajectory = useMemo(() => {
    if (!repAssignedTarget) return [];
    if (user?.email === 'vikram@fieldassist.io') {
      return [
        { month: 'May', actualSales: 380000, target: 450000 },
        { month: 'Jun', actualSales: 410000, target: 450000 },
        { month: 'Jul', actualSales: 435000, target: 480000 },
        { month: 'Aug', actualSales: 460000, target: 480000 },
        { month: 'Sep', actualSales: 490000, target: 500000 },
        { month: 'Oct', actualSales: 422500, target: 500000 },
      ];
    }
    return [
      {
        month: 'Current',
        actualSales: repAssignedTarget.salesAchievedAmount || 0,
        target: repAssignedTarget.salesTargetAmount || 0,
      },
    ];
  }, [repAssignedTarget, user]);

  // Retail Network Outlets in the Sales Rep's Specified Area
  const repBeatOutlets = useMemo(() => {
    if (user?.email === 'vikram@fieldassist.io') {
      return [
        {
          id: 'out-1',
          name: 'Sri Manjunatha Provision Store',
          area: '4th Block, Jayanagar, Bengaluru',
          contact: 'Manjunath Gowda (+91 98112-44510)',
          status: 'Completed',
          orderAmount: 4500,
          checkInTime: '09:45 AM',
          type: 'Kirana',
          phone: '+91 98112-44510',
          ownerName: 'Manjunath Gowda',
        },
        {
          id: 'out-2',
          name: 'Shree Lakshmi Supermart',
          area: '7th Phase, JP Nagar, Bengaluru',
          contact: 'Lakshmi Narayana (+91 98711-22340)',
          status: 'Completed',
          orderAmount: 3500,
          checkInTime: '11:15 AM',
          type: 'Supermarket',
          phone: '+91 98711-22340',
          ownerName: 'Lakshmi Narayana',
        },
        {
          id: 'out-3',
          name: 'Venkateshwara Traders',
          area: 'BTM Layout 2nd Stage, Bengaluru',
          contact: 'R. Venkatesh (+91 99100-33211)',
          status: 'In Progress',
          orderAmount: 0,
          checkInTime: '01:20 PM',
          type: 'Pharmacy',
          phone: '+91 99100-33211',
          ownerName: 'R. Venkatesh',
        },
        {
          id: 'out-4',
          name: 'Ganesh Grand Bazaar',
          area: '5th Block, Koramangala, Bengaluru',
          contact: 'Ganesh Hegde (+91 98188-77441)',
          status: 'Scheduled',
          orderAmount: 0,
          checkInTime: '03:00 PM',
          type: 'Supermarket',
          phone: '+91 98188-77441',
          ownerName: 'Ganesh Hegde',
        },
        {
          id: 'out-5',
          name: 'Balaji Daily Needs',
          area: '2nd Stage, Banashankari, Bengaluru',
          contact: 'Balaji Prasad (+91 98991-55223)',
          status: 'Scheduled',
          orderAmount: 0,
          checkInTime: '04:30 PM',
          type: 'Kirana',
          phone: '+91 98991-55223',
          ownerName: 'Balaji Prasad',
        },
      ];
    }

    // For any newly created representative: ONLY retail network details of their specified area
    // All outlets start clean in "Ready for Visit" status with 0 orders pending first visit
    return areaRetailers.map((ret, idx) => ({
      id: ret.id || `out-${idx + 1}`,
      name: ret.name,
      area: `${ret.address}, ${ret.city || 'Bengaluru'}`,
      contact: `${ret.ownerName} (${ret.phone})`,
      status: 'Ready for Visit',
      orderAmount: 0,
      checkInTime: 'Pending Visit',
      type: ret.type || 'Retail Outlet',
      phone: ret.phone,
      ownerName: ret.ownerName,
      creditLimit: ret.creditLimit,
    }));
  }, [user, areaRetailers]);

  // Strictly filter orders for sales rep: only their own bookings
  const [ordersList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fieldassist_orders');
      if (saved) return JSON.parse(saved);
    } catch {}
    return mockOrders;
  });

  const visibleOrders = useMemo(() => {
    if (!isRep) return ordersList;
    if (user?.email === 'vikram@fieldassist.io') {
      return ordersList.filter(
        (o) =>
          o.repId === 'rep-1' ||
          o.repId === 'rep-01' ||
          o.repName?.toLowerCase().includes('vikram')
      );
    }
    // Newly created representative: ONLY their own booked orders (zero by default!)
    return ordersList.filter(
      (o) =>
        (user?.id && o.repId === user.id) ||
        (user?.name && o.repName?.toLowerCase() === user.name.toLowerCase()) ||
        (user?.email && o.repEmail === user.email)
    );
  }, [ordersList, isRep, user]);

  // Strictly filter visits for sales rep: only their own route visits
  const [visitsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fieldassist_visits');
      if (saved) return JSON.parse(saved);
    } catch {}
    return mockVisits;
  });

  const visibleVisits = useMemo(() => {
    if (!isRep) return visitsList;
    if (user?.email === 'vikram@fieldassist.io') {
      return visitsList.filter(
        (v) =>
          v.repId === 'rep-1' ||
          v.repName?.toLowerCase().includes('vikram')
      );
    }
    // Newly created representative: ONLY their own route visits (zero by default!)
    return visitsList.filter(
      (v) =>
        (user?.id && v.repId === user.id) ||
        (user?.name && v.repName?.toLowerCase() === user.name.toLowerCase())
    );
  }, [visitsList, isRep, user]);

  // Orders total for today: strictly calculated from actual booked orders
  const repTodayOrdersTotal = useMemo(() => {
    return visibleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [visibleOrders]);

  // Visits completed today: strictly calculated from actual completed visits (0 if none visited yet!)
  const repTodayVisitsCount = useMemo(() => {
    return visibleVisits.filter((v) => v.status === 'Completed').length;
  }, [visibleVisits]);

  // Fetch daily analytics:
  const fetchDashboardStats = async () => {
    setIsSyncing(true);
    try {
      // 1. Try native Serverless Backend (/api/dashboard)
      try {
        const liveStats = await dashboardApi.getDashboardSummary();
        if (liveStats) {
          setStats(liveStats);
          setToastMessage(
            isRep
              ? 'Personal territory retail network & beat synchronized!'
              : 'Live Executive Analytics synchronized with FieldAssist Backend!'
          );
          setTimeout(() => setToastMessage(null), 3500);
          return;
        }
      } catch (backendErr) {
        console.warn('Backend /api/dashboard query notice:', backendErr);
      }

      // 2. Try Supabase RPC if configured
      const { data: statsData, error } = await supabase.rpc('get_dashboard_summary');

      if (!error && statsData) {
        setStats({
          today_orders_count: Number(statsData.today_orders_count ?? 6),
          today_orders_total: Number(statsData.today_orders_total ?? 8000.0),
          today_visits_count: Number(statsData.today_visits_count ?? 4),
          today_attendance_count: Number(statsData.today_attendance_count ?? 3),
          total_retailers_count: Number(statsData.total_retailers_count ?? 12),
          total_products_count: Number(statsData.total_products_count ?? 25),
          low_stock_products_count: Number(statsData.low_stock_products_count ?? 2),
        });
      } else {
        const savedVisits = localStorage.getItem('fieldassist_visits');
        const savedRetailers = localStorage.getItem('fieldassist_retailers');
        const savedProducts = localStorage.getItem('fieldassist_products');

        const visitsCount = savedVisits ? JSON.parse(savedVisits).length : 4;
        const retailersCount = savedRetailers ? JSON.parse(savedRetailers).length : 12;
        const productsCount = savedProducts ? JSON.parse(savedProducts).length : 25;

        setStats((prev) => ({
          ...prev,
          today_visits_count: visitsCount,
          total_retailers_count: retailersCount,
          total_products_count: productsCount,
        }));
      }
      setToastMessage(
        isRep
          ? 'Personal beat & quota tracking synchronized!'
          : 'Live Executive Analytics synchronized with field operations!'
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.warn('get_dashboard_summary notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportReport = () => {
    if (isRep) {
      // Rep-isolated CSV report: strictly personal target, allocated area, and own bookings
      const csvRows = [
        ['FieldAssist FMCG - Sales Representative Performance Summary'],
        ['Representative Name', user?.name || 'Field Representative'],
        ['Allocated Area / Beat', userTerritory],
        ['Role', 'Sales Representative'],
        ['Report Generated', new Date().toLocaleString()],
        [],
        ['Managerial Target Quota Policy', 'Monthly targets are assigned exclusively by Area Sales Management. Reps cannot allocate or edit targets.'],
        ['Assigned Monthly Sales Target (INR)', repAssignedTarget ? `₹${repAssignedTarget.salesTargetAmount}` : 'Not Assigned'],
        ['Actual Sales Achieved (INR)', repAssignedTarget ? `₹${repAssignedTarget.salesAchievedAmount}` : '₹0'],
        ['Target Fulfillment %', repAssignedTarget ? `${Math.round((repAssignedTarget.salesAchievedAmount / repAssignedTarget.salesTargetAmount) * 100)}%` : '0%'],
        [],
        ['Today Orders Booked (INR)', `₹${repTodayOrdersTotal.toLocaleString('en-IN')}`],
        ['Today Orders Count', visibleOrders.length.toString()],
        ['Today Field Visits Completed', `${repTodayVisitsCount} / ${areaRetailers.length} Outlets`],
        [],
        [`Allocated Area Retail Network Outlets (${userTerritory})`],
        ['Store Name', 'Location', 'Check-In Status', 'Order Booked (INR)'],
        ...repBeatOutlets.map((b) => [b.name, `"${b.area}"`, b.status, b.orderAmount]),
        [],
        ['My Booked Secondary Orders'],
        ['Order Code', 'Retailer Outlet', 'Amount (INR)', 'Status'],
        ...visibleOrders.map((o) => [o.orderNumber, `"${o.retailerName}"`, o.totalAmount, o.orderStatus]),
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `FieldAssist_Rep_Performance_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToastMessage('Personal Field Performance Report exported successfully (CSV)!');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    // Manager / Admin Company-Wide Executive CSV Report
    const csvRows = [
      ['FieldAssist SaaS - Executive Dashboard Analytics Report'],
      ['Generated On', new Date().toLocaleString()],
      [],
      ['Metric', 'Value'],
      ['Today Orders Total (INR)', `₹${stats.today_orders_total.toLocaleString('en-IN')}`],
      ['Today Orders Booked', stats.today_orders_count],
      ['Field Reps Active on Shift', stats.today_attendance_count],
      ['Total Retail Outlets in Beat', stats.total_retailers_count],
      ['Field Visits Today', stats.today_visits_count],
      ['Active FMCG Products SKU', stats.total_products_count],
      ['Low Stock Alert SKUs', stats.low_stock_products_count],
      [],
      ['Top Selling Products by Volume'],
      ['SKU Code', 'Product Name', 'Category', 'Cases Sold', 'Revenue (INR)'],
      ...mockTopProducts.map((p) => [p.sku, `"${p.name}"`, p.category, p.casesSold, p.revenue]),
      [],
      ['Territory Performance Breakdown'],
      ['Territory', 'Actual Sales (INR)', 'Target (INR)'],
      ...mockTerritoryPerformance.map((t) => [t.territory, t.sales, t.target]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FieldAssist_Executive_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage('Executive Analytics Report exported successfully (CSV)!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-800 text-white shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Welcome & New Beginning Greeting Banner for Newly Created Representatives */}
      {isNewRep && (
        <div className="relative overflow-hidden p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/40 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-400/40 flex items-center justify-center text-3xl shadow-lg shrink-0">
                🎉
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Welcome to FieldAssist, {user?.name || 'Representative'}!
                  </h2>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                    <span>🌱 Fresh Start & New Beginning</span>
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed max-w-2xl">
                  Wishing you great success on your journey as a Field Sales Representative! Your account has been freshly activated. All sales targets, visits, and order counters start at zero. Below are the verified <strong>retail network details</strong> for your assigned area: <strong className="text-white underline decoration-emerald-500">{userTerritory}</strong>. Explore your network, plan your beat visits, and begin booking orders!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
              <Link
                to="/retailers"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Store className="w-4 h-4" />
                <span>Explore Retail Network</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Managerial Target Allocation Authority Notice (Displayed for Sales Rep) */}
      {isRep && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-200 text-sm">
                  Managerial Target Allocation Policy Active
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                  Manager Authority Only
                </span>
              </div>
              <p className="text-amber-300/80 text-[11px] mt-1 leading-relaxed">
                <strong>Strict Governance:</strong> Only your <strong>Area Sales Manager (ASM)</strong> has authorization to allocate, adjust, or assign monthly sales targets. Sales Representatives cannot set or modify targets. You are viewing your personal allocated quota and assigned beat territory only. Peer comparisons and other reps&apos; metrics are restricted.
              </p>
            </div>
          </div>
          <Link
            to="/targets"
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs border border-amber-500/40 shrink-0 flex items-center gap-1.5 self-start sm:self-auto transition-all shadow-sm"
          >
            <TargetIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>View My Quota</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* System Admin User Management Control Center Card (Displayed for System Admin) */}
      {user?.role === 'System Admin' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white text-sm">
                  Admin User Management & Role Authorization
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30">
                  Admin Control Center
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Create new user accounts with Gmail addresses, assign 3 core roles, manage activation status, and reset credentials.
              </p>
            </div>
          </div>
          <Link
            to="/admin/users"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-2 transition-all shadow-md shadow-purple-600/30 self-start sm:self-auto cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-slate-900 to-indigo-950 p-6 lg:p-8 border border-brand-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold mb-3 border border-brand-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isRep
                  ? 'Field Sales Representative • Personal Beat Workspace'
                  : 'Real-Time Executive Operations'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isRep ? 'My Field Performance Dashboard' : 'Field Sales Dashboard'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              {isRep ? (
                <span>
                  Allocated Beat Area: <strong className="text-white">{user?.territory || 'Bengaluru South Beat A'}</strong> • Tracking personal target achievement, beat route store visits, and secondary orders.
                </span>
              ) : (
                'Live performance monitoring for sales reps, territory targets, retailer coverage, and secondary order booking.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!isRep && (
              <Link
                to="/live-tracking"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Navigation className="w-4 h-4 animate-pulse" />
                <span>Live GPS Radar</span>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              </Link>
            )}
            <button
              onClick={fetchDashboardStats}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-md cursor-pointer active:scale-95"
              title="Sync analytics"
            >
              <RefreshCw className={`w-4 h-4 text-brand-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isRep ? 'Sync My Progress' : 'Sync Live Analytics'}</span>
            </button>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isRep ? 'Export My Report' : 'Export Report'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Dynamic KPI Cards */}
      {isRep ? (
        /* Sales Representative Isolated KPI Cards: Allocated Target & Allocated Area Only */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Rep KPI 1: My Allocated Target (Manager Assigned) */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden border border-brand-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                My Allocated Target
              </span>
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
                <TargetIcon className="w-5 h-5" />
              </div>
            </div>
            <div>
              {repAssignedTarget ? (
                <>
                  <div className="text-2xl font-black text-white font-mono">
                    ₹{repAssignedTarget.salesTargetAmount.toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>
                      ₹{repAssignedTarget.salesAchievedAmount.toLocaleString('en-IN')} Achieved (
                      {repAssignedTarget.salesTargetAmount > 0
                        ? Math.round((repAssignedTarget.salesAchievedAmount / repAssignedTarget.salesTargetAmount) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{
                        width: `${
                          repAssignedTarget.salesTargetAmount > 0
                            ? Math.min(
                                100,
                                Math.round((repAssignedTarget.salesAchievedAmount / repAssignedTarget.salesTargetAmount) * 100)
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Set by Area Sales Manager</span>
                    <span className="text-amber-400 font-bold">
                      ₹{Math.max(0, repAssignedTarget.salesTargetAmount - repAssignedTarget.salesAchievedAmount).toLocaleString('en-IN')} to goal
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-slate-300 font-mono">
                    Not Assigned
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-amber-400 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>₹0.00 Achieved (0%)</span>
                  </div>
                  <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-slate-700 h-1.5 rounded-full" style={{ width: '0%' }} />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Pending ASM Allocation</span>
                    <span className="text-slate-500 font-medium">No quota set</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rep KPI 2: My Allocated Area Retail Network */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden border border-indigo-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Territory Retail Network
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white truncate" title={userTerritory}>
                {areaRetailers.length} Outlets
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-indigo-400 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate">{userTerritory}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                Assigned Retail Stores • South Zone
              </div>
            </div>
          </div>

          {/* Rep KPI 3: My Shift Status */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                My Field Shift
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div>
              {userCheckedInToday ? (
                <>
                  <div className="text-xl font-black text-emerald-400">
                    Shift Active
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Punched In: {userPunchInTime ? new Date(userPunchInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2">
                    Geofence Verified • Real GPS Active
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xl font-black text-amber-400">
                    Not Checked In
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs font-semibold">
                    <span>Shift: 09:30 AM – 06:30 PM</span>
                  </div>
                  <div className="text-[10px] text-brand-400 mt-2">
                    <Link to="/attendance" className="underline hover:text-brand-300 font-semibold">Clock in on Attendance page</Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rep KPI 4: My Visits Today */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                My Visits Today
              </span>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {repTodayVisitsCount} / {areaRetailers.length} Stores
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-purple-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {repTodayVisitsCount === 0
                    ? '0 Visits Completed Today'
                    : `${repTodayVisitsCount} Stores Completed`}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                {repTodayVisitsCount === 0
                  ? 'All Territory Outlets Ready'
                  : `${areaRetailers.length - repTodayVisitsCount} Outlets Remaining`}
              </div>
            </div>
          </div>

          {/* Rep KPI 5: My Booked Orders Today */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                My Orders Today
              </span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                ₹{repTodayOrdersTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs font-semibold">
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>{visibleOrders.length} Booked Orders</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                {visibleOrders.length === 0
                  ? 'No orders booked yet today'
                  : 'Total Secondary Sales Booked'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Executive / Manager Company-Wide Overview */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* KPI 1: Today's Orders Total */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Today&apos;s Orders
              </span>
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                ₹{stats.today_orders_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{stats.today_orders_count} orders booked today</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Today's Attendance */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Field Attendance
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {stats.today_attendance_count} Reps
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Active Shift On Field</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Total Retailers */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Retail Network
              </span>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {stats.total_retailers_count} Outlets
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Beat Coverage</span>
              </div>
            </div>
          </div>

          {/* KPI 4: Today's Visits */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Today&apos;s Visits
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {stats.today_visits_count} Visits
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Geofence Check-Ins</span>
              </div>
            </div>
          </div>

          {/* KPI 5: Product Catalog & Stock */}
          <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Product Catalog
              </span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {stats.total_products_count} SKUs
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{stats.low_stock_products_count} Low Stock Alert</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Charts & Performance Focus */}
      {isRep ? (
        /* Sales Rep Isolated View: Target Trajectory & Allocated Beat Checklist (No Inter-Rep Comparison) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rep Personal Sales vs Target Trajectory */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TargetIcon className="w-4 h-4 text-brand-400" />
                  <span>My Target Fulfillment Trajectory</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {repAssignedTarget
                    ? `Personal Sales vs Manager-Assigned Target (₹${(repAssignedTarget.salesTargetAmount / 100000).toFixed(1)} Lakhs)`
                    : 'Personal Sales vs Manager-Assigned Target (Pending Allocation)'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-300 text-[11px] font-semibold border border-brand-500/20">
                Cycle: Oct 2026
              </span>
            </div>

            {repAssignedTarget && repSalesTrajectory.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={repSalesTrajectory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="actualSales"
                      name="My Actual Sales"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#3b82f6' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Manager Target"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 w-full flex flex-col items-center justify-center text-center p-6 space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <TargetIcon className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-bold text-white">No Predefined Target Assigned</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This account currently has no predefined targets. Once your Area Sales Manager assigns your monthly quota from the Targets portal, your performance trajectory will appear here.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Target Status: ₹0 / Pending Manager Allocation
                </span>
              </div>
            )}
          </div>

          {/* Rep's Allocated Area Retail Network Details & Daily Beat Outlets */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-400" />
                  <span>Assigned Retail Network Details</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Specified Area: <strong className="text-slate-200">{userTerritory}</strong>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[11px] font-semibold border border-emerald-500/20">
                {repBeatOutlets.length} Stores in Territory
              </span>
            </div>

            <div className="space-y-2.5">
              {repBeatOutlets.map((outlet, idx) => (
                <div
                  key={outlet.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 transition-colors gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-white truncate">{outlet.name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {outlet.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{outlet.area}</p>
                      {outlet.contact && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{outlet.contact}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    {outlet.orderAmount > 0 ? (
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-400">
                          ₹{outlet.orderAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Billed</div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-xs text-slate-400">{outlet.checkInTime}</div>
                        <div className="text-[10px] text-slate-500">Planned</div>
                      </div>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        outlet.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : outlet.status === 'In Progress'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : outlet.status === 'Ready for Visit'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {outlet.status}
                    </span>
                    <Link
                      to={`/retailers/${outlet.id}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Executive View: Monthly Sales Trend & Multi-Territory Comparison */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Sales Line Chart */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Monthly Sales Performance Trend</h2>
                <p className="text-xs text-slate-400">Actual Revenue vs Target (Line Chart)</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-300 text-[11px] font-semibold">
                May - Oct 2026
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockRevenueTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="actualSales"
                    name="Actual Sales"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Target"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Territory Performance Bar Chart */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Territory Performance Comparison</h2>
                <p className="text-xs text-slate-400">Zone Revenue vs Targets (Bar Chart)</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[11px] font-semibold">
                North Region
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockTerritoryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="territory" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="sales" name="Actual Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Target" fill="#334155" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Top Selling Products & Orders Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Top 5 FMCG Products by Volume</h2>
              <p className="text-xs text-slate-400">Fast moving SKUs in distribution</p>
            </div>
            <Link
              to="/products"
              className="text-xs font-semibold text-brand-400 flex items-center gap-1 hover:text-brand-300"
            >
              <span>View Catalog</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {mockTopProducts.map((prod, idx) => (
              <div
                key={prod.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-400 font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-white line-clamp-1">{prod.name}</h3>
                    <p className="text-[11px] text-slate-400">
                      {prod.category} • SKU: {prod.sku}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">
                    ₹{(prod.revenue / 1000).toFixed(1)}k
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {prod.casesSold} Cases
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Secondary Orders Stream (Filtered to Rep in Rep Mode) */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                {isRep ? 'My Secondary Orders Stream' : 'Live Secondary Orders Stream'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRep
                  ? `Orders booked by you in ${user?.territory || 'Bengaluru South Beat A'}`
                  : 'Latest field orders booked by sales reps'}
              </p>
            </div>
            <Link
              to="/orders"
              className="text-xs font-semibold text-brand-400 flex items-center gap-1 hover:text-brand-300"
            >
              <span>{isRep ? 'My Orders' : 'All Orders'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {visibleOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Retailer</th>
                    {!isRep && <th className="py-2.5 px-3">Sales Rep</th>}
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {visibleOrders.slice(0, 5).map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white">{ord.orderNumber}</td>
                      <td className="py-3 px-3 text-slate-300 max-w-[140px] truncate">{ord.retailerName}</td>
                      {!isRep && <td className="py-3 px-3 text-slate-400">{ord.repName}</td>}
                      <td className="py-3 px-3 font-bold text-emerald-400">
                        ₹{ord.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.orderStatus === 'Approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : ord.orderStatus === 'Processing'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {ord.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                🛒
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-bold text-white">No Orders Placed Yet</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You have not booked any orders yet. Visit stores in your assigned territory to start booking retailer orders.
                </p>
              </div>
              <Link
                to="/orders"
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-brand-600/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book First Order</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Field Visits Audit Log (Filtered to Rep in Rep Mode) */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-brand-400" />
              <span>
                {isRep ? 'My Field Beat Schedule & Geofence Visits' : "Today's Field Visits Audit Log"}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isRep
                ? `Geofence verified check-ins and appointments for ${userTerritory}`
                : 'Geofence verified check-ins and outlet appointments'}
            </p>
          </div>
          <Link
            to="/visits"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <span>{isRep ? 'My Visits' : 'View All Visits'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {visibleVisits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Visit Code</th>
                  <th className="py-3 px-4">Retailer Outlet</th>
                  {!isRep && <th className="py-3 px-4">Sales Rep</th>}
                  <th className="py-3 px-4">Check-In Time</th>
                  <th className="py-3 px-4">GPS Geofence</th>
                  <th className="py-3 px-4">Order Booked</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {visibleVisits.map((vis) => (
                  <tr key={vis.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-400">{vis.visitCode}</td>
                    <td className="py-3.5 px-4 text-white font-bold">{vis.retailerName}</td>
                    {!isRep && <td className="py-3.5 px-4 text-slate-300">{vis.repName}</td>}
                    <td className="py-3.5 px-4 text-slate-400">{vis.actualCheckIn || vis.plannedTime}</td>
                    <td className="py-3.5 px-4">
                      {vis.geofenceVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                          <ShieldCheck className="w-4 h-4" /> Verified (50m)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      {vis.orderBookedAmount > 0 ? `₹${vis.orderBookedAmount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          vis.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : vis.status === 'In Progress'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {vis.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
              📍
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-sm font-bold text-white">No Field Visits Logged Yet</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                You haven&apos;t conducted any store visits yet. Check in to your assigned retail network stores above with GPS to record your first visit.
              </p>
            </div>
            <Link
              to="/visits"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Schedule First Visit</span>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};
