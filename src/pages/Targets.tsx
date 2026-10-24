import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target as TargetIcon, Plus, X, CheckCircle2, User, Calendar, IndianRupee, MapPin, Download, ShieldAlert } from 'lucide-react';
import { mockTargets } from '../data/mockData';
import type { Target } from '../types';
import { useAuth } from '../context/AuthContext';
import { exportToCsv } from '../utils/exportCsv';

export const Targets: React.FC = () => {
  const { user } = useAuth();
  const isRep = user?.role === 'Sales Representative';
  const isManagerOrAdmin = !isRep;

  const [targetsList, setTargetsList] = useState<Target[]>(() => {
    const saved = localStorage.getItem('fieldassist_targets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockTargets;
  });

  const [showAllocateModal, setShowAllocateModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [repName, setRepName] = useState('Vikram Sharma');
  const [monthYear, setMonthYear] = useState('November 2026');
  const [salesTargetAmount, setSalesTargetAmount] = useState<number>(1800000);
  const [visitsTargetCount, setVisitsTargetCount] = useState<number>(160);
  const [newOutletsTargetCount, setNewOutletsTargetCount] = useState<number>(15);

  const repMatchedTargets = targetsList.filter(
    (t) =>
      t.repName.toLowerCase().includes((user?.name || 'vikram').toLowerCase()) ||
      t.repId === user?.id ||
      t.repId === 'rep-1'
  );

  // Sales Rep can ONLY see their own personal target. No comparisons or other reps' metrics.
  const visibleTargets: Target[] = isRep
    ? repMatchedTargets.length > 0
      ? [repMatchedTargets[0]]
      : [
          {
            id: 'tgt-personal',
            repId: user?.id || 'rep-1',
            repName: user?.name || 'Vikram Sharma',
            monthYear: 'October 2026',
            salesTargetAmount: 500000,
            salesAchievedAmount: 422500,
            visitsTargetCount: 150,
            visitsAchievedCount: 128,
            newOutletsTargetCount: 12,
            newOutletsAchievedCount: 10,
            status: 'On Track',
          },
        ]
    : targetsList;

  const handleOpenAllocateModal = () => {
    if (!isManagerOrAdmin) {
      alert('Only Area Sales Managers have authorization to allocate monthly targets.');
      return;
    }
    setSalesTargetAmount(1800000);
    setVisitsTargetCount(160);
    setNewOutletsTargetCount(15);
    setShowAllocateModal(true);
  };

  const handleAllocateTarget = (e: React.FormEvent) => {
    e.preventDefault();

    const newTarget: Target = {
      id: `tgt-${Date.now()}`,
      repId: `rep-${Date.now()}`,
      repName,
      monthYear,
      salesTargetAmount: Number(salesTargetAmount) || 1500000,
      salesAchievedAmount: 0,
      visitsTargetCount: Number(visitsTargetCount) || 150,
      visitsAchievedCount: 0,
      newOutletsTargetCount: Number(newOutletsTargetCount) || 12,
      newOutletsAchievedCount: 0,
      status: 'On Track',
    };

    const updated = [newTarget, ...targetsList];
    setTargetsList(updated);
    localStorage.setItem('fieldassist_targets', JSON.stringify(updated));
    setShowAllocateModal(false);

    setToastMessage(`Monthly sales quota allocated for ${repName} (${monthYear}) successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `fieldassist_targets_${new Date().toISOString().split('T')[0]}`,
      visibleTargets,
      [
        { header: 'Representative', key: 'repName' },
        { header: 'Month / Cycle', key: 'monthYear' },
        { header: 'Target Sales (INR)', key: (t) => `₹${t.salesTargetAmount.toLocaleString('en-IN')}` },
        { header: 'Achieved Sales (INR)', key: (t) => `₹${t.salesAchievedAmount.toLocaleString('en-IN')}` },
        { header: 'Achievement %', key: (t) => `${Math.round((t.salesAchievedAmount / (t.salesTargetAmount || 1)) * 100)}%` },
        { header: 'Target Visits', key: 'visitsTargetCount' },
        { header: 'Achieved Visits', key: 'visitsAchievedCount' },
        { header: 'Target Outlets', key: 'newOutletsTargetCount' },
        { header: 'Achieved Outlets', key: 'newOutletsAchievedCount' },
        { header: 'Status', key: 'status' },
      ]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-xs font-semibold shadow-xl"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <TargetIcon className="w-7 h-7 text-brand-400" />
            <span>Sales Quotas & Targets</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Monthly revenue targets, visit quota tracking, and outlet acquisition goals.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                user?.role === 'Sales Representative'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : user?.role === 'System Admin'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              Role: {user?.role || 'Sales Manager'}
            </span>
            <span className="text-[11px] text-slate-400">
              {user?.role === 'Sales Representative'
                ? '• Field Rep: Track Personal Target Fulfillment'
                : '• Management: Quota Allocation & Achievement Oversight'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Export Targets CSV"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export CSV</span>
          </button>

          {isManagerOrAdmin && (
            <button
              onClick={handleOpenAllocateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Allocate Monthly Targets</span>
            </button>
          )}
        </div>
      </div>

      {/* Policy Notice for Sales Reps */}
      {isRep && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Managerial Target Assignment Only: </span>
              <span>
                Monthly sales quotas and territory targets are established and assigned exclusively by your Area Sales Manager. As a Sales Representative, you cannot allocate, edit, or adjust quotas.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold shrink-0">
            VIEW ONLY • REVENUE QUOTA
          </span>
        </div>
      )}

      {/* Target Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleTargets.map((tgt) => {
          const salesPct =
            tgt.salesTargetAmount > 0
              ? Math.round((tgt.salesAchievedAmount / tgt.salesTargetAmount) * 100)
              : 0;

          return (
            <div
              key={tgt.id}
              className="glass-card glass-card-hover p-6 rounded-2xl space-y-5 border border-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">{tgt.monthYear}</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    tgt.status === 'Achieved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : tgt.status === 'On Track'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {tgt.status}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{tgt.repName}</span>
                  {isRep && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-300 font-normal">
                      Your Assigned Quota
                    </span>
                  )}
                </h3>
                <p className="text-xs text-brand-400 mt-0.5 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Allocated Area: {user?.territory || 'North Delhi (Sector 14 & 18)'}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Assigned by: <strong className="text-slate-200">Area Sales Manager</strong>
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Revenue Achieved</span>
                  <span className="font-extrabold text-emerald-400">{salesPct}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(salesPct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <span>₹{(tgt.salesAchievedAmount / 100000).toFixed(2)}L</span>
                  <span>Target: ₹{(tgt.salesTargetAmount / 100000).toFixed(2)}L</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block">Visits Completed</span>
                  <span className="font-bold text-white">
                    {tgt.visitsAchievedCount} / {tgt.visitsTargetCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block">New Outlets</span>
                  <span className="font-bold text-white">
                    {tgt.newOutletsAchievedCount} / {tgt.newOutletsTargetCount}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Allocate Monthly Targets */}
      <AnimatePresence>
        {showAllocateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
                    <TargetIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Allocate Monthly Targets</h2>
                    <p className="text-xs text-slate-400">Assign revenue quotas and visit targets for field rep</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAllocateTarget} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-400" />
                    <span>Select Sales Representative *</span>
                  </label>
                  <select
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Vikram Sharma">Vikram Sharma (North Delhi)</option>
                    <option value="Ananya Verma">Ananya Verma (South Mumbai)</option>
                    <option value="Rahul Deshmukh">Rahul Deshmukh (Bengaluru)</option>
                    <option value="Priya Patel">Priya Patel (Ahmedabad)</option>
                    <option value="Amit Singh">Amit Singh (West Delhi)</option>
                    <option value="Neha Gupta">Neha Gupta (Kolkata)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-400" />
                    <span>Quota Month & Year *</span>
                  </label>
                  <select
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="October 2026">October 2026</option>
                    <option value="November 2026">November 2026</option>
                    <option value="December 2026">December 2026</option>
                    <option value="January 2027">January 2027</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-brand-400" />
                    <span>Secondary Sales Revenue Target (₹) *</span>
                  </label>
                  <input
                    type="number"
                    step="50000"
                    min="100000"
                    required
                    value={salesTargetAmount}
                    onChange={(e) => setSalesTargetAmount(Number(e.target.value))}
                    className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                  <span className="text-[11px] text-slate-400 block font-mono">
                    ₹{(salesTargetAmount / 100000).toFixed(2)} Lakhs
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-400" />
                      <span>Visits Quota</span>
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      required
                      value={visitsTargetCount}
                      onChange={(e) => setVisitsTargetCount(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">New Outlets Goal</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={newOutletsTargetCount}
                      onChange={(e) => setNewOutletsTargetCount(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllocateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
                  >
                    <TargetIcon className="w-4 h-4" />
                    <span>Confirm Target Allocation</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Targets;
