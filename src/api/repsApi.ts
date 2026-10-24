import type { SalesRep } from '../types';
import { mockSalesReps } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { apiFetch, simulateNetworkDelay } from './client';

const LOCAL_STORAGE_KEY = 'fieldassist_reps';

function getLocalReps(): SalesRep[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...mockSalesReps];
}

function saveLocalReps(list: SalesRep[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const repsApi = {
  /**
   * GET /api/reps
   */
  async getSalesReps(params?: { search?: string; status?: string; region?: string }): Promise<SalesRep[]> {
    // 1. Try Serverless Backend (/api/reps)
    try {
      const queryParams = new URLSearchParams();
      if (params?.region && params.region !== 'All Regions') queryParams.set('region', params.region);
      if (params?.status && params.status !== 'All') queryParams.set('status', params.status);
      if (params?.search) queryParams.set('q', params.search);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await apiFetch<{ success: boolean; data: SalesRep[] }>(`/reps${qs}`);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalReps(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/reps fallback to cache:', err);
    }

    // 2. Try Supabase if configured
    try {
      let query = supabase.from('sales_reps').select('*');

      if (params?.region && params.region !== 'All Regions') {
        query = query.eq('region', params.region);
      }
      if (params?.status && params.status !== 'All') {
        query = query.eq('status', params.status);
      }
      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,code.ilike.%${params.search}%,territory.ilike.%${params.search}%`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped: SalesRep[] = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          code: r.code,
          avatar: r.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          phone: r.phone || '',
          email: r.email || '',
          territory: r.territory || 'North Delhi',
          region: r.region || 'North Zone (Delhi-NCR)',
          status: (r.status as any) || 'Active',
          batteryLevel: Number(r.battery_level ?? 85),
          lastCheckIn: r.last_check_in || 'Recently',
          targetAmount: Number(r.target_amount ?? 500000),
          targetAchievedPct: Number(r.target_achieved_pct ?? 0),
          visitsTodayCount: Number(r.visits_today_count ?? 0),
          totalDistanceKm: Number(r.total_distance_km ?? 0),
          salesClosedAmount: Number(r.sales_closed_amount ?? 0),
          joinDate: r.join_date || '2024-01-01',
        }));
        saveLocalReps(mapped);
        return mapped;
      }
    } catch (err) {
      // Supabase unavailable
    }

    // 3. Fallback Local Storage
    await simulateNetworkDelay(100);
    let reps = getLocalReps();

    if (params?.region && params.region !== 'All Regions') {
      reps = reps.filter((r) => r.region === params.region);
    }
    if (params?.status && params.status !== 'All') {
      reps = reps.filter((r) => r.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      reps = reps.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.territory.toLowerCase().includes(q) ||
          r.phone.includes(q)
      );
    }
    return reps;
  },

  /**
   * GET /api/reps/:id
   */
  async getSalesRepById(id: string): Promise<SalesRep | null> {
    const reps = await this.getSalesReps();
    return reps.find((r) => r.id === id) || null;
  },

  /**
   * POST /api/reps
   */
  async createSalesRep(data: Omit<SalesRep, 'id'>): Promise<SalesRep> {
    // 1. Try Serverless Backend
    try {
      const res = await apiFetch<{ success: boolean; data: SalesRep }>('/reps', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.data) {
        const local = getLocalReps();
        const updated = [res.data, ...local.filter((r) => r.id !== res.data.id)];
        saveLocalReps(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/reps POST notice:', err);
    }

    // 2. Try Supabase
    try {
      const { data: inserted, error } = await supabase.from('sales_reps').insert([data]).select().single();
      if (!error && inserted) {
        const local = getLocalReps();
        saveLocalReps([inserted as SalesRep, ...local]);
        return inserted as SalesRep;
      }
    } catch {}

    // 3. Fallback Local
    await simulateNetworkDelay(150);
    const newRep: SalesRep = {
      ...data,
      id: `rep-${Date.now()}`,
    };
    const local = getLocalReps();
    saveLocalReps([newRep, ...local]);
    return newRep;
  },

  /**
   * PUT /api/reps/:id
   */
  async updateSalesRep(id: string, updates: Partial<SalesRep>): Promise<SalesRep> {
    try {
      const res = await apiFetch<{ success: boolean; data: SalesRep }>(`/reps?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (res && res.data) {
        const local = getLocalReps();
        const updated = local.map((r) => (r.id === id ? res.data : r));
        saveLocalReps(updated);
        return res.data;
      }
    } catch {}

    const local = getLocalReps();
    const index = local.findIndex((r) => r.id === id);
    if (index === -1) throw { message: 'Sales Representative not found', status: 404 };
    local[index] = { ...local[index], ...updates };
    saveLocalReps(local);
    return local[index];
  },
};
