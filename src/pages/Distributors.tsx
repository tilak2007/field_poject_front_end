import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, Building, Plus, X, ShieldCheck } from 'lucide-react';
import { mockDistributors } from '../data/mockData';
import type { Distributor } from '../types';
import { distributorsApi } from '../api';

export const Distributors: React.FC = () => {
  const [distributorsList, setDistributorsList] = useState<Distributor[]>(() => {
    const saved = localStorage.getItem('fieldassist_distributors');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockDistributors;
  });

  useEffect(() => {
    distributorsApi.getDistributors().then((data) => {
      if (data && data.length > 0) {
        setDistributorsList(data);
      }
    }).catch(() => {});
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [region, setRegion] = useState('North Zone (Delhi-NCR)');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [warehouseCapacityPct, setWarehouseCapacityPct] = useState(80);
  const [stockValue, setStockValue] = useState(5000000);
  const [outstandingBalance, setOutstandingBalance] = useState(1500000);
  const [coverageAreas, setCoverageAreas] = useState('North Delhi, Gurugram Central, Noida West');

  const handleAddDistributor = (e: React.FormEvent) => {
    e.preventDefault();
    const nextCodeNum = 900 + distributorsList.length + 1;
    const nextCode = `DST-${nextCodeNum}`;
    const areas = coverageAreas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newDist: Distributor = {
      id: `dist-${Date.now()}`,
      name: name.trim(),
      code: nextCode,
      contactPerson: contactPerson.trim() || 'Operations Head',
      phone: phone.trim() || '+91 98110 00000',
      email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@distributors.fieldassist.io`,
      region,
      territoryCoverage: areas.length > 0 ? areas : ['North Delhi'],
      stockValue: Number(stockValue) || 4500000,
      currentWarehouseCapacityPct: Number(warehouseCapacityPct) || 75,
      creditLimit: (Number(stockValue) || 4500000) * 1.5,
      outstandingBalance: Number(outstandingBalance) || 0,
      status: 'Active',
    };

    const updated = [newDist, ...distributorsList];
    setDistributorsList(updated);
    localStorage.setItem('fieldassist_distributors', JSON.stringify(updated));

    // Persist to serverless backend API
    distributorsApi.createDistributor(newDist).catch((err) => {
      console.warn('Backend distributor create notice:', err);
    });

    setShowAddModal(false);
    setName('');
    setContactPerson('');
    setPhone('');
    setToastMessage(`Distributor Partner "${newDist.name}" (${newDist.code}) onboarded successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Truck className="w-7 h-7 text-brand-400" />
            <span>Primary Distributors Network</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Warehouse stock holding, credit limits, territory coverage, and fulfillment partners.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Distributor Partner</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-800 text-white shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Distributors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {distributorsList.map((dist) => (
          <div
            key={dist.id}
            className="glass-card glass-card-hover p-6 rounded-2xl space-y-5 border border-slate-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-brand-400">{dist.code}</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                {dist.status}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{dist.name}</h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>{dist.region}</span>
              </p>
            </div>

            {/* Warehouse capacity bar */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Warehouse Capacity</span>
                <span className="font-bold text-white">{dist.currentWarehouseCapacityPct}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-500 h-full rounded-full"
                  style={{ width: `${dist.currentWarehouseCapacityPct}%` }}
                />
              </div>
            </div>

            {/* Stock Value & Credit */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Stock Value</span>
                <span className="font-extrabold text-white text-sm">
                  ₹{(dist.stockValue / 100000).toFixed(2)}L
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Balance Due</span>
                <span className="font-extrabold text-rose-400 text-sm">
                  ₹{(dist.outstandingBalance / 100000).toFixed(2)}L
                </span>
              </div>
            </div>

            {/* Territory Coverage Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Coverage Areas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dist.territoryCoverage.map((area) => (
                  <span
                    key={area}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 text-[10px] font-semibold border border-slate-700"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Distributor Partner Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 space-y-5 relative border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Add Distributor Partner</h2>
                  <p className="text-xs text-slate-400">Onboard primary distribution warehouse & logistics hub</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDistributor} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Distributor Agency Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex FMCG Logistics Ltd"
                  className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Operations Head / Contact *</label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Sunil Malhotra"
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Phone Contact *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98110 00000"
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Region Zone *</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="North Zone (Delhi-NCR)">North Zone (Delhi-NCR)</option>
                    <option value="West Zone (Mumbai-Guj)">West Zone (Mumbai-Guj)</option>
                    <option value="South Zone (BLR-CHN)">South Zone (BLR-CHN)</option>
                    <option value="East Zone (Kolkata)">East Zone (Kolkata)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Warehouse Capacity (%) *</label>
                  <input
                    type="number"
                    required
                    min={10}
                    max={100}
                    value={warehouseCapacityPct}
                    onChange={(e) => setWarehouseCapacityPct(Number(e.target.value))}
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Stock Holding Value (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={100000}
                    value={stockValue}
                    onChange={(e) => setStockValue(Number(e.target.value))}
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Credit Balance Due (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={outstandingBalance}
                    onChange={(e) => setOutstandingBalance(Number(e.target.value))}
                    className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Territory Coverage (Comma separated)</label>
                <input
                  type="text"
                  value={coverageAreas}
                  onChange={(e) => setCoverageAreas(e.target.value)}
                  placeholder="e.g. North Delhi, Noida West, Gurugram"
                  className="w-full h-10 px-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard Distributor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
