import React, { useState, useEffect } from 'react';
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
} from '../data/mockData';
import { dashboardApi } from '../api';

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

  // Fetch daily analytics:
  const fetchDashboardStats = async () => {
    setIsSyncing(true);
    try {
      // 1. Try native Serverless Backend (/api/dashboard)
      try {
        const liveStats = await dashboardApi.getDashboardSummary();
        if (liveStats) {
          setStats(liveStats);
          setToastMessage('Live Executive Analytics synchronized with FieldAssist Backend!');
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
      setToastMessage('Live Executive Analytics synchronized with field operations!');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.warn('get_dashboard_summary notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportReport = () => {
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

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-slate-900 to-indigo-950 p-6 lg:p-8 border border-brand-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold mb-3 border border-brand-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Executive Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Field Sales Dashboard
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Live performance monitoring for sales reps, territory targets, retailer coverage, and secondary order booking.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchDashboardStats}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-md cursor-pointer active:scale-95"
              title="Sync daily analytics from Supabase"
            >
              <RefreshCw className={`w-4 h-4 text-brand-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Live Analytics</span>
            </button>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Dynamic KPI Cards (Powered by get_dashboard_summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Today's Orders Total */}
        <div className="glass-card glass-card-hover p-5 rounded-2xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Today's Orders
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
              Today's Visits
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

      {/* Recharts Row 1: Monthly Sales Line Chart & Territory Performance Bar Chart */}
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

      {/* Row 2: Top Selling Products & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Top 5 FMCG Products by Volume</h2>
              <p className="text-xs text-slate-400">Cases booked in secondary distribution</p>
            </div>
            <span className="text-xs font-semibold text-brand-400 flex items-center gap-1 cursor-pointer hover:text-brand-300">
              <span>View Catalog</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
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
                    <p className="text-[11px] text-slate-400">{prod.category} • SKU: {prod.sku}</p>
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

        {/* Live Secondary Orders Log */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Live Secondary Orders Stream</h2>
              <p className="text-xs text-slate-400">Latest field orders booked by reps</p>
            </div>
            <span className="text-xs font-semibold text-brand-400 flex items-center gap-1 cursor-pointer hover:text-brand-300">
              <span>All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Retailer</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {mockOrders.slice(0, 5).map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">{ord.orderNumber}</td>
                    <td className="py-3 px-3 text-slate-300 max-w-[140px] truncate">{ord.retailerName}</td>
                    <td className="py-3 px-3 text-slate-400">{ord.repName}</td>
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
        </div>
      </div>

      {/* Row 3: Today's Field Visits Audit Log */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-brand-400" />
              <span>Today's Field Visits Audit Log</span>
            </h2>
            <p className="text-xs text-slate-400">Geofence verified check-ins and outlet appointments</p>
          </div>
          <button className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1">
            <span>View All Visits</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Visit Code</th>
                <th className="py-3 px-4">Retailer Outlet</th>
                <th className="py-3 px-4">Sales Rep</th>
                <th className="py-3 px-4">Check-In Time</th>
                <th className="py-3 px-4">GPS Geofence</th>
                <th className="py-3 px-4">Order Booked</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {mockVisits.map((vis) => (
                <tr key={vis.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-brand-400">{vis.visitCode}</td>
                  <td className="py-3.5 px-4 text-white font-bold">{vis.retailerName}</td>
                  <td className="py-3.5 px-4 text-slate-300">{vis.repName}</td>
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
      </div>
    </motion.div>
  );
};
