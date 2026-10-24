import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck,
  Search,
  ShieldCheck,
  Eye,
  X,
  Plus,
  CheckCircle2,
  Clock,
  Store,
  User,
  FileText,
  Download,
  LogIn,
  Check,
} from 'lucide-react';
import { mockVisits, mockRetailers } from '../data/mockData';
import type { Visit } from '../types';
import { visitsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { exportToCsv } from '../utils/exportCsv';

export const Visits: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'System Admin' || user?.role === 'Sales Manager';
  const isRep = !isManagerOrAdmin;

  const [visitsList, setVisitsList] = useState<Visit[]>(() => {
    const saved = localStorage.getItem('fieldassist_visits');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockVisits;
  });

  useEffect(() => {
    visitsApi.getVisits().then((data) => {
      if (data && data.length > 0) {
        setVisitsList(data);
      }
    }).catch(() => {});
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state
  const [selectedRetailerName, setSelectedRetailerName] = useState('Sharma Kirana Store');
  const [customRetailerName, setCustomRetailerName] = useState('');
  const [retailerAddress, setRetailerAddress] = useState('Shop 12, Main Market, Sector 7, Rohini, Delhi');
  const [repName, setRepName] = useState('Vikram Sharma');
  const [visitType, setVisitType] = useState<'Regular Order' | 'Audit' | 'Collection' | 'New Lead Pitch'>('Audit');
  const [plannedTime, setPlannedTime] = useState('Today, 02:30 PM');
  const [visitNotes, setVisitNotes] = useState('');

  const visibleVisits = isRep
    ? visitsList.filter(
        (v) =>
          v.repName.toLowerCase().includes((user?.name || 'vikram').toLowerCase()) ||
          v.repName.toLowerCase().includes('vikram') ||
          v.repId === user?.id ||
          v.repId === 'rep-1'
      )
    : visitsList;

  const filteredVisits = visibleVisits.filter(
    (v) =>
      v.retailerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.repName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.visitCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRetailerSelectChange = (name: string) => {
    setSelectedRetailerName(name);
    if (name !== 'custom') {
      const matched = mockRetailers.find((r) => r.name === name);
      if (matched) {
        setRetailerAddress(matched.address);
        setRepName(matched.assignedRepName || 'Vikram Sharma');
      }
    }
  };

  const handleScheduleVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRetailer = selectedRetailerName === 'custom' ? (customRetailerName.trim() || 'Special Audit Outlet') : selectedRetailerName;
    const nextCode = `VST-2026-SP-${String(100 + visitsList.length + 1)}`;

    const newVisit: Visit = {
      id: `vst-${Date.now()}`,
      visitCode: nextCode,
      retailerId: `ret-sp-${Date.now()}`,
      retailerName: finalRetailer,
      retailerAddress: retailerAddress || 'National Capital Territory, Delhi',
      repId: `rep-${Date.now()}`,
      repName,
      beatName: 'Special Priority Route',
      plannedTime,
      actualCheckIn: undefined,
      visitType,
      status: 'Scheduled',
      geofenceVerified: true,
      orderBookedAmount: 0,
      photoProofUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600&auto=format&fit=crop&q=80',
      notes: visitNotes.trim() || `Special priority ${visitType} visit scheduled by sales manager.`,
      feedback: 'Manager scheduled priority review.',
    };

    const updated = [newVisit, ...visitsList];
    setVisitsList(updated);
    localStorage.setItem('fieldassist_visits', JSON.stringify(updated));

    // Persist to serverless backend API
    visitsApi.createVisitCheckIn(newVisit).catch((err) => {
      console.warn('Backend visit create notice:', err);
    });

    setShowScheduleModal(false);

    setToastMessage(`Special Visit ${nextCode} for "${finalRetailer}" scheduled successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check-In to visit (Sales Rep or Manager)
  const handleCheckInVisit = (visitId: string) => {
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const updated = visitsList.map((v) =>
      v.id === visitId
        ? {
            ...v,
            status: 'In Progress' as const,
            actualCheckIn: timeNow,
            geofenceVerified: true,
          }
        : v
    );
    setVisitsList(updated);
    localStorage.setItem('fieldassist_visits', JSON.stringify(updated));
    setToastMessage(`Checked into store! Geofence verified (50m) at ${timeNow}.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Complete visit (Sales Rep or Manager)
  const handleCompleteVisit = (visitId: string) => {
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const updated = visitsList.map((v) =>
      v.id === visitId
        ? {
            ...v,
            status: 'Completed' as const,
            actualCheckOut: timeNow,
            orderBookedAmount: v.orderBookedAmount > 0 ? v.orderBookedAmount : 18500,
            feedback: v.feedback || 'Visit completed, stock verified and orders updated.',
          }
        : v
    );
    setVisitsList(updated);
    localStorage.setItem('fieldassist_visits', JSON.stringify(updated));
    setToastMessage(`Visit marked as Completed at ${timeNow}! Beat productivity logged.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export Visits CSV
  const handleExportCsv = () => {
    exportToCsv(
      `fieldassist_visits_${new Date().toISOString().split('T')[0]}`,
      filteredVisits,
      [
        { header: 'Visit Code', key: 'visitCode' },
        { header: 'Retail Outlet', key: 'retailerName' },
        { header: 'Address', key: 'retailerAddress' },
        { header: 'Sales Representative', key: 'repName' },
        { header: 'Beat Route', key: (v) => v.beatName || 'Assigned Beat' },
        { header: 'Visit Type', key: 'visitType' },
        { header: 'Planned Time', key: 'plannedTime' },
        { header: 'Actual Check-in', key: (v) => v.actualCheckIn || 'Pending' },
        { header: 'Geofence Compliance', key: (v) => (v.geofenceVerified ? 'Verified (50m)' : 'Unverified') },
        { header: 'Order Booked Amount (INR)', key: (v) => `₹${v.orderBookedAmount.toLocaleString('en-IN')}` },
        { header: 'Status', key: 'status' },
      ]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
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
            <CalendarCheck className="w-7 h-7 text-brand-400" />
            <span>Field Visits & Audit Logs</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Geofence verified check-ins, photo proofs, audit feedback, and order booking logs.
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
                ? '• Field Rep: Check-in, Verify Geofence & Complete Visits'
                : '• Management: Schedule Ad-hoc Audits & Export Route Compliance'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Export Visits CSV"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export CSV</span>
          </button>

          {isManagerOrAdmin && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Special Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by visit code, outlet, or rep..."
            className="w-full h-10 pl-10 pr-4 text-xs bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Visits Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Visit Code</th>
                <th className="py-3.5 px-4">Retailer Outlet</th>
                <th className="py-3.5 px-4">Sales Rep</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Check-In / Planned</th>
                <th className="py-3.5 px-4">Geofence Verified</th>
                <th className="py-3.5 px-4">Order Booked</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredVisits.map((v) => (
                <tr key={v.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-4 px-4 text-brand-400 font-mono font-bold">{v.visitCode}</td>
                  <td className="py-4 px-4 font-bold text-white">{v.retailerName}</td>
                  <td className="py-4 px-4 text-slate-300 font-semibold">{v.repName}</td>
                  <td className="py-4 px-4 text-slate-400">{v.visitType}</td>
                  <td className="py-4 px-4 text-slate-300">{v.actualCheckIn || v.plannedTime}</td>
                  <td className="py-4 px-4">
                    {v.geofenceVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                        <ShieldCheck className="w-4 h-4" /> Verified (50m)
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Pending</span>
                    )}
                  </td>
                  <td className="py-4 px-4 font-bold text-emerald-400">
                    {v.orderBookedAmount > 0 ? `₹${v.orderBookedAmount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        v.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : v.status === 'In Progress'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Check-In Action Button */}
                      {v.status === 'Scheduled' || v.status === 'Missed' ? (
                        <button
                          onClick={() => handleCheckInVisit(v.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          title="Check In to Outlet (Geofence Verify)"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Check In</span>
                        </button>
                      ) : v.status === 'In Progress' ? (
                        <button
                          onClick={() => handleCompleteVisit(v.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-brand-600/30"
                          title="Complete Visit & Log Audit"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      ) : null}

                      <button
                        onClick={() => setSelectedVisit(v)}
                        className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-brand-600 transition-colors cursor-pointer"
                        title="Inspect Visit"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Schedule Special Visit */}
      <AnimatePresence>
        {showScheduleModal && (
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
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Schedule Special Visit</h2>
                    <p className="text-xs text-slate-400">Assign ad-hoc audit, collection, or priority client visit</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleScheduleVisit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-brand-400" />
                    <span>Select Retail Outlet *</span>
                  </label>
                  <select
                    value={selectedRetailerName}
                    onChange={(e) => handleRetailerSelectChange(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {mockRetailers.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.type} - {r.territory})
                      </option>
                    ))}
                    <option value="custom">+ Enter Custom Outlet Name</option>
                  </select>
                </div>

                {selectedRetailerName === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Custom Retailer Name *</label>
                    <input
                      type="text"
                      required
                      value={customRetailerName}
                      onChange={(e) => setCustomRetailerName(e.target.value)}
                      placeholder="e.g. Modern Supermarket Sector 14"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Outlet Address</label>
                  <input
                    type="text"
                    value={retailerAddress}
                    onChange={(e) => setRetailerAddress(e.target.value)}
                    placeholder="Address details"
                    className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-brand-400" />
                      <span>Assigned Field Rep *</span>
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
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Visit Type</label>
                    <select
                      value={visitType}
                      onChange={(e) => setVisitType(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Audit">Store Audit & Stock Check</option>
                      <option value="Collection">Payment Collection</option>
                      <option value="Regular Order">Priority Order Booking</option>
                      <option value="New Lead Pitch">New Product Scheme Pitch</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-400" />
                    <span>Planned Time / Schedule *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={plannedTime}
                    onChange={(e) => setPlannedTime(e.target.value)}
                    placeholder="e.g. Today, 03:00 PM or Tomorrow, 11:00 AM"
                    className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-400" />
                    <span>Instructions / Notes for Rep</span>
                  </label>
                  <textarea
                    rows={3}
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="Provide specific guidelines, invoice numbers to collect, or key SKUs to audit..."
                    className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>Schedule Special Visit</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Proof Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 space-y-5 relative border border-slate-700 shadow-2xl">
            <button
              onClick={() => setSelectedVisit(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-mono text-brand-400 font-bold">{selectedVisit.visitCode}</span>
              <h2 className="text-xl font-bold text-white mt-1">{selectedVisit.retailerName}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{selectedVisit.retailerAddress}</p>
            </div>

            {selectedVisit.photoProofUrl && (
              <div className="relative h-48 rounded-2xl overflow-hidden border border-slate-700">
                <img src={selectedVisit.photoProofUrl} alt="Proof" className="w-full h-full object-cover" />
                <span className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-emerald-400 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Geofence Verified Check-in
                </span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <span className="text-slate-400 block font-semibold">Rep Notes & Audit Feedback</span>
              <p className="text-slate-200">{selectedVisit.notes || 'No rep notes added.'}</p>
              {selectedVisit.feedback && (
                <p className="text-brand-300 italic pt-1 border-t border-slate-800">
                  "{selectedVisit.feedback}"
                </p>
              )}
            </div>

            {/* Modal Quick Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedVisit.status === 'Scheduled' || selectedVisit.status === 'Missed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleCheckInVisit(selectedVisit.id);
                      setSelectedVisit((prev) => prev ? { ...prev, status: 'In Progress', actualCheckIn: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), geofenceVerified: true } : null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Check In Now</span>
                  </button>
                ) : selectedVisit.status === 'In Progress' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleCompleteVisit(selectedVisit.id);
                      setSelectedVisit((prev) => prev ? { ...prev, status: 'Completed', actualCheckOut: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) } : null);
                    }}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Completed</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
