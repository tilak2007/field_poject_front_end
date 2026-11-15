import { mockTargets } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { isUnderManagerTerritory } from '../utils/territory';

export interface Target {
  id: string;
  repId: string;
  repName: string;
  repRole: 'Sales Representative' | 'Sales Manager';
  territory: string;
  monthYear: string;
  salesTargetAmount: number;
  salesAchievedAmount: number;
  visitsTargetCount: number;
  visitsAchievedCount: number;
  newOutletsTargetCount: number;
  newOutletsAchievedCount: number;
  status: 'On Track' | 'At Risk' | 'Achieved' | 'Pending Allocation' | 'Behind';
  assignedBy?: string;
  assignedDate?: string;
}

const STORAGE_KEY = 'fieldassist_targets';

export const targetsApi = {
  /**
   * Synchronously load all targets from storage
   */
  getLocalTargets(): Target[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Seed initial mock targets
    const initial: Target[] = mockTargets.map((t) => ({
      ...t,
      repRole: (t as any).repRole || 'Sales Representative',
      territory: (t as any).territory || (t.repName.includes('Rohit') ? 'Mumbai South' : t.repName.includes('Amitabh') ? 'Kolkata Central' : t.repName.includes('Suresh') ? 'Delhi NCR' : 'Bengaluru South'),
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {}
    return initial;
  },

  /**
   * Save targets list to local storage
   */
  saveLocalTargets(list: Target[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  },

  /**
   * Get targets visible to the current user (strictly governed by role & territory)
   */
  async getVisibleTargets(user?: { id?: string; name?: string; role?: string; territory?: string; email?: string } | null): Promise<Target[]> {
    const all = this.getLocalTargets();

    if (!user) return all;

    // 1. Sales Representative: ONLY see their own personal target
    if (user.role === 'Sales Representative') {
      const isVikram = user.email === 'vikram@fieldassist.io' || user.email === 'vikram.s@fieldassist.io';
      return all.filter((t) => {
        if (isVikram && (t.repId === 'rep-1' || t.repName.toLowerCase().includes('vikram'))) return true;
        if (user.id && t.repId === user.id) return true;
        if (user.name && t.repName.toLowerCase() === user.name.toLowerCase()) return true;
        if (user.email && t.repId.includes(user.email.split('@')[0])) return true;
        return false;
      });
    }

    // 2. Sales Manager: Sees targets assigned to themselves AND reps under their territory
    if (user.role === 'Sales Manager') {
      return all.filter((t) => {
        // Own manager target
        if (
          (user.id && t.repId === user.id) ||
          (user.name && t.repName.toLowerCase() === user.name.toLowerCase()) ||
          t.repRole === 'Sales Manager' && t.territory.toLowerCase().includes(user.territory?.toLowerCase() || '')
        ) {
          return true;
        }

        // Reps under manager territory
        return isUnderManagerTerritory(user as any, { territory: t.territory });
      });
    }

    // 3. System Admin: Sees all nationwide targets
    return all;
  },

  /**
   * Assign or update a target for a Representative or Manager
   */
  async allocateTarget(data: {
    repId: string;
    repName: string;
    repRole: 'Sales Representative' | 'Sales Manager';
    territory: string;
    monthYear: string;
    salesTargetAmount: number;
    visitsTargetCount: number;
    newOutletsTargetCount: number;
    assignedBy?: string;
  }): Promise<Target> {
    const all = this.getLocalTargets();

    // Check if target already exists for this person and month
    const existingIndex = all.findIndex(
      (t) =>
        (t.repId === data.repId || t.repName.toLowerCase() === data.repName.toLowerCase()) &&
        t.monthYear === data.monthYear
    );

    const newTarget: Target = {
      id: existingIndex !== -1 ? all[existingIndex].id : `tgt-${Date.now()}`,
      repId: data.repId,
      repName: data.repName,
      repRole: data.repRole,
      territory: data.territory,
      monthYear: data.monthYear,
      salesTargetAmount: Number(data.salesTargetAmount) || 1500000,
      salesAchievedAmount: existingIndex !== -1 ? all[existingIndex].salesAchievedAmount : 0,
      visitsTargetCount: Number(data.visitsTargetCount) || 150,
      visitsAchievedCount: existingIndex !== -1 ? all[existingIndex].visitsAchievedCount : 0,
      newOutletsTargetCount: Number(data.newOutletsTargetCount) || 12,
      newOutletsAchievedCount: existingIndex !== -1 ? all[existingIndex].newOutletsAchievedCount : 0,
      status: 'On Track',
      assignedBy: data.assignedBy || 'Area Sales Manager',
      assignedDate: new Date().toISOString().split('T')[0],
    };

    let updated: Target[];
    if (existingIndex !== -1) {
      updated = [...all];
      updated[existingIndex] = newTarget;
    } else {
      updated = [newTarget, ...all];
    }

    this.saveLocalTargets(updated);

    // Save individual user-scoped key so page reloads load instantly
    const userScopedKey = `fieldassist_target_${data.repId}`;
    try {
      localStorage.setItem(userScopedKey, JSON.stringify(newTarget));
    } catch {}

    // Update Supabase sales_reps table if target is for a sales rep
    if (data.repRole === 'Sales Representative') {
      try {
        await supabase
          .from('sales_reps')
          .update({
            target_amount: data.salesTargetAmount,
          })
          .eq('id', data.repId);
      } catch (err) {
        console.warn('Supabase target update warning:', err);
      }
    }

    return newTarget;
  },

  /**
   * Get target assigned to a specific representative for the current period
   */
  getTargetForRep(user?: { id?: string; name?: string; email?: string } | null): Target | null {
    if (!user) return null;
    const all = this.getLocalTargets();

    const isVikram = user.email === 'vikram@fieldassist.io' || user.email === 'vikram.s@fieldassist.io';

    const found = all.find((t) => {
      if (isVikram && (t.repId === 'rep-1' || t.repName.toLowerCase().includes('vikram'))) return true;
      if (user.id && t.repId === user.id) return true;
      if (user.name && t.repName.toLowerCase() === user.name.toLowerCase()) return true;
      if (user.email && t.repId.includes(user.email.split('@')[0])) return true;
      return false;
    });

    return found || null;
  },
};
