import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { mockRevenueTrends } from '../data/mockData';

export const Analytics: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportBIDatasets = () => {
    setIsExporting(true);

    try {
      // Build comprehensive BI Dataset CSV
      const rows = [
        ['FieldAssist BI Analytics Dataset - Comprehensive Export'],
        ['Generated Date', new Date().toLocaleString()],
        ['Scope', 'All Zones (North, South, West, East)'],
        [],
        ['--- 1. MONTHLY REVENUE & VISIT PERFORMANCE ---'],
        ['Month', 'Actual Revenue (INR)', 'Target Revenue (INR)', 'Variance (INR)', 'Achievement (%)', 'Field Visits'],
      ];

      mockRevenueTrends.forEach((item) => {
        const variance = item.actual - item.target;
        const achievement = ((item.actual / item.target) * 100).toFixed(1);
        rows.push([
          item.month,
          item.actual.toString(),
          item.target.toString(),
          variance.toString(),
          `${achievement}%`,
          item.visits.toString(),
        ]);
      });

      rows.push([]);
      rows.push(['--- 2. REGIONAL EFFICIENCY BENCHMARKS ---']);
      rows.push(['Region', 'Active Reps', 'Outlet Reach', 'Avg Daily Visits/Rep', 'Secondary Sales (INR)', 'Productivity Index']);
      rows.push(['North Zone', '14', '320', '18.4', '2850000', '94.2%']);
      rows.push(['South Zone', '18', '410', '21.2', '3420000', '98.5%']);
      rows.push(['West Zone', '12', '275', '17.8', '2410000', '91.0%']);
      rows.push(['East Zone', '8', '190', '16.5', '1680000', '88.4%']);

      rows.push([]);
      rows.push(['--- 3. CATEGORY REVENUE DISTRIBUTION ---']);
      rows.push(['Category', 'Volume (Cases)', 'Revenue (INR)', 'Gross Margin %', 'Market Share %']);
      rows.push(['Beverages', '4200', '1764000', '28.4%', '34.2%']);
      rows.push(['Snacks & Confectionery', '3150', '882000', '24.1%', '22.8%']);
      rows.push(['Personal Care & Hygiene', '2800', '3080000', '36.5%', '31.5%']);
      rows.push(['Staples & Packaged Food', '1900', '1250000', '18.0%', '11.5%']);

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((cell) => `"${cell}"`).join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `FieldAssist_BI_Datasets_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToastMessage('Field BI Datasets exported successfully as CSV!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Failed to export BI datasets:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 relative"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-2xl backdrop-blur-md"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold text-white">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-brand-400" />
            <span>Field Analytics & Business Intelligence</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Predictive sales forecasting, beat efficiency indexes, and territory performance benchmarks.
          </p>
        </div>

        <button
          onClick={handleExportBIDatasets}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          {isExporting ? <CheckCircle2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{isExporting ? 'Generating BI Export...' : 'Export BI Datasets'}</span>
        </button>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue vs Target */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white">6-Month Secondary Sales Performance</h2>
            <p className="text-xs text-slate-400">Actual secondary revenue vs allocated targets</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockRevenueTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="actual" fill="#4f6bf6" radius={[6, 6, 0, 0]} name="Actual Revenue" />
                <Bar dataKey="target" fill="#334155" radius={[6, 6, 0, 0]} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Visit Velocity & Volume */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white">Monthly Outlet Visit Volume</h2>
            <p className="text-xs text-slate-400">Total field visits logged across all zones</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRevenueTrends}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVisits)"
                  name="Total Visits"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
