import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  Search,
  Plus,
  Phone,
  MapPin,
  UserCheck,
  Calendar,
  Eye,
  X,
  Building,
  CalendarCheck,
  ShoppingCart,
  ShieldCheck,
  Star,
  CheckCircle2,
  User,
  Download,
  Ban,
  Trash2,
} from 'lucide-react';
import { mockRetailers, mockVisits, mockOrders } from '../data/mockData';
import { retailersApi } from '../api/retailersApi';
import type { Retailer } from '../types';
import { useAuth } from '../context/AuthContext';
import { exportToCsv } from '../utils/exportCsv';

export const Retailers: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagerOrAdmin = !user || user.role === 'System Admin' || user.role === 'Sales Manager';

  const [retailersList, setRetailersList] = useState<Retailer[]>(() => {
    const saved = localStorage.getItem('fieldassist_retailers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockRetailers;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'visits' | 'orders'>('info');

  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New outlet form states
  const [outletName, setOutletName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [outletPhone, setOutletPhone] = useState('');
  const [outletType, setOutletType] = useState<Retailer['type']>('Kirana');
  const [address, setAddress] = useState('');
  const [territory, setTerritory] = useState('North Delhi');
  const [city, setCity] = useState('Delhi');
  const [creditLimit, setCreditLimit] = useState(50000);
  const [assignedRepName, setAssignedRepName] = useState('Vikram Sharma');
  const [initialStatus, setInitialStatus] = useState<'Active' | 'Lead'>('Active');

  // Fetch real retailers from backend database
  useEffect(() => {
    const fetchRetailers = async () => {
      try {
        const data = await retailersApi.getRetailers();
        if (data && data.length > 0) {
          setRetailersList((prev) => {
            const existingIds = new Set(data.map((d) => d.id));
            const merged = [...data, ...prev.filter((m) => !existingIds.has(m.id))];
            return merged;
          });
        }
      } catch (err) {
        console.warn('Retailers fetch notice:', err);
      }
    };
    fetchRetailers();
  }, []);

  // Handle URL parameter sync for retailer details page
  useEffect(() => {
    if (id) {
      const foundRetailer = retailersList.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase());
      if (foundRetailer) {
        setSelectedRetailer(foundRetailer);
      }
    }
  }, [id, retailersList]);

  const filteredRetailers = retailersList.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.territory.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All' || r.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Filter visits & orders associated with selectedRetailer
  const retailerVisits = selectedRetailer
    ? mockVisits.filter((v) => v.retailerId === selectedRetailer.id || v.retailerName === selectedRetailer.name)
    : [];

  const retailerOrders = selectedRetailer
    ? mockOrders.filter((o) => o.retailerId === selectedRetailer.id || o.retailerName === selectedRetailer.name)
    : [];

  const handleOpenDetails = (ret: Retailer) => {
    setSelectedRetailer(ret);
    setActiveTab('info');
    navigate(`/retailers/${ret.id}`);
  };

  const handleCloseDetails = () => {
    setSelectedRetailer(null);
    navigate('/retailers');
  };

  const handleOpenAddModal = () => {
    setOutletName('');
    setOwnerName('');
    setOutletPhone('+91 ');
    setAddress('');
    setCreditLimit(50000);
    setShowAddModal(true);
  };

  const handleAddRetailer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim()) return;

    const newCode = `RET-DEL-${String(retailersList.length + 101).padStart(3, '0')}`;
    const newRetailer: Retailer = {
      id: `ret-${Date.now()}`,
      name: outletName.trim(),
      ownerName: ownerName.trim() || 'Store Proprietor',
      code: newCode,
      type: outletType,
      phone: outletPhone.trim() || '+91 98110 00000',
      address: address.trim() || 'Main Market, Delhi',
      territory,
      city,
      outstandingBalance: 0,
      creditLimit: Number(creditLimit) || 50000,
      lastOrderDate: 'Just Added',
      lastVisitDate: 'Pending Visit',
      assignedRepName,
      assignedRepId: `rep-${Date.now()}`,
      status: initialStatus,
      rating: 5.0,
    };

    // Attempt backend sync
    retailersApi.createRetailer(newRetailer).catch(() => {});

    const updated = [newRetailer, ...retailersList];
    setRetailersList(updated);
    localStorage.setItem('fieldassist_retailers', JSON.stringify(updated));
    setShowAddModal(false);

    setToastMessage(`Retail outlet "${newRetailer.name}" (${newCode}) added successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Toggle Retailer Status (Active <-> Blocked)
  const handleToggleStatus = (retailerId: string) => {
    const target = retailersList.find((r) => r.id === retailerId);
    if (!target) return;
    const nextStatus: 'Active' | 'Blocked' = target.status === 'Active' ? 'Blocked' : 'Active';

    const updated: Retailer[] = retailersList.map((r) =>
      r.id === retailerId ? { ...r, status: nextStatus } : r
    );
    setRetailersList(updated);
    localStorage.setItem('fieldassist_retailers', JSON.stringify(updated));

    if (selectedRetailer && selectedRetailer.id === retailerId) {
      setSelectedRetailer({ ...selectedRetailer, status: nextStatus });
    }

    setToastMessage(`Outlet "${target.name}" status updated to ${nextStatus}!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Delete Retailer
  const handleDeleteRetailer = (retailerId: string) => {
    const target = retailersList.find((r) => r.id === retailerId);
    if (!window.confirm(`Are you sure you want to remove retailer "${target?.name || retailerId}" from territory records?`)) {
      return;
    }

    const updated = retailersList.filter((r) => r.id !== retailerId);
    setRetailersList(updated);
    localStorage.setItem('fieldassist_retailers', JSON.stringify(updated));

    if (selectedRetailer && selectedRetailer.id === retailerId) {
      setSelectedRetailer(null);
    }

    setToastMessage(`Retail outlet removed successfully from database.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export Outlets CSV
  const handleExportCsv = () => {
    exportToCsv(
      `fieldassist_retailers_${new Date().toISOString().split('T')[0]}`,
      filteredRetailers,
      [
        { header: 'Outlet Code', key: 'code' },
        { header: 'Retailer Name', key: 'name' },
        { header: 'Owner Name', key: 'ownerName' },
        { header: 'Outlet Type', key: 'type' },
        { header: 'Contact Phone', key: 'phone' },
        { header: 'Address', key: 'address' },
        { header: 'Territory', key: 'territory' },
        { header: 'City', key: 'city' },
        { header: 'Assigned Sales Rep', key: 'assignedRepName' },
        { header: 'Outstanding Balance (INR)', key: (r) => `₹${r.outstandingBalance.toLocaleString('en-IN')}` },
        { header: 'Credit Limit (INR)', key: (r) => `₹${r.creditLimit.toLocaleString('en-IN')}` },
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
            <Store className="w-7 h-7 text-brand-400" />
            <span>Retail Outlets Management</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Search, filter, and audit Kirana stores, supermarkets, pharmacies, credit balances, and order histories.
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
                ? '• Field Rep: Onboard New Outlets & Log Visit Audits'
                : '• Management: Full Authority to Block, Delete & Modify Credit Limits'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Export Retailers CSV"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Retail Outlet</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by outlet name, owner, phone, address or territory..."
            className="w-full h-10 pl-10 pr-4 text-xs bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500 transition-all"
          />
        </div>

        {/* Outlet Type & Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {['All', 'Kirana', 'Supermarket', 'Pharmacy', 'Wholesale'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  typeFilter === type
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            {['All', 'Active', 'Blocked'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Retailers Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Retailer Name</th>
                <th className="py-3.5 px-4">Owner Name</th>
                <th className="py-3.5 px-4">Phone Contact</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4">Territory</th>
                <th className="py-3.5 px-4">Assigned Sales Rep</th>
                <th className="py-3.5 px-4">Last Visit</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredRetailers.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                  {/* Retailer Name */}
                  <td className="py-4 px-4">
                    <div>
                      <span className="font-bold text-white text-sm block">{r.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-brand-400 font-mono font-semibold">{r.code}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                          {r.type}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="py-4 px-4 text-slate-200 font-semibold">{r.ownerName}</td>

                  {/* Phone */}
                  <td className="py-4 px-4">
                    <span className="text-slate-300 font-mono text-xs flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {r.phone}
                    </span>
                  </td>

                  {/* Address */}
                  <td className="py-4 px-4 max-w-[200px] truncate text-slate-300" title={r.address}>
                    {r.address}
                  </td>

                  {/* Territory */}
                  <td className="py-4 px-4">
                    <span className="text-slate-200 font-semibold block">{r.territory}</span>
                    <span className="text-[10px] text-slate-400">{r.city}</span>
                  </td>

                  {/* Assigned Sales Representative */}
                  <td className="py-4 px-4">
                    <span className="text-brand-300 font-semibold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                      {r.assignedRepName}
                    </span>
                  </td>

                  {/* Last Visit Date */}
                  <td className="py-4 px-4 text-slate-300 font-mono">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {r.lastVisitDate}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        r.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  {/* Actions: View Details, Toggle Status, Remove */}
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenDetails(r)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      {/* Management Action: Toggle Status */}
                      {isManagerOrAdmin && (
                        <button
                          onClick={() => handleToggleStatus(r.id)}
                          className={`p-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            r.status === 'Active'
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border-emerald-500/20'
                          }`}
                          title={r.status === 'Active' ? 'Block Retailer' : 'Activate Retailer'}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Management Action: Delete */}
                      {isManagerOrAdmin && (
                        <button
                          onClick={() => handleDeleteRetailer(r.id)}
                          className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700/50 transition-all cursor-pointer"
                          title="Remove Retailer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retailer Details Modal / Drawer */}
      {selectedRetailer && (
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
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedRetailer.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-brand-500/20 text-brand-300 text-xs font-mono font-bold">
                    {selectedRetailer.code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedRetailer.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {selectedRetailer.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                  <span>Owner: <strong className="text-white">{selectedRetailer.ownerName}</strong></span>
                  <span>•</span>
                  <span>Type: <strong className="text-brand-300">{selectedRetailer.type}</strong></span>
                </p>
              </div>

              <a
                href={`tel:${selectedRetailer.phone}`}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Outlet</span>
              </a>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'info'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Contact & Account Info</span>
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
                <span>Visit History ({retailerVisits.length})</span>
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
                <span>Order History ({retailerOrders.length})</span>
              </button>
            </div>

            {/* Tab 1: Contact Information */}
            {activeTab === 'info' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">Full Address & Location</span>
                    <p className="text-white font-medium flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                      <span>{selectedRetailer.address}, {selectedRetailer.city}</span>
                    </p>
                    <p className="text-slate-400 pt-1 border-t border-slate-800">
                      Territory: <strong className="text-slate-200">{selectedRetailer.territory}</strong>
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">Assigned Sales Representative</span>
                    <p className="text-white font-bold text-sm flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>{selectedRetailer.assignedRepName}</span>
                    </p>
                    <p className="text-slate-400 pt-1 border-t border-slate-800">
                      Last Visit: <strong className="text-slate-200">{selectedRetailer.lastVisitDate}</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Outstanding Balance</span>
                    <span className="text-base font-black text-rose-400 mt-1 block">
                      ₹{selectedRetailer.outstandingBalance.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Credit Limit</span>
                    <span className="text-base font-black text-white mt-1 block">
                      ₹{selectedRetailer.creditLimit.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Outlet Score</span>
                    <span className="text-base font-black text-amber-400 mt-1 flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>{selectedRetailer.rating} / 5.0</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Visit History */}
            {activeTab === 'visits' && (
              <div className="space-y-3">
                {retailerVisits.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold">
                          <th className="py-3 px-3">Visit Code</th>
                          <th className="py-3 px-3">Sales Rep</th>
                          <th className="py-3 px-3">Planned Time</th>
                          <th className="py-3 px-3">Check-In</th>
                          <th className="py-3 px-3">GPS Verification</th>
                          <th className="py-3 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {retailerVisits.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-900/60">
                            <td className="py-3 px-3 font-mono font-bold text-brand-400">{v.visitCode}</td>
                            <td className="py-3 px-3 font-bold text-white">{v.repName}</td>
                            <td className="py-3 px-3 text-slate-300">{v.plannedTime}</td>
                            <td className="py-3 px-3 text-slate-400">{v.actualCheckIn || '—'}</td>
                            <td className="py-3 px-3">
                              {v.geofenceVerified ? (
                                <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Verified
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Pending</span>
                              )}
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
                    No visit logs recorded for {selectedRetailer.name}.
                  </p>
                )}
              </div>
            )}

            {/* Tab 3: Order History */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                {retailerOrders.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold">
                          <th className="py-3 px-3">Order #</th>
                          <th className="py-3 px-3">Sales Rep</th>
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Total Amount</th>
                          <th className="py-3 px-3">Payment</th>
                          <th className="py-3 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {retailerOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-900/60">
                            <td className="py-3 px-3 font-mono font-bold text-white">{ord.orderNumber}</td>
                            <td className="py-3 px-3 text-slate-300 font-semibold">{ord.repName}</td>
                            <td className="py-3 px-3 text-slate-400">{ord.date}</td>
                            <td className="py-3 px-3 font-bold text-emerald-400">
                              ₹{ord.totalAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {ord.paymentStatus}
                              </span>
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
                    No order history recorded for {selectedRetailer.name}.
                  </p>
                )}
              </div>
            )}

            {/* Quick Actions Footer inside Modal */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleCloseDetails();
                    navigate('/orders');
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Book Order for Store</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseDetails();
                    navigate('/visits');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Schedule Beat Visit</span>
                </button>
              </div>

              {isManagerOrAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedRetailer.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedRetailer.status === 'Active'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-600 hover:text-white'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                    }`}
                  >
                    {selectedRetailer.status === 'Active' ? 'Block Account' : 'Activate Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRetailer(selectedRetailer.id)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Remove Outlet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Retail Outlet */}
      <AnimatePresence>
        {showAddModal && (
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
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Add New Retail Outlet</h2>
                    <p className="text-xs text-slate-400">Onboard retail store into secondary distribution network</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRetailer} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">Outlet / Store Name *</label>
                    <input
                      type="text"
                      required
                      value={outletName}
                      onChange={(e) => setOutletName(e.target.value)}
                      placeholder="e.g. Aggarwal Super Mart"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Proprietor / Owner Name</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Sanjay Aggarwal"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Contact Phone</label>
                    <input
                      type="text"
                      value={outletPhone}
                      onChange={(e) => setOutletPhone(e.target.value)}
                      placeholder="+91 98110 12345"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Store Category / Type *</label>
                    <select
                      value={outletType}
                      onChange={(e) => setOutletType(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Kirana">Kirana / Grocery</option>
                      <option value="Supermarket">Supermarket</option>
                      <option value="Pharmacy">Pharmacy / Chemist</option>
                      <option value="Wholesale">Wholesale Distributor</option>
                      <option value="Electronics">Electronics Mart</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Territory</label>
                    <select
                      value={territory}
                      onChange={(e) => setTerritory(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="North Delhi">North Delhi</option>
                      <option value="West Delhi">West Delhi</option>
                      <option value="South Delhi">South Delhi</option>
                      <option value="East Delhi">East Delhi</option>
                      <option value="South Mumbai">South Mumbai</option>
                      <option value="Bengaluru Central">Bengaluru Central</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">Address & Locality *</label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Shop 12, Main Market, Sector 7, Rohini"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Credit Limit (₹)</label>
                    <input
                      type="number"
                      step="5000"
                      min="0"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-brand-400" />
                      <span>Assigned Sales Rep</span>
                    </label>
                    <select
                      value={assignedRepName}
                      onChange={(e) => setAssignedRepName(e.target.value)}
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
                    <label className="text-xs font-semibold text-slate-300">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Delhi"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Onboarding Status</label>
                    <select
                      value={initialStatus}
                      onChange={(e) => setInitialStatus(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Active">Active Store</option>
                      <option value="Lead">New Acquisition Lead</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save & Onboard Outlet</span>
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
