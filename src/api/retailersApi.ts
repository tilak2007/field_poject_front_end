import type { Retailer } from '../types';
import { mockRetailers } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { apiFetch, simulateNetworkDelay } from './client';

const LOCAL_STORAGE_KEY = 'fieldassist_retailers';

function getLocalRetailers(): Retailer[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...mockRetailers];
}

function saveLocalRetailers(list: Retailer[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const retailersApi = {
  /**
   * GET /api/retailers
   */
  async getRetailers(params?: { search?: string; type?: string; status?: string }): Promise<Retailer[]> {
    // 1. Try native Serverless Backend (/api/retailers)
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('q', params.search);
      if (params?.type && params.type !== 'All') queryParams.set('type', params.type);
      if (params?.status && params.status !== 'All') queryParams.set('status', params.status);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await apiFetch<{ success: boolean; data: Retailer[] }>(`/retailers${qs}`);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalRetailers(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/retailers fallback to cache:', err);
    }

    // 2. Try Supabase if configured
    try {
      let query = supabase.from('retailers').select('*');

      if (params?.type && params.type !== 'All') {
        query = query.eq('type', params.type);
      }
      if (params?.status && params.status !== 'All') {
        query = query.eq('status', params.status);
      }
      if (params?.search) {
        query = query.or(
          `name.ilike.%${params.search}%,owner_name.ilike.%${params.search}%,code.ilike.%${params.search}%,territory.ilike.%${params.search}%`
        );
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped: Retailer[] = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          ownerName: r.owner_name || r.ownerName || 'Outlet Owner',
          code: r.code,
          type: (r.type as any) || (r.category as any) || 'Kirana',
          phone: r.phone || '+91 98110 00000',
          address: r.address || 'Delhi-NCR',
          territory: r.territory || 'North Delhi',
          city: r.city || 'Delhi',
          outstandingBalance: Number(r.outstanding_balance ?? 0),
          creditLimit: Number(r.credit_limit ?? 50000),
          lastOrderDate: r.last_order_date || '2026-10-08',
          lastVisitDate: r.last_visit_date || '2026-10-09',
          assignedRepName: r.assigned_rep_name || 'Vikram Sharma',
          assignedRepId: r.assigned_rep_id || 'rep-01',
          status: r.is_active === false ? 'Blocked' : (r.status as any) || 'Active',
          rating: Number(r.rating ?? 4.8),
        }));
        saveLocalRetailers(mapped);
        return mapped;
      }
    } catch (err) {
      // Supabase unavailable
    }

    // 3. Fallback to LocalStorage Persistent Cache / Mock Data
    await simulateNetworkDelay(100);
    let items = getLocalRetailers();

    if (params?.type && params.type !== 'All') {
      items = items.filter((r) => r.type === params.type);
    }
    if (params?.status && params.status !== 'All') {
      items = items.filter((r) => r.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.territory.toLowerCase().includes(q) ||
          r.phone.includes(q)
      );
    }
    return items;
  },

  /**
   * GET /api/retailers/:id
   */
  async getRetailerById(id: string): Promise<Retailer | null> {
    try {
      const res = await apiFetch<{ success: boolean; data: Retailer[] }>(`/retailers?q=${encodeURIComponent(id)}`);
      if (res && res.data && res.data.length > 0) {
        return res.data[0];
      }
    } catch {}

    const local = getLocalRetailers();
    return local.find((r) => r.id === id) || null;
  },

  /**
   * POST /api/retailers
   */
  async createRetailer(data: Omit<Retailer, 'id'>): Promise<Retailer> {
    // 1. Post to Serverless Backend
    try {
      const res = await apiFetch<{ success: boolean; data: Retailer }>('/retailers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.data) {
        const local = getLocalRetailers();
        const updated = [res.data, ...local.filter((r) => r.id !== res.data.id)];
        saveLocalRetailers(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/retailers POST notice:', err);
    }

    // 2. Try Supabase if configured
    try {
      const { data: inserted, error } = await supabase.from('retailers').insert([data]).select().single();
      if (!error && inserted) {
        const local = getLocalRetailers();
        saveLocalRetailers([inserted as Retailer, ...local]);
        return inserted as Retailer;
      }
    } catch {}

    // 3. Fallback Local Persistence
    await simulateNetworkDelay(150);
    const newOutlet: Retailer = {
      ...data,
      id: `ret-${Date.now()}`,
    };
    const local = getLocalRetailers();
    saveLocalRetailers([newOutlet, ...local]);
    return newOutlet;
  },
};
