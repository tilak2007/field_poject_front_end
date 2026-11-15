import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target as TargetIcon,
  Plus,
  X,
  CheckCircle2,
  User,
  Calendar,
  IndianRupee,
  MapPin,
  Download,
  ShieldAlert,
  Clock,
  Briefcase,
} from 'lucide-react';
import { targetsApi, type Target } from '../api/targetsApi';
import { useAuth } from '../context/AuthContext';
import { exportToCsv } from '../utils/exportCsv';
import { isUnderManagerTerritory } from '../utils/territory';

export const Targets: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'System Admin';
  const isManager = user?.role === 'Sales Manager';
  const isRep = !isAdmin && !isManager;

  // Synchronous cache read so there is zero flash and zero lost data
  const [targetsList, setTargetsList] = useState<Target[]>(() => {
    return targetsApi.getLocalTargets();
  });

  const [showAllocateModal, setShowAllocateModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for target allocation
  const [targetRole, setTargetRole] = useState<'Sales Representative' | 'Sales Manager'>('Sales Representative');
  const [selectedPersonKey, setSelectedPersonKey] = useState<string>('rep-1');
  const [monthYear, setMonthYear] = useState<string>('November 2026');
  const [salesTargetAmount, setSalesTargetAmount] = useState<number>(1800000);
  const [visitsTargetCount, setVisitsTargetCount] = useState<number>(160);
  const [newOutletsTargetCount, setNewOutletsTargetCount] = useState<number>(15);

  // Load and refresh targets
  const refreshTargets = async () => {
    const list = targetsApi.getLocalTargets();
    setTargetsList(list);
  };

  useEffect(() => {
    refreshTargets();
  }, [user]);

  // Available personnel for quota allocation based on authority
  // - System Admin: can assign to both Sales Managers and Sales Representatives
  // - Sales Manager: can assign to Sales Representatives in their assigned territory
  const allocatablePersonnel = useMemo(() => {
    const allPersonnel: Array<{
      id: string;
      name: string;
      role: 'Sales Representative' | 'Sales Manager';
      territory: string;
    }> = [
      // Sales Representatives
      { id: 'rep-1', name: 'Vikram Sharma', role: 'Sales Representative', territory: 'Bengaluru South' },
      { id: 'rep-2', name: 'Ananya Verma', role: 'Sales Representative', territory: 'Bengaluru Central' },
      { id: 'rep-3', name: 'Rahul Deshmukh', role: 'Sales Representative', territory: 'Bengaluru East' },
      { id: 'rep-4', name: 'Priya Sundaram', role: 'Sales Representative', territory: 'Bengaluru West' },
      { id: 'rep-5', name: 'Karan Patel', role: 'Sales Representative', territory: 'Bengaluru North' },
      { id: 'rep-6', name: 'Sneha Roy', role: 'Sales Representative', territory: 'Bengaluru South' },
      { id: 'rep-nagarjun', name: 'Nagarjun B.G.', role: 'Sales Representative', territory: 'Bengaluru South' },
      { id: 'rep-7', name: 'Rohit Mehta', role: 'Sales Representative', territory: 'Mumbai South' },
      { id: 'rep-8', name: 'Suresh Raina', role: 'Sales Representative', territory: 'Delhi NCR' },
      { id: 'rep-9', name: 'Amitabh Sen', role: 'Sales Representative', territory: 'Kolkata Central' },

      // Sales Managers
      { id: 'mgr-1', name: 'Bengaluru Area Sales Manager', role: 'Sales Manager', territory: 'Bengaluru South' },
      { id: 'mgr-2', name: 'Mumbai Regional Sales Manager', role: 'Sales Manager', territory: 'Mumbai South' },
      { id: 'mgr-3', name: 'Delhi Regional Sales Manager', role: 'Sales Manager', territory: 'Delhi NCR' },
      { id: 'mgr-4', name: 'Kolkata Regional Sales Manager', role: 'Sales Manager', territory: 'Kolkata Central' },
    ];

    // Read any registered accounts from registry
    try {
      const reg = localStorage.getItem('fieldassist_accounts_registry');
      if (reg) {
        const parsed = JSON.parse(reg);
        Object.values(parsed).forEach((acc: any) => {
          if (acc?.user?.name && !allPersonnel.some((p) => p.name.toLowerCase() === acc.user.name.toLowerCase())) {
            allPersonnel.push({
              id: acc.user.id || `usr-${acc.user.email?.replace(/[^a-zA-Z0-9]/g, '_')}`,
              name: acc.user.name,
              role: acc.user.role === 'Sales Manager' ? 'Sales Manager' : 'Sales Representative',
              territory: acc.user.territory || 'Bengaluru South',
            });
          }
        });
      }
    } catch {}

    // Filter by role selected in modal
    let filtered = allPersonnel.filter((p) => p.role === targetRole);

    // If current user is Sales Manager: can ONLY assign targets to reps in their territory!
    if (isManager) {
      filtered = filtered.filter(
        (p) => p.role === 'Sales Representative' && isUnderManagerTerritory(user as any, { territory: p.territory })
      );
    }

    return filtered;
  }, [targetRole, isManager, user]);

  // Keep person selection in sync with role toggle
  useEffect(() => {
    if (allocatablePersonnel.length > 0 && !allocatablePersonnel.some((p) => p.id === selectedPersonKey)) {
      setSelectedPersonKey(allocatablePersonnel[0].id);
    }
  }, [allocatablePersonnel, selectedPersonKey]);

  // Separate targets for Manager view:
  // 1. Manager's OWN quota (assigned by Admin)
  const myManagerTarget = useMemo(() => {
    if (!isManager) return null;
    return targetsList.find(
      (t) =>
        t.repRole === 'Sales Manager' &&
        ((user?.id && t.repId === user.id) ||
          (user?.name && t.repName.toLowerCase() === user.name.toLowerCase()) ||
          t.territory.toLowerCase().includes(user?.territory?.toLowerCase() || ''))
    );
  }, [targetsList, isManager, user]);

  // 2. Visible targets for user:
  const visibleTargets: Target[] = useMemo(() => {
    if (isRep) {
      // Sales Representative: ONLY sees their own personal target
      const isVikram = user?.email === 'vikram@fieldassist.io' || user?.email === 'vikram.s@fieldassist.io';
      return targetsList.filter((t) => {
        if (isVikram && (t.repId === 'rep-1' || t.repName.toLowerCase().includes('vikram'))) return true;
        if (user?.id && t.repId === user.id) return true;
        if (user?.name && t.repName.toLowerCase() === user.name.toLowerCase()) return true;
        if (user?.email && t.repId.includes(user.email.split('@')[0])) return true;
        return false;
      });
    }

    if (isManager) {
      // Sales Manager: Sees targets of representatives under their territory
      return targetsList.filter((t) => {
        if (t.repRole === 'Sales Manager') return false; // Show in dedicated section
        return isUnderManagerTerritory(user as any, { territory: t.territory });
      });
    }

    // System Admin sees all targets
    return targetsList;
  }, [targetsList, isRep, isManager, user]);

  const handleOpenAllocateModal = () => {
    if (isRep) {
      alert('Only Area Sales Managers or System Admins have authorization to allocate monthly targets.');
      return;
    }
    setTargetRole('Sales Representative');
    setSalesTargetAmount(1800000);
    setVisitsTargetCount(160);
    setNewOutletsTargetCount(15);
    setShowAllocateModal(true);
  };

  const handleAllocateTarget = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedPerson = allocatablePersonnel.find((p) => p.id === selectedPersonKey) || allocatablePersonnel[0];
    if (!selectedPerson) return;

    const assigned = await targetsApi.allocateTarget({
      repId: selectedPerson.id,
      repName: selectedPerson.name,
      repRole: selectedPerson.role,
      territory: selectedPerson.territory,
      monthYear,
      salesTargetAmount: Number(salesTargetAmount) || 1500000,
      visitsTargetCount: Number(visitsTargetCount) || 150,
      newOutletsTargetCount: Number(newOutletsTargetCount) || 12,
      assignedBy: user?.name || (isAdmin ? 'System Administrator' : 'Area Sales Manager'),
    });

    const refreshed = targetsApi.getLocalTargets();
    setTargetsList(refreshed);
    setShowAllocateModal(false);

    setToastMessage(`Monthly target for ${assigned.repName} (${assigned.monthYear}) successfully saved and deployed!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `fieldassist_targets_${new Date().toISOString().split('T')[0]}`,
      visibleTargets,
      [
        { header: 'Target Holder', key: 'repName' },
        { header: 'Role', key: (t) => t.repRole || 'Sales Representative' },
        { header: 'Territory', key: 'territory' },
        { header: 'Month / Cycle', key: 'monthYear' },
        { header: 'Target Sales (INR)', key: (t) => `₹${t.salesTargetAmount.toLocaleString('en-IN')}` },
        { header: 'Achieved Sales (INR)', key: (t) => `₹${t.salesAchievedAmount.toLocaleString('en-IN')}` },
        {
          header: 'Achievement %',
          key: (t) => `${Math.round((t.salesAchievedAmount / (t.salesTargetAmount || 1)) * 100)}%`,
        },
        { header: 'Target Visits', key: 'visitsTargetCount' },
        { header: 'Achieved Visits', key: 'visitsAchievedCount' },
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
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white p-1 rounded-lg">
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
            <span>{isRep ? 'My Allocated Sales Target' : 'Sales Quotas & Target Management'}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {isRep
              ? `Personal monthly sales quota assigned by your Area Sales Manager for ${user?.territory || 'Bengaluru South'}.`
              : 'Monthly revenue targets, visits quota tracking, and team quota allocation.'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isRep
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isAdmin
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              Role: {user?.role || 'Field Sales Force'}
            </span>
            <span className="text-[11px] text-slate-400">
              {isRep
                ? '• Field Representative: Personal Target Quota (View Only)'
                : isAdmin
                ? '• System Admin: Full Nationwide Quota Governance (Rep & Manager)'
                : `• Sales Manager: ${user?.territory || 'Bengaluru'} Jurisdiction Quotas`}
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

          {!isRep && (
            <button
              onClick={handleOpenAllocateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Assign New Target</span>
            </button>
          )}
        </div>
      </div>

      {/* POLICY NOTICE FOR SALES REPS */}
      {isRep && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Managerial Target Assignment Only: </span>
              <span>
                Monthly sales quotas and territory targets are established and assigned exclusively by your Area Sales Manager. Targets reflect your real bookings and visits.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold shrink-0">
            VIEW ONLY • REVENUE QUOTA
          </span>
        </div>
      )}

      {/* SALES MANAGER DEDICATED SECTION: My Manager Quota (Assigned by Admin) */}
      {isManager && myManagerTarget && (
        <div className="glass-panel p-6 rounded-3xl border border-brand-500/30 bg-slate-900/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/30">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  Regional Territory Management Quota
                </span>
                <h3 className="text-base font-bold text-white">
                  My Territory Target: {myManagerTarget.territory} ({myManagerTarget.monthYear})
                </h3>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Assigned by Executive Admin
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">Territory Revenue Target</span>
              <div className="text-xl font-extrabold text-white font-mono">
                ₹{(myManagerTarget.salesTargetAmount / 100000).toFixed(2)} Lakhs
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold">
                Achieved: ₹{(myManagerTarget.salesAchievedAmount / 100000).toFixed(2)} Lakhs (
                {Math.round((myManagerTarget.salesAchievedAmount / (myManagerTarget.salesTargetAmount || 1)) * 100)}%)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">Territory Visits Quota</span>
              <div className="text-xl font-extrabold text-white font-mono">
                {myManagerTarget.visitsTargetCount} Field Visits
              </div>
              <div className="text-[11px] text-brand-300 font-semibold">
                Team Completed: {myManagerTarget.visitsAchievedCount} Outlets
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">New Outlets Expansion Goal</span>
              <div className="text-xl font-extrabold text-white font-mono">
                {myManagerTarget.newOutletsTargetCount} Outlets
              </div>
              <div className="text-[11px] text-slate-400">
                Acquired: {myManagerTarget.newOutletsAchievedCount} Outlets
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Cards Grid */}
      {visibleTargets.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {isRep ? 'Your Active Quota' : isManager ? 'Territory Sales Representatives Quotas' : 'All Nationwide Quotas'} (
              {visibleTargets.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTargets.map((tgt) => {
              const salesPct =
                tgt.salesTargetAmount > 0 ? Math.round((tgt.salesAchievedAmount / tgt.salesTargetAmount) * 100) : 0;

              return (
                <div key={tgt.id} className="glass-card glass-card-hover p-6 rounded-2xl space-y-5 border border-slate-800">
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
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-normal">
                        {tgt.repRole || 'Sales Representative'}
                      </span>
                    </h3>
                    <p className="text-xs text-brand-400 mt-0.5 font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{tgt.territory || 'Bengaluru South'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Assigned by: <strong className="text-slate-200">{tgt.assignedBy || 'Area Sales Manager'}</strong>
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Revenue Progress</span>
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
        </div>
      ) : (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border border-slate-800 max-w-2xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <TargetIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">No Targets Assigned for this Cycle</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
              This account has no monthly quotas assigned yet. In accordance with enterprise sales force governance, monthly targets are allocated by your <strong>Area Sales Manager (ASM)</strong>.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Target Status: ₹0 / Pending Allocation</span>
          </div>
        </div>
      )}

      {/* Modal: Allocate Monthly Targets (Managers and Admins) */}
      <AnimatePresence>
        {showAllocateModal && !isRep && (
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
                    <h2 className="text-base font-bold text-white">Assign Monthly Target</h2>
                    <p className="text-xs text-slate-400">
                      {isAdmin ? 'Assign revenue quotas for Reps or Managers' : 'Assign revenue quota for territory reps'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAllocateTarget} className="p-6 space-y-4">
                {/* Admin role selector: Can allocate to Rep or Manager */}
                {isAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Target Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetRole('Sales Representative')}
                        className={`h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          targetRole === 'Sales Representative'
                            ? 'bg-brand-600 text-white shadow-md'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        Sales Representative
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetRole('Sales Manager')}
                        className={`h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          targetRole === 'Sales Manager'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        Sales Manager
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-400" />
                    <span>Select {targetRole} *</span>
                  </label>
                  <select
                    value={selectedPersonKey}
                    onChange={(e) => setSelectedPersonKey(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {allocatablePersonnel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.territory} • {p.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-400" />
                    <span>Quota Month & Cycle *</span>
                  </label>
                  <select
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="November 2026">November 2026</option>
                    <option value="December 2026">December 2026</option>
                    <option value="January 2027">January 2027</option>
                    <option value="February 2027">February 2027</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-brand-400" />
                    <span>Sales Revenue Target (₹) *</span>
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
                      max="1000"
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
                      max="200"
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
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <TargetIcon className="w-4 h-4" />
                    <span>Confirm & Assign Target</span>
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
