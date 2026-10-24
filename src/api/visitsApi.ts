import type { Visit, BeatPlan } from '../types';
import { mockVisits } from '../data/mockData';
import { apiFetch, simulateNetworkDelay } from './client';

const LOCAL_STORAGE_KEY = 'fieldassist_visits';

function getLocalVisits(): Visit[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...mockVisits];
}

function saveLocalVisits(list: Visit[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const visitsApi = {
  /**
   * GET /api/visits
   * List all field visits logged
   */
  async getVisits(params?: { repId?: string; retailerId?: string; status?: string }): Promise<Visit[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.repId) queryParams.set('repId', params.repId);
      if (params?.status && params.status !== 'All') queryParams.set('status', params.status);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await apiFetch<{ success: boolean; data: Visit[] }>(`/visits${qs}`);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalVisits(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/visits fallback to cache:', err);
    }

    await simulateNetworkDelay(100);
    let items = getLocalVisits();

    if (params?.repId) {
      items = items.filter((v) => v.repId === params.repId);
    }
    if (params?.retailerId) {
      items = items.filter((v) => v.retailerId === params.retailerId);
    }
    if (params?.status && params.status !== 'All') {
      items = items.filter((v) => v.status === params.status);
    }
    return items;
  },

  /**
   * POST /api/visits
   * Log a new GPS geofenced check-in visit
   */
  async createVisitCheckIn(data: Omit<Visit, 'id' | 'visitCode'>): Promise<Visit> {
    try {
      const res = await apiFetch<{ success: boolean; data: Visit }>('/visits', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.data) {
        const local = getLocalVisits();
        const updated = [res.data, ...local];
        saveLocalVisits(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/visits POST notice:', err);
    }

    await simulateNetworkDelay(150);
    const newVisit: Visit = {
      ...data,
      id: `vst-${Date.now()}`,
      visitCode: `VST-2026-${100 + mockVisits.length + 1}`,
    };
    const local = getLocalVisits();
    saveLocalVisits([newVisit, ...local]);
    return newVisit;
  },

  /**
   * GET /api/beat-plans
   * List all beat plans and route schedules
   */
  async getBeatPlans(): Promise<BeatPlan[]> {
    await simulateNetworkDelay(100);
    return [
      {
        id: 'beat-01',
        beatName: 'Connaught Place & Janpath Kirana Route',
        code: 'BEAT-DEL-01',
        territory: 'North Delhi',
        repId: 'rep-01',
        repName: 'Vikram Sharma',
        retailersCount: 18,
        scheduledDay: 'Monday',
        estimatedDistanceKm: 14.5,
        estimatedVisitsDurationHours: 6.5,
        completionPct: 88,
        status: 'Active',
      },
      {
        id: 'beat-02',
        beatName: 'Karol Bagh & Patel Nagar Supermarkets',
        code: 'BEAT-DEL-02',
        territory: 'West Delhi',
        repId: 'rep-02',
        repName: 'Ananya Verma',
        retailersCount: 22,
        scheduledDay: 'Tuesday',
        estimatedDistanceKm: 18.2,
        estimatedVisitsDurationHours: 7.0,
        completionPct: 92,
        status: 'Active',
      },
    ];
  },
};
