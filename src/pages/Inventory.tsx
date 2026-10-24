import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Plus, X, ShieldCheck, Warehouse, Package } from 'lucide-react';
import { mockInventory, mockProducts, mockDistributors } from '../data/mockData';
import type { InventoryItem } from '../types';

export const Inventory: React.FC = () => {
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('fieldassist_inventory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved inventory:', e);
      }
    }
    return mockInventory;
  });

  const [showInwardModal, setShowInwardModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [inwardForm, setInwardForm] = useState({
    productName: mockProducts[0]?.name || 'Pure Hydration Coconut Water 500ml',
    sku: mockProducts[0]?.sku || 'FA-COCO-500',
    distributorName: mockDistributors[0]?.name || 'Apex FMCG Logistics Ltd',
    casesAvailable: 150,
    batchNumber: `B-2026-X${Math.floor(10 + Math.random() * 90)}`,
    expiryDate: '2027-10-31',
    status: 'Optimal' as 'Optimal' | 'Near Expiry' | 'Low Stock',
  });

  const handleProductSelect = (prodName: string) => {
    const found = mockProducts.find((p) => p.name === prodName);
    setInwardForm((prev) => ({
      ...prev,
      productName: prodName,
      sku: found ? found.sku : `FA-GEN-${Math.floor(100 + Math.random() * 900)}`,
    }));
  };

  const handleRecordInward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inwardForm.productName || !inwardForm.distributorName) return;

    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      productId: `prod-${Date.now()}`,
      productName: inwardForm.productName,
      sku: inwardForm.sku,
      distributorName: inwardForm.distributorName,
      distributorId: `dist-${Date.now()}`,
      casesAvailable: Number(inwardForm.casesAvailable) || 50,
      casesReserved: 0,
      batchNumber: inwardForm.batchNumber || `B-2026-X${Math.floor(10 + Math.random() * 90)}`,
      expiryDate: inwardForm.expiryDate || '2027-12-31',
      status: inwardForm.status,
    };

    const updated = [newItem, ...inventoryList];
    setInventoryList(updated);
    localStorage.setItem('fieldassist_inventory', JSON.stringify(updated));

    setShowInwardModal(false);
    setToastMessage(`Stock inward of ${newItem.casesAvailable} cases recorded for ${newItem.distributorName}`);
    setTimeout(() => setToastMessage(null), 4000);

    // Reset form batch number for next inward
    setInwardForm((prev) => ({
      ...prev,
      batchNumber: `B-2026-X${Math.floor(10 + Math.random() * 90)}`,
      casesAvailable: 150,
    }));
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
            <Boxes className="w-7 h-7 text-brand-400" />
            <span>Depot & Distributor Inventory</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time batch tracking, stock reserved for pending orders, and expiration risk monitoring.
          </p>
        </div>

        <button
          onClick={() => setShowInwardModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Stock Inward</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Product Name & SKU</th>
                <th className="py-3.5 px-4">Distributor Warehouse</th>
                <th className="py-3.5 px-4">Batch No</th>
                <th className="py-3.5 px-4">Cases Available</th>
                <th className="py-3.5 px-4">Cases Reserved</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Risk Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {inventoryList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-4 px-4">
                    <div>
                      <span className="font-bold text-white text-sm block">{item.productName}</span>
                      <span className="text-[10px] text-brand-400 font-mono">{item.sku}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-300 font-semibold">{item.distributorName}</td>
                  <td className="py-4 px-4 text-slate-400 font-mono">{item.batchNumber}</td>
                  <td className="py-4 px-4 text-emerald-400 font-bold text-sm">
                    {item.casesAvailable} Cases
                  </td>
                  <td className="py-4 px-4 text-slate-400 font-semibold">
                    {item.casesReserved} Cases
                  </td>
                  <td className="py-4 px-4 text-slate-300 font-mono">{item.expiryDate}</td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.status === 'Optimal'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : item.status === 'Near Expiry'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Stock Inward Modal */}
      <AnimatePresence>
        {showInwardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700/80 shadow-2xl relative space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Record Stock Inward</h3>
                    <p className="text-xs text-slate-400">Receive new batch inventory at distributor depot</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInwardModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordInward} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Product SKU
                  </label>
                  <select
                    value={inwardForm.productName}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500"
                  >
                    {mockProducts.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Distributor Depot
                    </label>
                    <select
                      value={inwardForm.distributorName}
                      onChange={(e) => setInwardForm({ ...inwardForm, distributorName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500"
                    >
                      {mockDistributors.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name} ({d.region})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Batch Identifier
                    </label>
                    <input
                      type="text"
                      required
                      value={inwardForm.batchNumber}
                      onChange={(e) => setInwardForm({ ...inwardForm, batchNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Cases Inward Qty
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={inwardForm.casesAvailable}
                      onChange={(e) => setInwardForm({ ...inwardForm, casesAvailable: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500 font-semibold text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Batch Expiry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={inwardForm.expiryDate}
                      onChange={(e) => setInwardForm({ ...inwardForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Initial Risk Classification
                  </label>
                  <select
                    value={inwardForm.status}
                    onChange={(e) =>
                      setInwardForm({
                        ...inwardForm,
                        status: e.target.value as 'Optimal' | 'Near Expiry' | 'Low Stock',
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500"
                  >
                    <option value="Optimal">Optimal (Fresh stock, &gt;6 months shelf life)</option>
                    <option value="Near Expiry">Near Expiry (Expiring within 90 days)</option>
                    <option value="Low Stock">Low Stock</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowInwardModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>Confirm & Inward Stock</span>
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

