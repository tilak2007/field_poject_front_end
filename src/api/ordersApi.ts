import type { Order } from '../types';
import { mockOrders } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { apiFetch, simulateNetworkDelay } from './client';

const LOCAL_STORAGE_KEY = 'fieldassist_orders';

function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...mockOrders];
}

function saveLocalOrders(list: Order[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function mapRowToOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number || row.orderNumber || `ORD-${row.id?.slice(-4)}`,
    retailerId: row.retailer_id || row.retailerId || 'ret-101',
    retailerName: row.retailer_name || row.retailerName || 'Retail Outlet',
    distributorId: row.distributor_id || row.distributorId || 'dist-1',
    distributorName: row.distributor_name || row.distributorName || 'Apex FMCG Logistics Ltd',
    repId: row.rep_id || row.repId || 'rep-1',
    repName: row.rep_name || row.repName || 'Vikram Sharma',
    date: row.date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    items: Array.isArray(row.items) ? row.items : [],
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    paymentStatus: row.payment_status || row.paymentStatus || 'Pending',
    orderStatus: row.order_status || row.orderStatus || 'Processing',
    deliveryDateEstimated: row.delivery_date_estimated || row.deliveryDateEstimated || '2026-10-28',
  };
}

export const ordersApi = {
  /**
   * GET /api/orders
   */
  async getOrders(params?: { retailerId?: string; repId?: string; status?: string }): Promise<Order[]> {
    // 1. Try native Serverless Backend (/api/orders)
    try {
      const queryParams = new URLSearchParams();
      if (params?.retailerId) queryParams.set('retailerId', params.retailerId);
      if (params?.repId) queryParams.set('repId', params.repId);
      if (params?.status && params.status !== 'All') queryParams.set('status', params.status);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await apiFetch<{ success: boolean; data: Order[] }>(`/orders${qs}`);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalOrders(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/orders fallback to cache:', err);
    }

    // 2. Try Supabase if configured
    try {
      let query = supabase.from('orders').select('*');

      if (params?.retailerId) {
        query = query.eq('retailer_id', params.retailerId);
      }
      if (params?.repId) {
        query = query.eq('rep_id', params.repId);
      }
      if (params?.status && params.status !== 'All') {
        query = query.eq('order_status', params.status);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped = data.map(mapRowToOrder);
        const local = getLocalOrders();
        // Merge Supabase orders with local mock/offline orders
        const mapById = new Map<string, Order>();
        for (const o of [...mapped, ...local]) {
          if (!mapById.has(o.id)) mapById.set(o.id, o);
        }
        const merged = Array.from(mapById.values());
        saveLocalOrders(merged);
        return merged;
      }
    } catch (err) {
      // Supabase unavailable
    }

    // 3. Fallback to LocalStorage Persistent Cache / Mock Data
    await simulateNetworkDelay(100);
    let items = getLocalOrders();

    if (params?.retailerId) {
      items = items.filter((o) => o.retailerId === params.retailerId);
    }
    if (params?.repId) {
      items = items.filter((o) => o.repId === params.repId);
    }
    if (params?.status && params.status !== 'All') {
      items = items.filter((o) => o.orderStatus === params.status);
    }
    return items;
  },

  /**
   * GET /api/orders/:id
   */
  async getOrderById(id: string): Promise<Order | null> {
    const orders = await this.getOrders();
    return orders.find((o) => o.id === id) || null;
  },

  /**
   * POST /api/orders
   */
  async createOrder(data: Omit<Order, 'id' | 'orderNumber' | 'date'>): Promise<Order> {
    // 1. Post to Serverless Backend
    try {
      const res = await apiFetch<{ success: boolean; data: Order }>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.data) {
        const syncedOrder = { ...res.data, syncStatus: 'synced', synced: true };
        const local = getLocalOrders();
        const updated = [syncedOrder, ...local.filter((o) => o.id !== res.data.id)];
        saveLocalOrders(updated);
        return syncedOrder;
      }
    } catch (err) {
      console.warn('Backend /api/orders POST notice:', err);
    }

    // 2. Try Supabase if configured
    try {
      const payload: Record<string, any> = {
        order_number: `ORD-BLR-${Date.now().toString().slice(-4)}`,
        retailer_id: data.retailerId,
        retailer_name: data.retailerName,
        distributor_id: data.distributorId,
        distributor_name: data.distributorName,
        rep_id: data.repId,
        rep_name: data.repName,
        date: new Date().toISOString().split('T')[0],
        total_amount: Number(data.totalAmount) || 0,
        payment_status: data.paymentStatus || 'Pending',
        order_status: data.orderStatus || 'Processing',
        delivery_date_estimated:
          data.deliveryDateEstimated ||
          new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      };

      const { data: inserted, error } = await supabase.from('orders').insert([payload]).select().single();
      if (!error && inserted) {
        const mapped = mapRowToOrder(inserted);
        const syncedOrder = { ...mapped, items: data.items, syncStatus: 'synced', synced: true };
        const local = getLocalOrders();
        saveLocalOrders([syncedOrder, ...local]);
        return syncedOrder;
      }
    } catch (err) {
      console.warn('Supabase createOrder notice:', err);
    }

    // 3. Fallback Local Persistence (Offline Mode Buffer)
    await simulateNetworkDelay(150);
    const newOrder: Order = {
      ...data,
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-BLR-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
    };
    (newOrder as any).syncStatus = 'pending';
    (newOrder as any).synced = false;
    const local = getLocalOrders();
    saveLocalOrders([newOrder, ...local]);
    return newOrder;
  },

  /**
   * PATCH /api/orders
   */
  async updateOrderStatus(id: string, orderStatus: Order['orderStatus']): Promise<Order> {
    // 1. Try Serverless Backend
    try {
      const res = await apiFetch<{ success: boolean; data: Order }>('/orders', {
        method: 'PATCH',
        body: JSON.stringify({ id, status: orderStatus }),
      });
      if (res && res.data) {
        const local = getLocalOrders();
        const updated = local.map((o) => (o.id === id ? res.data : o));
        saveLocalOrders(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/orders PATCH notice:', err);
    }

    // 2. Try Supabase
    try {
      const { data: updated, error } = await supabase
        .from('orders')
        .update({ order_status: orderStatus })
        .eq('id', id)
        .select()
        .single();
      if (!error && updated) {
        const mapped = mapRowToOrder(updated);
        const local = getLocalOrders();
        saveLocalOrders(local.map((o) => (o.id === id ? mapped : o)));
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase updateOrderStatus notice:', err);
    }

    // 3. Fallback Local
    await simulateNetworkDelay(100);
    const local = getLocalOrders();
    const index = local.findIndex((o) => o.id === id);
    if (index !== -1) {
      const updated: Order = { ...local[index], orderStatus };
      local[index] = updated;
      saveLocalOrders(local);
      return updated;
    }

    throw new Error(`Order with ID ${id} not found`);
  },

  /**
   * Cancel an order
   */
  async cancelOrder(id: string): Promise<Order> {
    return this.updateOrderStatus(id, 'Cancelled');
  },

  /**
   * GET /api/orders/metrics
   */
  async getOrderMetrics(): Promise<{
    totalOrdersToday: number;
    pendingCount: number;
    deliveredCount: number;
    cancelledCount: number;
    totalRevenueToday: number;
  }> {
    const orders = await this.getOrders();
    const totalOrdersToday = orders.length;
    const pendingCount = orders.filter((o) => o.orderStatus === 'Processing' || o.orderStatus === 'Approved').length;
    const deliveredCount = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const cancelledCount = orders.filter((o) => o.orderStatus === 'Cancelled').length;
    const totalRevenueToday = orders.reduce((sum, o) => sum + (o.orderStatus !== 'Cancelled' ? o.totalAmount : 0), 0);

    return {
      totalOrdersToday,
      pendingCount,
      deliveredCount,
      cancelledCount,
      totalRevenueToday,
    };
  },
};
