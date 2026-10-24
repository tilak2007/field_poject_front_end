import type { Distributor } from '../types';
import { mockDistributors } from '../data/mockData';
import { apiFetch, simulateNetworkDelay } from './client';

const LOCAL_STORAGE_KEY = 'fieldassist_distributors';

function getLocalDistributors(): Distributor[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...mockDistributors];
}

function saveLocalDistributors(list: Distributor[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const distributorsApi = {
  /**
   * GET /api/distributors
   */
  async getDistributors(): Promise<Distributor[]> {
    try {
      const res = await apiFetch<{ success: boolean; data: Distributor[] }>('/distributors');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalDistributors(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/distributors fallback to cache:', err);
    }

    await simulateNetworkDelay(100);
    return getLocalDistributors();
  },

  /**
   * POST /api/distributors
   */
  async createDistributor(data: Omit<Distributor, 'id'>): Promise<Distributor> {
    try {
      const res = await apiFetch<{ success: boolean; data: Distributor }>('/distributors', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.data) {
        const local = getLocalDistributors();
        const updated = [res.data, ...local];
        saveLocalDistributors(updated);
        return res.data;
      }
    } catch (err) {
      console.warn('Backend /api/distributors POST notice:', err);
    }

    await simulateNetworkDelay(150);
    const newDist: Distributor = {
      ...data,
      id: `dist-${Date.now()}`,
    };
    const local = getLocalDistributors();
    saveLocalDistributors([newDist, ...local]);
    return newDist;
  },
};
