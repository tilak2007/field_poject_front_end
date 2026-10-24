import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Plus, RefreshCw, X, CheckCircle2, Tag, Layers, IndianRupee, Image } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { mockProducts } from '../data/mockData';
import type { Product } from '../types';
import { productsApi } from '../api';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('fieldassist_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockProducts;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Modal and toast states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New SKU form fields
  const [skuCode, setSkuCode] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState<Product['category']>('Snacks');
  const [unitPrice, setUnitPrice] = useState<number>(45);
  const [mrp, setMrp] = useState<number>(55);
  const [casePackSize, setCasePackSize] = useState<number>(24);
  const [initialStockCases, setInitialStockCases] = useState<number>(100);
  const [imageUrl, setImageUrl] = useState('');

  // 1. Fetch active products with price and stock:
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const items = await productsApi.getProducts();
      if (items && items.length > 0) {
        setProducts(items);
      }
    } catch (err) {
      console.warn('Using catalog fallback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAddModal = () => {
    const nextCode = `SKU-${category.slice(0, 3).toUpperCase()}-${String(100 + products.length + 1)}`;
    setSkuCode(nextCode);
    setProductName('');
    setUnitPrice(45);
    setMrp(55);
    setCasePackSize(24);
    setInitialStockCases(120);
    setImageUrl('');
    setShowAddModal(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    const finalSku = skuCode.trim() || `SKU-PRD-${Date.now().toString().slice(-4)}`;
    const finalStock = Number(initialStockCases) || 0;
    const defaultImgMap: Record<string, string> = {
      Beverages: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
      Snacks: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=80',
      'Personal Care': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
      Dairy: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
      FMCG: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500&auto=format&fit=crop&q=80',
    };

    const finalImg = imageUrl.trim() || defaultImgMap[category] || defaultImgMap.FMCG;

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      sku: finalSku,
      name: productName.trim(),
      category,
      unitPrice: Number(unitPrice) || 0,
      mrp: Number(mrp) || 0,
      casePackSize: Number(casePackSize) || 24,
      stockInHandCases: finalStock,
      reorderLevelCases: 25,
      taxRatePct: 18,
      imageUrl: finalImg,
      status: finalStock > 30 ? 'In Stock' : finalStock > 0 ? 'Low Stock' : 'Out of Stock',
    };

    // Attempt Supabase insert in background
    try {
      await supabase.from('products').insert([
        {
          sku: finalSku,
          name: productName.trim(),
          category,
          unit_price: Number(unitPrice),
          mrp: Number(mrp),
          case_size: Number(casePackSize),
          stock_cases: finalStock,
          image_url: finalImg,
          is_active: true,
        },
      ]);
    } catch {
      // Ignored for offline/mock fallback
    }

    const updated = [newProduct, ...products];
    setProducts(updated);
    localStorage.setItem('fieldassist_products', JSON.stringify(updated));
    setShowAddModal(false);

    setToastMessage(`Product SKU "${newProduct.name}" (${finalSku}) added to master catalog!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

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
            <Package className="w-7 h-7 text-brand-400" />
            <span>Product Master Catalog</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Live catalog synchronized with warehouse inventory and secondary order booking.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchProducts}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Refresh catalog"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product SKU</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search SKU code, product name..."
            className="w-full h-10 pl-10 pr-4 text-xs bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['All', 'Beverages', 'Snacks', 'Personal Care', 'Dairy', 'FMCG'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="glass-card glass-card-hover p-5 rounded-2xl space-y-4 border border-slate-800 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="relative h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80';
                  }}
                />
                <span
                  className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md ${
                    p.status === 'In Stock'
                      ? 'bg-emerald-500 text-white'
                      : p.status === 'Low Stock'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {p.status}
                </span>
                <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-brand-300 text-[10px] font-mono font-bold border border-slate-800">
                  {p.sku}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white line-clamp-1">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {p.category} • Pack size: {p.casePackSize} units/case
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Unit Price / MRP</span>
                  <span className="font-extrabold text-white text-sm">
                    ₹{p.unitPrice}{' '}
                    <span className="text-slate-400 line-through text-xs font-normal">
                      ₹{p.mrp}
                    </span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Stock in Hand</span>
                  <span className="font-bold text-brand-400 text-sm font-mono">
                    {p.stockInHandCases} Cases
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add New Product SKU */}
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
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Add New Product SKU</h2>
                    <p className="text-xs text-slate-400">Register product in master catalog & inventory</p>
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

              <form onSubmit={handleAddProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Masala CTC Leaf Tea 250g"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-brand-400" />
                      <span>SKU Code *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={skuCode}
                      onChange={(e) => setSkuCode(e.target.value)}
                      placeholder="e.g. BEV-TEA-250G"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-brand-400" />
                      <span>Category *</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Personal Care">Personal Care</option>
                      <option value="Dairy">Dairy</option>
                      <option value="FMCG">FMCG</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-brand-400" />
                      <span>Wholesale Unit Price (₹) *</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">MRP (₹) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      required
                      value={mrp}
                      onChange={(e) => setMrp(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Case Pack Size (units/case)</label>
                    <input
                      type="number"
                      min="1"
                      value={casePackSize}
                      onChange={(e) => setCasePackSize(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Initial Stock (Cases)</label>
                    <input
                      type="number"
                      min="0"
                      value={initialStockCases}
                      onChange={(e) => setInitialStockCases(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-brand-400" />
                      <span>Product Image URL (Optional)</span>
                    </label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
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
                    <span>Save & Deploy SKU</span>
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

export default Products;
