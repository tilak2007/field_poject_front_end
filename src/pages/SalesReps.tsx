import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Phone,
  Battery,
  Plus,
  X,
  Eye,
  CalendarCheck,
  ShoppingCart,
  TrendingUp,
  ShieldCheck,
  MapPin
} from 'lucide-react';
import { mockSalesReps, mockVisits, mockOrders } from '../data/mockData';
import { repsApi } from '../api/repsApi';
import type { SalesRep } from '../types';

export const SalesReps: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repsList, setRepsList] = useState<SalesRep[]>(() => {
    const saved = localStorage.getItem('fieldassist_sales_reps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockSalesReps;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(null);
  const [activeTab, setActiveTab] = useState<'performance' | 'visits' | 'orders'>('performance');

  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Representative Form state
  const [newRepName, setNewRepName] = useState('');
  const [newRepPhone, setNewRepPhone] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');
  const [newRepTerritory, setNewRepTerritory] = useState('North Delhi');
  const [newRepTarget, setNewRepTarget] = useState<number>(1500000);

  // Fetch real sales representatives from backend database
  useEffect(() => {
    const fetchReps = async () => {
      try {
        const data = await repsApi.getSalesReps();
        if (data && data.length > 0) {
          const existingIds = new Set(data.map((d) => d.id));
          setRepsList((prev) => {
            const merged = [...data, ...prev.filter((m) => !existingIds.has(m.id))];
            localStorage.setItem('fieldassist_sales_reps', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Reps fetch notice:', err);
      }
    };
    fetchReps();
  }, []);

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextCodeNum = 100 + repsList.length + 1;
    const nextCode = `SR-${nextCodeNum}`;
    const region =
      newRepTerritory.includes('Delhi')
        ? 'North Zone (Delhi-NCR)'
        : newRepTerritory.includes('Mumbai')
        ? 'West Zone (Mumbai)'
        : newRepTerritory.includes('Bengaluru')
        ? 'South Zone (BLR)'
        : 'Central Zone';

    const newRep: SalesRep = {
      id: `rep-${Date.now()}`,
      name: newRepName.trim(),
      code: nextCode,
      phone: newRepPhone.trim(),
      email: newRepEmail.trim() || `${newRepName.toLowerCase().replace(/\s+/g, '.')}@fieldassist.io`,
      territory: newRepTerritory,
      region,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      status: 'Active',
      batteryLevel: 100,
      lastCheckIn: 'Just now',
      targetAmount: Number(newRepTarget) || 1500000,
      targetAchievedPct: 0,
      visitsTodayCount: 0,
      totalDistanceKm: 0,
      salesClosedAmount: 0,
      joinDate: new Date().toISOString().split('T')[0],
    };

    const updated = [newRep, ...repsList];
    setRepsList(updated);
    localStorage.setItem('fieldassist_sales_reps', JSON.stringify(updated));
    repsApi.createSalesRep(newRep).catch(() => {});

    setShowOnboardModal(false);
    setNewRepName('');
    setNewRepPhone('');
    setNewRepEmail('');
    setToastMessage(`Sales Representative ${newRep.name} (${newRep.code}) onboarded successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle URL parameter sync for rep details profile page
  useEffect(() => {
    if (id) {
      const foundRep = repsList.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase());
      if (foundRep) {
        setSelectedRep(foundRep);
      }
    }
  }, [id, repsList]);

  // Filter Sales Reps by Name, Territory, or Phone
  const filteredReps = repsList.filter((rep) => {
    const matchesSearch =
      rep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.territory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || rep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Get visits & orders associated with selectedRep
  const repVisits = selectedRep
    ? mockVisits.filter((v) => v.repName === selectedRep.name || v.repId === selectedRep.id)
    : [];

  const repOrders = selectedRep
    ? mockOrders.filter((o) => o.repName === selectedRep.name || o.repId === selectedRep.id)
    : [];

  const handleOpenDetails = (rep: SalesRep) => {
    setSelectedRep(rep);
    setActiveTab('performance');
    navigate(`/reps/${rep.id}`);
  };

  const handleCloseDetails = () => {
    setSelectedRep(null);
    navigate('/reps');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-brand-400" />
            <span>Sales Representatives</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Manage field force targets, phone contacts, status telemetries, and performance analytics.
          </p>
        </div>

        <button
          onClick={() => setShowOnboardModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New Representative</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input (Name, Territory, Phone) */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, territory, phone or code..."
            className="w-full h-10 pl-10 pr-4 text-xs bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500 transition-all"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['All', 'Active', 'In Visit', 'On Route', 'Idle', 'Offline'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Representatives Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Sales Representative</th>
                <th className="py-3.5 px-4">Territory & Zone</th>
                <th className="py-3.5 px-4">Phone Contact</th>
                <th className="py-3.5 px-4">Monthly Target</th>
                <th className="py-3.5 px-4">Achieved Sales</th>
                <th className="py-3.5 px-4">Achievement %</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredReps.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-900/60 transition-colors">
                  {/* Name & Avatar */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={rep.avatar}
                        alt={rep.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700 shadow-sm"
                      />
                      <div>
                        <span className="font-bold text-white text-sm block">{rep.name}</span>
                        <span className="text-[10px] text-brand-400 font-mono font-semibold">{rep.code}</span>
                      </div>
                    </div>
                  </td>

                  {/* Territory */}
                  <td className="py-4 px-4">
                    <span className="text-slate-200 font-semibold block">{rep.territory}</span>
                    <span className="text-[10px] text-slate-400">{rep.region}</span>
                  </td>

                  {/* Phone */}
                  <td className="py-4 px-4">
                    <span className="text-slate-300 font-mono text-xs flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {rep.phone}
                    </span>
                  </td>

                  {/* Monthly Target */}
                  <td className="py-4 px-4 font-mono text-slate-300 font-bold">
                    ₹{rep.targetAmount.toLocaleString('en-IN')}
                  </td>

                  {/* Achieved Sales */}
                  <td className="py-4 px-4 font-mono text-emerald-400 font-extrabold text-sm">
                    ₹{rep.salesClosedAmount.toLocaleString('en-IN')}
                  </td>

                  {/* Achievement Percentage */}
                  <td className="py-4 px-4">
                    <div className="space-y-1 w-28">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-extrabold text-white">{rep.targetAchievedPct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rep.targetAchievedPct >= 90
                              ? 'bg-emerald-400'
                              : rep.targetAchievedPct >= 80
                              ? 'bg-brand-500'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${Math.min(rep.targetAchievedPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        rep.status === 'In Visit'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : rep.status === 'On Route'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : rep.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {rep.status}
                    </span>
                  </td>

                  {/* Actions: View Details */}
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => handleOpenDetails(rep)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rep View Details Detailed Profile Modal / Drawer */}
      {selectedRep && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 space-y-6 relative border border-slate-700 shadow-2xl my-8">
            {/* Close Button */}
            <button
              onClick={handleCloseDetails}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <img
                  src={selectedRep.avatar}
                  alt={selectedRep.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500 shadow-lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedRep.name}</h2>
                    <span className="px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-300 text-xs font-mono font-bold">
                      {selectedRep.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-400" />
                      {selectedRep.territory} ({selectedRep.region})
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">{selectedRep.status}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${selectedRep.phone}`}
                  className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Rep ({selectedRep.phone})</span>
                </a>
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'performance'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Performance Statistics</span>
              </button>

              <button
                onClick={() => setActiveTab('visits')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'visits'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Recent Visits ({repVisits.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'orders'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Recent Orders ({repOrders.length})</span>
              </button>
            </div>

            {/* Tab 1: Performance Statistics */}
            {activeTab === 'performance' && (
              <div className="space-y-5">
                {/* 4 Performance Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Monthly Target</span>
                    <span className="text-sm font-black text-white mt-1 block">
                      ₹{selectedRep.targetAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Achieved Sales</span>
                    <span className="text-sm font-black text-emerald-400 mt-1 block">
                      ₹{selectedRep.salesClosedAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Visits Today</span>
                    <span className="text-sm font-black text-white mt-1 block">
                      {selectedRep.visitsTodayCount} Visits
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Distance</span>
                    <span className="text-sm font-black text-brand-300 mt-1 block">
                      {selectedRep.totalDistanceKm} km
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Monthly Quota Fulfillment</span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      {selectedRep.targetAchievedPct}% Achieved
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(selectedRep.targetAchievedPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Telemetry info */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 block">Battery Level</span>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Battery className="w-4 h-4 text-emerald-400" />
                      {selectedRep.batteryLevel}% Charged
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 block">Last Check-In</span>
                    <span className="font-bold text-slate-200">{selectedRep.lastCheckIn}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Recent Visits */}
            {activeTab === 'visits' && (
              <div className="space-y-3">
                {repVisits.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold">
                          <th className="py-3 px-3">Visit Code</th>
                          <th className="py-3 px-3">Retailer Outlet</th>
                          <th className="py-3 px-3">Check-In Time</th>
                          <th className="py-3 px-3">Geofence</th>
                          <th className="py-3 px-3">Order Booked</th>
                          <th className="py-3 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {repVisits.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-900/60">
                            <td className="py-3 px-3 font-mono font-bold text-brand-400">{v.visitCode}</td>
                            <td className="py-3 px-3 font-bold text-white">{v.retailerName}</td>
                            <td className="py-3 px-3 text-slate-300">{v.actualCheckIn || v.plannedTime}</td>
                            <td className="py-3 px-3">
                              {v.geofenceVerified ? (
                                <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Verified
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Pending</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-400">
                              {v.orderBookedAmount > 0 ? `₹${v.orderBookedAmount.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.status === 'Completed'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                }`}
                              >
                                {v.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-6">
                    No field visits logged for {selectedRep.name} today.
                  </p>
                )}
              </div>
            )}

            {/* Tab 3: Recent Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                {repOrders.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold">
                          <th className="py-3 px-3">Order Number</th>
                          <th className="py-3 px-3">Retailer</th>
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {repOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-900/60">
                            <td className="py-3 px-3 font-mono font-bold text-white">{ord.orderNumber}</td>
                            <td className="py-3 px-3 text-slate-300 font-semibold">{ord.retailerName}</td>
                            <td className="py-3 px-3 text-slate-400">{ord.date}</td>
                            <td className="py-3 px-3 font-bold text-emerald-400">
                              ₹{ord.totalAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ord.orderStatus === 'Approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
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
                  <p className="text-center text-xs text-slate-400 py-6">
                    No secondary orders logged for {selectedRep.name} today.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-800 text-white shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Onboard New Representative Modal Dialog */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 space-y-5 relative border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Onboard New Representative</h2>
                  <p className="text-xs text-slate-400">Add a new field agent to your sales hierarchy</p>
                </div>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Representative Name *</label>
                <input
                  type="text"
                  required
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Phone Contact *</label>
                  <input
                    type="tel"
                    required
                    value={newRepPhone}
                    onChange={(e) => setNewRepPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Work Email</label>
                  <input
                    type="email"
                    value={newRepEmail}
                    onChange={(e) => setNewRepEmail(e.target.value)}
                    placeholder="rep@fieldassist.io"
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Territory *</label>
                  <select
                    value={newRepTerritory}
                    onChange={(e) => setNewRepTerritory(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="North Delhi">North Delhi</option>
                    <option value="South Mumbai">South Mumbai</option>
                    <option value="Bengaluru Central">Bengaluru Central</option>
                    <option value="Chennai Metro">Chennai Metro</option>
                    <option value="Ahmedabad East">Ahmedabad East</option>
                    <option value="Kolkata Hub">Kolkata Hub</option>
                    <option value="Hyderabad West">Hyderabad West</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Monthly Target (₹) *</label>
                  <input
                    type="number"
                    required
                    min={100000}
                    step={50000}
                    value={newRepTarget}
                    onChange={(e) => setNewRepTarget(Number(e.target.value))}
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard Representative</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
