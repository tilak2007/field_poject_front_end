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
        saveLocalOrders(data as Order[]);
        return data as Order[];
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
        const local = getLocalOrders();
        const updated = [res.data, ...local.filter((o) => o.id !== res.data.id)];
        saveLocalOrders(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/orders POST notice:', err);
    }

    // 2. Try Supabase if configured
    try {
      const payload = {
        ...data,
        order_number: `ORD-2026-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
      };

      const { data: inserted, error } = await supabase.from('orders').insert([payload]).select().single();
      if (!error && inserted) {
        const local = getLocalOrders();
        saveLocalOrders([inserted as Order, ...local]);
        return inserted as Order;
      }
    } catch {}

    // 3. Fallback Local Persistence
    await simulateNetworkDelay(150);
    const newOrder: Order = {
      ...data,
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-2026-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
    };
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
        const local = getLocalOrders();
        saveLocalOrders(local.map((o) => (o.id === id ? (updated as Order) : o)));
        return updated as Order;
      }
    } catch {}

    // 3. Fallback Local
    await simulateNetworkDelay(100);
    const local = getLocalOrders();
    const index = local.findIndex((o) => o.id === id);
    if (index === -1) throw { message: 'Order not found', status: 404 };
    local[index].orderStatus = orderStatus;
    saveLocalOrders(local);
    return local[index];
  },

  /**
   * DELETE /api/orders (Cancel Order & restore stock)
   */
  async cancelOrder(id: string): Promise<Order> {
    try {
      const res = await apiFetch<{ success: boolean; data: Order }>(`/orders?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res && res.data) {
        const local = getLocalOrders();
        const updated = local.map((o) => (o.id === id ? res.data : o));
        saveLocalOrders(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/orders DELETE notice:', err);
    }

    return this.updateOrderStatus(id, 'Cancelled');
  },
};
