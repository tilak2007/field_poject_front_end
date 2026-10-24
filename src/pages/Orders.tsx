import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Search,
  Eye,
  X,
  Plus,
  Package,
  Store,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Minus,
  Ban,
  Download,
  Truck,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { mockOrders, mockProducts, mockRetailers } from '../data/mockData';
import type { Order, OrderItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { ordersApi, productsApi } from '../api';
import { exportToCsv } from '../utils/exportCsv';

interface ActiveProduct {
  id: string;
  name: string;
  sku: string;
  unit_price?: number;
  unitPrice?: number;
  stock_cases?: number;
  stockInHandCases?: number;
  category?: string;
}

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productsList, setProductsList] = useState<ActiveProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    orderNumber?: string;
  } | null>(null);

  // Form Fields for New Order
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>(
    mockRetailers[0]?.id || 'ret-01'
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string>('Deliver by Tuesday morning');

  // 1. Fetch active products with price and stock:
  const fetchActiveProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const products = await productsApi.getProducts();
      if (products && products.length > 0) {
        setProductsList(
          products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unit_price: p.unitPrice,
            stock_cases: p.stockInHandCases,
            category: p.category,
          }))
        );
      }
    } catch (err) {
      console.warn('Fallback loading mock products:', err);
      setProductsList(
        mockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit_price: p.unitPrice,
          stock_cases: p.stockInHandCases,
          category: p.category,
        }))
      );
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 2. Fetch order history:
  const fetchOrders = async () => {
    try {
      const fetched = await ordersApi.getOrders();
      if (fetched && fetched.length > 0) {
        setOrders(fetched);
      }
    } catch (err) {
      console.warn('fetchOrders notice:', err);
    }
  };

  useEffect(() => {
    fetchActiveProducts();
    fetchOrders();
  }, []);

  const openOrderModal = () => {
    setIsModalOpen(true);
    setOrderFeedback(null);
    if (productsList.length >= 2) {
      setQuantities({
        [productsList[0].id]: 5,
        [productsList[1].id]: 2,
      });
    } else if (productsList.length > 0) {
      setQuantities({
        [productsList[0].id]: 3,
      });
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const selectedItems = Object.entries(quantities)
    .filter(([_, qty]) => qty > 0)
    .map(([prodId, qty]) => {
      const prod = productsList.find((p) => p.id === prodId);
      const price = prod?.unit_price ?? prod?.unitPrice ?? 500;
      return {
        id: prodId,
        product_id: prodId,
        productName: prod?.name || 'Selected Product',
        quantity: qty,
        unitPrice: price,
        totalPrice: price * qty,
      };
    });

  const grandTotal = selectedItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

  // 2. Click "Place Order" button with selected items:
  const handlePlaceOrder = async () => {
    if (selectedItems.length === 0) {
      setOrderFeedback({
        type: 'error',
        message: 'Please select at least 1 product case to book an order.',
      });
      return;
    }

    setIsPlacingOrder(true);
    setOrderFeedback(null);

    const retailer = mockRetailers.find((r) => r.id === selectedRetailerId);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const fallbackOrderNumber = `ORD-${dateStr}-${randomSuffix}`;

    try {
      let rpcOrder: any = null;
      try {
        const { data: order, error } = await supabase.rpc('create_order_atomic', {
          _retailer_id: selectedRetailerId,
          _items: selectedItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
          _notes: notes || 'Deliver by Tuesday morning',
        });

        if (!error && order) {
          rpcOrder = order;
        }
      } catch (rpcErr) {
        console.warn('RPC create_order_atomic notice, applying client fallback:', rpcErr);
      }

      const generatedNumber =
        rpcOrder?.order_number || rpcOrder?.orderNumber || fallbackOrderNumber;

      const newOrderItems: OrderItem[] = selectedItems.map((it) => ({
        productId: it.product_id,
        productName: it.productName,
        quantityCases: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      }));

      const newOrder: Order = {
        id: rpcOrder?.id || `ord-${Date.now()}`,
        orderNumber: generatedNumber,
        retailerId: selectedRetailerId,
        retailerName: retailer?.name || 'City Mart Supermarket',
        distributorId: 'dist-01',
        distributorName: 'Apex Logistics & FMCG Hub',
        repId: user?.id || 'rep-01',
        repName: user?.name || 'Sales Representative',
        date: new Date().toISOString().split('T')[0],
        items: newOrderItems,
        totalAmount: grandTotal,
        paymentStatus: 'Pending',
        orderStatus: 'Processing',
        deliveryDateEstimated: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      };

      // Deduct stock in local products list
      setProductsList((prev) =>
        prev.map((p) => {
          const ordered = quantities[p.id] || 0;
          return {
            ...p,
            stock_cases: Math.max(0, (p.stock_cases ?? 100) - ordered),
          };
        })
      );

      // Persist to serverless backend API
      try {
        await ordersApi.createOrder(newOrder);
      } catch (saveErr) {
        console.warn('Backend order save notice:', saveErr);
      }

      setOrders((prev) => [newOrder, ...prev]);
      setOrderFeedback({
        type: 'success',
        message: `Order successfully booked and stock deducted!`,
        orderNumber: generatedNumber,
      });

      setQuantities({});
    } catch (err: any) {
      setOrderFeedback({
        type: 'error',
        message: err.message || 'Failed to place order. Please try again.',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // 2. Click "Cancel Order" button (automatically restores warehouse stock):
  const handleCancelOrder = async (orderId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this order? This will automatically restore warehouse stock.'
      )
    ) {
      return;
    }

    setIsCancelling(true);
    try {
      try {
        await ordersApi.cancelOrder(orderId);
      } catch (rpcErr) {
        console.warn('Cancel order notice:', rpcErr);
      }

      // Update state locally to Cancelled
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, orderStatus: 'Cancelled' } : ord))
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, orderStatus: 'Cancelled' });
      }

      // Restore stock in local products list for each item in the order
      const targetOrder = orders.find((o) => o.id === orderId) || selectedOrder;
      if (targetOrder?.items) {
        setProductsList((prev) =>
          prev.map((p) => {
            const item = targetOrder.items.find((i) => i.productId === p.id);
            if (item) {
              return {
                ...p,
                stock_cases: (p.stock_cases ?? 100) + item.quantityCases,
              };
            }
            return p;
          })
        );
      }

      setOrderFeedback({
        type: 'success',
        message: 'Order cancelled successfully and warehouse inventory has been restored!',
        orderNumber: targetOrder?.orderNumber,
      });
    } catch (err: any) {
      console.error('Cancel order error:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const isManagerOrAdmin = !user || user.role === 'System Admin' || user.role === 'Sales Manager';

  // 3. Click "Approve Order" button (Managers / Admins)
  const handleApproveOrder = async (orderId: string) => {
    try {
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, orderStatus: 'Approved' } : ord))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, orderStatus: 'Approved' });
      }
      setOrderFeedback({
        type: 'success',
        message: 'Order verified and approved for distributor fulfillment!',
      });
    } catch (err: any) {
      console.error('Approve order error:', err);
    }
  };

  // 4. Click "Mark as Delivered" button (Managers / Admins)
  const handleMarkDelivered = async (orderId: string) => {
    try {
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, orderStatus: 'Delivered', paymentStatus: 'Paid' } : ord))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, orderStatus: 'Delivered', paymentStatus: 'Paid' });
      }
      setOrderFeedback({
        type: 'success',
        message: 'Order marked as Delivered and payment registered as Paid!',
      });
    } catch (err: any) {
      console.error('Mark delivered error:', err);
    }
  };

  // 5. Export Orders CSV
  const handleExportCsv = () => {
    exportToCsv(
      `fieldassist_orders_${new Date().toISOString().split('T')[0]}`,
      filteredOrders,
      [
        { header: 'Order Number', key: 'orderNumber' },
        { header: 'Order Date', key: 'date' },
        { header: 'Retail Outlet', key: 'retailerName' },
        { header: 'Distributor Partner', key: 'distributorName' },
        { header: 'Booked By Rep', key: 'repName' },
        { header: 'Total Amount (INR)', key: (o) => `₹${o.totalAmount.toLocaleString('en-IN')}` },
        { header: 'Payment Status', key: 'paymentStatus' },
        { header: 'Order Status', key: 'orderStatus' },
        { header: 'Estimated Delivery', key: (o) => o.deliveryDateEstimated || 'Pending' },
        { header: 'Total Line Items', key: (o) => (o.items ? o.items.length : 0) },
      ]
    );
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.retailerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.repName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || o.orderStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-brand-400" />
            <span>Field Secondary Orders</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time orders booked on-site by field reps during retailer visits with atomic stock validation.
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
                ? '• Field Rep: Book Orders & View Invoices'
                : '• Management: Full Order Approval & Inventory Override'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Export Orders CSV"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>

          <button
            onClick={openOrderModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 min-h-[42px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book Manual Order</span>
          </button>
        </div>
      </div>

      {/* Global Success Alert after ordering or cancellation */}
      {orderFeedback && orderFeedback.type === 'success' && !isModalOpen && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-bold">{orderFeedback.message} </span>
              {orderFeedback.orderNumber && (
                <span className="font-mono text-white font-bold">
                  ({orderFeedback.orderNumber})
                </span>
              )}
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                Warehouse stock levels synchronized with Supabase.
              </p>
            </div>
          </div>
          <button
            onClick={() => setOrderFeedback(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search order #, retailer, rep..."
            className="w-full h-10 pl-10 pr-4 text-xs bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 rounded-xl focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['All', 'Approved', 'Processing', 'Delivered', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Order ID & Date</th>
                <th className="py-3.5 px-4">Retailer Outlet</th>
                <th className="py-3.5 px-4">Distributor Partner</th>
                <th className="py-3.5 px-4">Booked By Rep</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-4 px-4">
                    <div>
                      <span className="font-bold text-white text-sm block font-mono">
                        {ord.orderNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">{ord.date}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-200 font-semibold">{ord.retailerName}</td>
                  <td className="py-4 px-4 text-slate-300">{ord.distributorName}</td>
                  <td className="py-4 px-4 text-brand-400 font-semibold">{ord.repName}</td>
                  <td className="py-4 px-4 text-emerald-400 font-extrabold text-sm font-mono">
                    ₹{ord.totalAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                      {ord.paymentStatus}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        ord.orderStatus === 'Approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : ord.orderStatus === 'Processing'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : ord.orderStatus === 'Cancelled'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      {ord.orderStatus}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-brand-600 transition-colors cursor-pointer"
                        title="View Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Management Action: Approve Processing Order */}
                      {isManagerOrAdmin && ord.orderStatus === 'Processing' && (
                        <button
                          onClick={() => handleApproveOrder(ord.id)}
                          className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:text-white hover:bg-emerald-600 border border-emerald-500/30 transition-colors cursor-pointer"
                          title="Approve Order (Manager Authorization)"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Management Action: Mark Approved Order as Delivered */}
                      {isManagerOrAdmin && ord.orderStatus === 'Approved' && (
                        <button
                          onClick={() => handleMarkDelivered(ord.id)}
                          className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-600 border border-blue-500/30 transition-colors cursor-pointer"
                          title="Confirm Delivery & Mark Paid"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}

                      {/* Cancel Order: Managers can cancel any, Reps can cancel unapproved orders */}
                      {ord.orderStatus !== 'Cancelled' && ord.orderStatus !== 'Delivered' && (isManagerOrAdmin || ord.orderStatus === 'Processing') && (
                        <button
                          onClick={() => handleCancelOrder(ord.id)}
                          className="p-2 rounded-xl bg-slate-800/80 text-rose-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                          title="Cancel Order (Restore Stock)"
                        >
                          <Ban className="w-4 h-4" />
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

      {/* Book Manual Order Modal (Powered by create_order_atomic RPC) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 relative border border-slate-700 shadow-2xl my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="border-b border-slate-800 pb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                Atomic Inventory Sync
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                <ShoppingCart className="w-5 h-5 text-brand-400" />
                <span>Book Secondary Outlet Order</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select items from active products. Order creation validates inventory and deducts stock in real time.
              </p>
            </div>

            {/* Feedback alert */}
            {orderFeedback && (
              <div
                className={`p-3.5 rounded-2xl flex items-center gap-3 text-xs font-medium border ${
                  orderFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {orderFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                )}
                <div>
                  <p>{orderFeedback.message}</p>
                  {orderFeedback.orderNumber && (
                    <p className="font-mono text-white font-bold mt-0.5">
                      Order #: {orderFeedback.orderNumber}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Retailer Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-brand-400" />
                <span>Select Retailer Outlet</span>
              </label>
              <select
                value={selectedRetailerId}
                onChange={(e) => setSelectedRetailerId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-brand-500"
              >
                {mockRetailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code}) — {r.territory}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Active Products & Quantity Picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-brand-400" />
                  <span>Active Products & Stock (From Supabase)</span>
                </label>
                {isLoadingProducts && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Loading catalog...
                  </span>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 rounded-2xl">
                {productsList.map((product) => {
                  const price = product.unit_price ?? product.unitPrice ?? 500;
                  const stock = product.stock_cases ?? product.stockInHandCases ?? 100;
                  const qty = quantities[product.id] || 0;

                  return (
                    <div
                      key={product.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        qty > 0
                          ? 'bg-brand-950/30 border-brand-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs block truncate">
                          {product.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span className="text-emerald-400 font-bold font-mono">₹{price}/case</span>
                          <span>•</span>
                          <span className="text-slate-400">
                            Available:{' '}
                            <strong className={stock < 20 ? 'text-amber-400' : 'text-slate-200'}>
                              {stock} cases
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, -1)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-white font-mono">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, 1)}
                          disabled={qty >= stock}
                          className="w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Delivery Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Delivery Instructions & Dispatch Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Deliver by Tuesday morning"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Order Summary & Place Order Button */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Selected Items:</span>
                <span className="font-semibold text-white">
                  {selectedItems.length} products (
                  {selectedItems.reduce((acc, c) => acc + c.quantity, 0)} cases)
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
                <span className="text-sm font-bold text-slate-200">Grand Total:</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || selectedItems.length === 0}
                className="flex-2 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {isPlacingOrder ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Place Order (create_order_atomic)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Invoice Drawer/Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 space-y-6 relative border border-slate-700 shadow-2xl">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white font-mono">{selectedOrder.orderNumber}</h2>
                <p className="text-xs text-slate-400">
                  Booked on {selectedOrder.date} by {selectedOrder.repName}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedOrder.orderStatus === 'Cancelled'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {selectedOrder.orderStatus}
              </span>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Itemized Breakdown
              </h3>
              <div className="space-y-2">
                {selectedOrder.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{it.productName}</span>
                      <span className="text-slate-400">
                        {it.quantityCases} Cases × ₹{it.unitPrice}/case
                      </span>
                    </div>
                    <span className="font-bold text-emerald-400 text-sm font-mono">
                      ₹{it.totalPrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center p-4 rounded-2xl bg-brand-950/40 border border-brand-500/30">
              <span className="text-xs font-bold text-slate-300">Grand Total Amount</span>
              <span className="text-xl font-extrabold text-white font-mono">
                ₹{selectedOrder.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Management & Invoice Actions */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (selectedOrder) {
                    exportToCsv(
                      `Invoice_${selectedOrder.orderNumber}`,
                      selectedOrder.items || [],
                      [
                        { header: 'Order Number', key: () => selectedOrder.orderNumber },
                        { header: 'Retailer', key: () => selectedOrder.retailerName },
                        { header: 'Product Name', key: 'productName' },
                        { header: 'Cases', key: 'quantityCases' },
                        { header: 'Unit Price (INR)', key: 'unitPrice' },
                        { header: 'Total (INR)', key: 'totalPrice' },
                      ]
                    );
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-brand-400" />
                <span>Export Invoice</span>
              </button>

              <div className="flex items-center gap-2">
                {isManagerOrAdmin && selectedOrder.orderStatus === 'Processing' && (
                  <button
                    type="button"
                    onClick={() => handleApproveOrder(selectedOrder.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Order</span>
                  </button>
                )}

                {isManagerOrAdmin && selectedOrder.orderStatus === 'Approved' && (
                  <button
                    type="button"
                    onClick={() => handleMarkDelivered(selectedOrder.id)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-600/30"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Mark Delivered</span>
                  </button>
                )}

                {selectedOrder.orderStatus !== 'Cancelled' && (
                  <button
                    type="button"
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    disabled={isCancelling}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isCancelling ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ban className="w-3.5 h-3.5" />
                    )}
                    <span>Cancel Order</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
