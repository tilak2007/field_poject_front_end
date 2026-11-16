/**
 * attendanceApi — Supabase-first attendance data layer.
 *
 * Architecture:
 *   ONLINE  → Write to Supabase first. Cache result in localStorage for instant reads.
 *   OFFLINE → Save to localStorage with { offline_pending: true } flag.
 *             Auto-sync to Supabase when connectivity is restored via syncPendingAttendance().
 *
 * localStorage is NEVER the source of truth — it is only an offline cache / read-through.
 */

import { supabase } from '../lib/supabase';
import { mockAttendanceRecords } from '../data/mockData';
import { isUnderManagerTerritory } from '../utils/territory';

export interface AttendanceRecord {
  id?: string;
  repId?: string;
  repName?: string;
  work_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  status?: string;
  working_hours?: number | null;
  location_name?: string | null;
  offline_pending?: boolean; // true = not yet synced to Supabase
}

export interface AttendanceHistoryItem {
  id: string;
  repId: string;
  repName: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'Present' | 'Late' | 'Half Day' | 'Absent' | 'Completed';
  startLocation: string;
  endLocation?: string;
  workingHours: number;
  batteryPctAtCheckIn: number;
  geofenceVerified: boolean;
  territory?: string;
  offline_pending?: boolean;
}

const getTodayDateStr = () => new Date().toISOString().split('T')[0];
const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

// ─── Cache keys (localStorage used only as offline cache) ───────────────────

function cacheKeys(repId: string, userKey: string, today: string) {
  return {
    primary: `fieldassist_attendance_${userKey}_${today}`,
    secondary: `fieldassist_attendance_${repId}_${today}`,
    generic: `attendance_${today}`,
  };
}

function writeToCache(record: AttendanceRecord, repId: string, userKey: string, today: string) {
  const keys = cacheKeys(repId, userKey, today);
  const json = JSON.stringify(record);
  try {
    localStorage.setItem(keys.primary, json);
    localStorage.setItem(keys.secondary, json);
    localStorage.setItem(keys.generic, json);
  } catch {}
}

function clearCache(repId: string, userKey: string, today: string) {
  const keys = cacheKeys(repId, userKey, today);
  try {
    localStorage.removeItem(keys.primary);
    localStorage.removeItem(keys.secondary);
    localStorage.removeItem(keys.generic);
    localStorage.removeItem('fieldassist_attendance_pending_checkin');
    localStorage.removeItem('fieldassist_attendance_pending_checkout');
  } catch {}
}

export const attendanceApi = {
  // ─── Helper: resolve repId ───────────────────────────────────────────────

  resolveRepId(user?: { id?: string; email?: string; name?: string } | null): string {
    if (user?.email === 'vikram@fieldassist.io' || user?.email === 'vikram.s@fieldassist.io') return 'rep-1';
    if (user?.email === 'ananya@fieldassist.io' || user?.email === 'ananya.v@fieldassist.io') return 'rep-2';
    if (user?.email === 'rahul@fieldassist.io' || user?.email === 'rahul.d@fieldassist.io') return 'rep-3';
    if (user?.email?.includes('nagarjun')) return 'rep-nagarjun';
    if (user?.id && !user.id.includes('@')) return user.id;
    if (user?.email) return `rep-${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return 'rep-1';
  },

  // ─── Ensure rep row exists in Supabase ───────────────────────────────────

  async ensureRepExists(user: {
    id?: string; name?: string; email?: string; territory?: string; region?: string;
  }): Promise<string> {
    const repId = this.resolveRepId(user);
    if (!isOnline()) return repId;
    try {
      const payload = {
        id: repId,
        name: user.name || 'Sales Representative',
        code: `REP-${(user.territory || 'BLR').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`,
        email: user.email || `${repId}@fieldassist.io`,
        territory: user.territory || 'Bengaluru South',
        region: user.region || 'South Zone (Bengaluru)',
        status: 'Active',
        battery_level: 92,
        last_check_in: 'Just now',
        target_amount: 0,
        target_achieved_pct: 0,
        visits_today_count: 0,
        total_distance_km: 0,
        sales_closed_amount: 0,
        join_date: new Date().toISOString().split('T')[0],
      };
      await supabase.from('sales_reps').upsert([payload], { onConflict: 'id' });
    } catch (err) {
      console.warn('ensureRepExists notice:', err);
    }
    return repId;
  },

  // ─── Sync any pending offline attendance records to Supabase ─────────────

  async syncPendingAttendance(): Promise<void> {
    if (!isOnline()) return;
    const today = getTodayDateStr();

    // Check for a pending check-in
    const pendingCheckIn = localStorage.getItem('fieldassist_attendance_pending_checkin');
    if (pendingCheckIn) {
      try {
        const rec: AttendanceRecord = JSON.parse(pendingCheckIn);
        const { data, error } = await supabase
          .from('attendance')
          .insert([{
            rep_id: rec.repId,
            work_date: rec.work_date,
            check_in_time: rec.check_in_time,
            latitude: rec.latitude,
            longitude: rec.longitude,
            notes: rec.notes,
            status: rec.status || 'Present',
            working_hours: rec.working_hours || 0,
          }])
          .select()
          .single();

        if (!error && data?.id) {
          const synced: AttendanceRecord = { ...rec, id: data.id, offline_pending: false };
          const repId = rec.repId || '';
          const userKey = repId;
          writeToCache(synced, repId, userKey, today);
          localStorage.removeItem('fieldassist_attendance_pending_checkin');
          console.log('[Attendance Sync] Offline punch-in synced to Supabase:', data.id);
        }
      } catch (err) {
        console.warn('[Attendance Sync] Check-in sync failed:', err);
      }
    }

    // Check for a pending check-out
    const pendingCheckOut = localStorage.getItem('fieldassist_attendance_pending_checkout');
    if (pendingCheckOut) {
      try {
        const rec: AttendanceRecord = JSON.parse(pendingCheckOut);
        if (rec.repId && rec.work_date) {
          const { error } = await supabase
            .from('attendance')
            .update({
              check_out_time: rec.check_out_time,
              status: 'Completed',
              working_hours: rec.working_hours,
              notes: rec.notes,
            })
            .eq('work_date', rec.work_date)
            .eq('rep_id', rec.repId);

          if (!error) {
            const synced: AttendanceRecord = { ...rec, offline_pending: false };
            const repId = rec.repId || '';
            writeToCache(synced, repId, repId, today);
            localStorage.removeItem('fieldassist_attendance_pending_checkout');
            console.log('[Attendance Sync] Offline punch-out synced to Supabase');
          }
        }
      } catch (err) {
        console.warn('[Attendance Sync] Check-out sync failed:', err);
      }
    }
  },

  // ─── Synchronous cache read (for zero-delay initial render) ─────────────
  // This is the ONLY valid use of localStorage as a data source — to avoid
  // a loading flash on first render while the Supabase fetch is in-flight.

  getCachedTodayAttendance(user?: { id?: string; email?: string } | null): AttendanceRecord | null {
    const today = getTodayDateStr();
    const repId = this.resolveRepId(user);
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);
    const keys = cacheKeys(repId, userKey, today);

    for (const key of [keys.primary, keys.secondary, keys.generic]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed: AttendanceRecord = JSON.parse(raw);
        if (parsed?.work_date === today) {
          if (key === keys.generic && parsed.repId && parsed.repId !== repId && parsed.repId !== user?.id) continue;
          return parsed;
        }
      } catch {}
    }
    return null;
  },

  // ─── Fetch today's attendance from Supabase (source of truth) ───────────

  async getTodayAttendance(user?: { id?: string; email?: string; name?: string } | null): Promise<AttendanceRecord | null> {
    const today = getTodayDateStr();
    const repId = this.resolveRepId(user);
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);

    // Try syncing any offline-pending records first
    if (isOnline()) {
      await this.syncPendingAttendance();
    }

    // ── ONLINE: Supabase is the source of truth ──
    if (isOnline()) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('work_date', today)
          .eq('rep_id', repId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const record: AttendanceRecord = {
            id: data.id,
            repId: data.rep_id || repId,
            repName: user?.name || 'Sales Representative',
            work_date: data.work_date,
            check_in_time: data.check_in_time,
            check_out_time: data.check_out_time,
            latitude: data.latitude,
            longitude: data.longitude,
            notes: data.notes,
            status: data.status,
            working_hours: data.working_hours,
            location_name: data.location_name || this.getCachedTodayAttendance(user)?.location_name,
            offline_pending: false,
          };
          // Update local cache with fresh Supabase data
          writeToCache(record, repId, userKey, today);
          return record;
        }

        if (!error && !data) {
          // Supabase confirmed no record exists today — clear stale cache
          clearCache(repId, userKey, today);
          return null;
        }
      } catch (err) {
        console.warn('[Attendance] Supabase read failed, falling back to cache:', err);
      }
    }

    // ── OFFLINE: Fall back to localStorage cache ──
    const cached = this.getCachedTodayAttendance(user);
    if (cached) {
      console.log('[Attendance] Offline mode — using cached attendance record');
    }
    return cached;
  },

  // ─── Punch In ────────────────────────────────────────────────────────────

  async checkIn(params: {
    user: { id?: string; name?: string; email?: string; territory?: string; region?: string };
    latitude: number;
    longitude: number;
    notes?: string;
    locationName?: string;
  }): Promise<AttendanceRecord> {
    const today = getTodayDateStr();
    const nowIso = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const repId = await this.ensureRepExists(params.user);
    const userKey = params.user.id || (params.user.email ? params.user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);
    const locationDisplay = params.locationName ||
      `${params.user.territory || 'Bengaluru South'} (${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)})`;

    // ── ONLINE: Write to Supabase first ──
    if (isOnline()) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .insert([{
            rep_id: repId,
            work_date: today,
            check_in_time: nowIso,
            latitude: params.latitude,
            longitude: params.longitude,
            notes: params.notes || 'Morning shift check-in',
            status: 'Present',
            working_hours: 0,
          }])
          .select()
          .single();

        if (!error && data?.id) {
          // Success — build record from Supabase response
          const record: AttendanceRecord = {
            id: data.id,
            repId,
            repName: params.user.name || 'Sales Representative',
            work_date: today,
            check_in_time: data.check_in_time || nowIso,
            latitude: params.latitude,
            longitude: params.longitude,
            location_name: locationDisplay,
            notes: params.notes || 'Morning shift check-in',
            status: 'Present',
            working_hours: 0,
            offline_pending: false,
          };
          // Cache in localStorage (read-through cache only)
          writeToCache(record, repId, userKey, today);
          this._addToHistory(record, params.user, locationDisplay, timeFormatted);
          console.log('[Attendance] Punch-in saved to Supabase:', data.id);
          return record;
        }

        // Supabase returned an error — log and fall through to offline mode
        if (error) {
          console.warn('[Attendance] Supabase punch-in error, saving offline:', error.message);
          // fall through to offline
        }
      } catch (err: any) {
        // Network / fetch exception — fall through to offline mode
        console.warn('[Attendance] Network error during punch-in, saving offline:', err?.message);
      }
    }

    // ── OFFLINE: Save locally and queue for sync ──
    const offlineRecord: AttendanceRecord = {
      id: `att-offline-${Date.now()}`,
      repId,
      repName: params.user.name || 'Sales Representative',
      work_date: today,
      check_in_time: nowIso,
      latitude: params.latitude,
      longitude: params.longitude,
      location_name: locationDisplay,
      notes: params.notes || 'Morning shift check-in',
      status: 'Present',
      working_hours: 0,
      offline_pending: true,
    };

    writeToCache(offlineRecord, repId, userKey, today);
    // Queue for Supabase sync when online
    localStorage.setItem('fieldassist_attendance_pending_checkin', JSON.stringify(offlineRecord));
    this._addToHistory(offlineRecord, params.user, locationDisplay, timeFormatted);
    console.warn('[Attendance] Offline mode — punch-in saved locally, will sync when online');
    return offlineRecord;
  },

  // ─── Punch Out ───────────────────────────────────────────────────────────

  async checkOut(params: {
    user: { id?: string; name?: string; email?: string; territory?: string };
    todayAttendance: AttendanceRecord;
    notes?: string;
    endLocation?: string;
  }): Promise<AttendanceRecord> {
    const today = getTodayDateStr();
    const nowIso = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const repId = this.resolveRepId(params.user);
    const userKey = params.user.id || (params.user.email ? params.user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);

    const checkInDate = params.todayAttendance.check_in_time
      ? new Date(params.todayAttendance.check_in_time) : new Date();
    const diffHours = Math.max(
      0.1,
      Number(((new Date().getTime() - checkInDate.getTime()) / (1000 * 60 * 60)).toFixed(1))
    );
    const fullNotes = `${params.todayAttendance.notes || 'Morning shift'} | ${params.notes || 'Completed daily route'}`;

    const updatedRecord: AttendanceRecord = {
      ...params.todayAttendance,
      work_date: today,
      check_out_time: nowIso,
      status: 'Completed',
      working_hours: diffHours,
      notes: fullNotes,
    };

    // ── ONLINE: Update Supabase first ──
    if (isOnline()) {
      try {
        let query = supabase
          .from('attendance')
          .update({
            check_out_time: nowIso,
            status: 'Completed',
            working_hours: diffHours,
            notes: fullNotes,
          });

        // Prefer ID-based update if we have a real Supabase ID
        if (params.todayAttendance.id && !params.todayAttendance.id.startsWith('att-offline')) {
          query = query.eq('id', params.todayAttendance.id);
        } else {
          query = query.eq('work_date', today).eq('rep_id', repId);
        }

        const { error } = await query;
        if (!error) {
          const synced = { ...updatedRecord, offline_pending: false };
          writeToCache(synced, repId, userKey, today);
          this._updateHistoryCheckout(repId, today, timeFormatted, diffHours, params.endLocation || params.user.territory);
          console.log('[Attendance] Punch-out saved to Supabase');
          return synced;
        }

        // Supabase returned an error — log and fall through to offline mode
        if (error) {
          console.warn('[Attendance] Supabase punch-out error, saving offline:', error.message);
          // fall through to offline
        }
      } catch (err: any) {
        // Network / fetch exception — fall through to offline mode
        console.warn('[Attendance] Network error during punch-out, saving offline:', err?.message);
      }
    }

    // ── OFFLINE: Save locally and queue for sync ──
    const offlineRecord = { ...updatedRecord, offline_pending: true };
    writeToCache(offlineRecord, repId, userKey, today);
    localStorage.setItem('fieldassist_attendance_pending_checkout', JSON.stringify(offlineRecord));
    this._updateHistoryCheckout(repId, today, timeFormatted, diffHours, params.endLocation || params.user.territory);
    console.warn('[Attendance] Offline mode — punch-out saved locally, will sync when online');
    return offlineRecord;
  },

  // ─── History helpers ─────────────────────────────────────────────────────

  _addToHistory(
    record: AttendanceRecord,
    user: { name?: string; territory?: string },
    location: string,
    timeFormatted: string
  ) {
    const historyItem: AttendanceHistoryItem = {
      id: `att-hist-${Date.now()}`,
      repId: record.repId || '',
      repName: record.repName || user.name || 'Sales Representative',
      date: record.work_date,
      checkInTime: timeFormatted,
      status: 'Present',
      startLocation: location,
      workingHours: 0,
      batteryPctAtCheckIn: 94,
      geofenceVerified: true,
      territory: user.territory || 'Bengaluru South',
      offline_pending: record.offline_pending,
    };
    try {
      const existing = localStorage.getItem('fieldassist_attendance_history');
      let hist: AttendanceHistoryItem[] = existing ? JSON.parse(existing) : [];
      hist = [
        historyItem,
        ...hist.filter((h) => !(h.date === record.work_date && h.repId === record.repId)),
      ];
      localStorage.setItem('fieldassist_attendance_history', JSON.stringify(hist));
    } catch {}
  },

  _updateHistoryCheckout(
    repId: string,
    today: string,
    timeFormatted: string,
    diffHours: number,
    endLocation?: string
  ) {
    try {
      const existing = localStorage.getItem('fieldassist_attendance_history');
      if (!existing) return;
      let hist: AttendanceHistoryItem[] = JSON.parse(existing);
      hist = hist.map((item) => {
        if (item.date === today && item.repId === repId) {
          return {
            ...item,
            checkOutTime: timeFormatted,
            workingHours: diffHours,
            status: 'Completed' as const,
            endLocation: endLocation || 'Depot',
          };
        }
        return item;
      });
      localStorage.setItem('fieldassist_attendance_history', JSON.stringify(hist));
    } catch {}
  },

  // ─── Fetch history (Supabase first, localStorage fallback) ──────────────

  async getAttendanceHistory(
    user?: { id?: string; name?: string; role?: string; territory?: string; email?: string } | null
  ): Promise<AttendanceHistoryItem[]> {
    // ── ONLINE: Supabase is the source of truth ──
    if (isOnline()) {
      try {
        const { data } = await supabase
          .from('attendance')
          .select('*, sales_reps(name, territory, code)')
          .order('created_at', { ascending: false })
          .limit(50);

        if (data && data.length > 0) {
          const sbItems: AttendanceHistoryItem[] = data.map((r: any) => {
            const repInfo = r.sales_reps || {};
            const checkIn = r.check_in_time
              ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '09:00 AM';
            const checkOut = r.check_out_time
              ? new Date(r.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : undefined;
            return {
              id: r.id,
              repId: r.rep_id || 'rep-1',
              repName: repInfo.name || 'Sales Representative',
              date: r.work_date,
              checkInTime: checkIn,
              checkOutTime: checkOut,
              status: r.status === 'Completed' ? 'Completed' : 'Present',
              startLocation: `${repInfo.territory || 'Bengaluru'} (${r.latitude?.toFixed(2) || '12.93'}, ${r.longitude?.toFixed(2) || '77.58'})`,
              endLocation: checkOut ? `${repInfo.territory || 'Bengaluru'} Depot` : undefined,
              workingHours: Number(r.working_hours ?? 0),
              batteryPctAtCheckIn: 90,
              geofenceVerified: true,
              territory: repInfo.territory || 'Bengaluru South',
            };
          });

          // Merge any offline-pending records not yet in Supabase
          const pendingLocal = this._getLocalHistory();
          const pendingOnly = pendingLocal.filter(
            (l) => l.offline_pending && !sbItems.find((s) => s.id === l.id)
          );

          const merged = [...pendingOnly, ...sbItems];
          // Update local cache with fresh Supabase data
          localStorage.setItem('fieldassist_attendance_history', JSON.stringify(merged));

          return this._filterByRole(merged, user);
        }
      } catch (err) {
        console.warn('[Attendance] Supabase history fetch failed, using local cache:', err);
      }
    }

    // ── OFFLINE: Use local history cache ──
    let hist = this._getLocalHistory();
    if (hist.length === 0) {
      hist = mockAttendanceRecords as AttendanceHistoryItem[];
    }
    return this._filterByRole(hist, user);
  },

  _getLocalHistory(): AttendanceHistoryItem[] {
    try {
      const saved = localStorage.getItem('fieldassist_attendance_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  },

  _filterByRole(
    list: AttendanceHistoryItem[],
    user?: { id?: string; name?: string; role?: string; territory?: string; email?: string } | null
  ): AttendanceHistoryItem[] {
    const isManagerOrAdmin = user?.role === 'System Admin' || user?.role === 'Sales Manager';
    if (!isManagerOrAdmin) {
      const myRepId = this.resolveRepId(user);
      return list.filter(
        (a) =>
          (user?.email === 'vikram@fieldassist.io' && (a.repId === 'rep-1' || a.repName.toLowerCase().includes('vikram'))) ||
          a.repId === myRepId ||
          (user?.id && a.repId === user.id) ||
          (user?.name && a.repName.toLowerCase() === user.name.toLowerCase())
      );
    }
    if (user?.role === 'Sales Manager') {
      return list.filter((a) => {
        const territory = a.territory ||
          (a.startLocation.toLowerCase().includes('mumbai') ? 'Mumbai South'
            : a.startLocation.toLowerCase().includes('kolkata') ? 'Kolkata Central'
            : a.startLocation.toLowerCase().includes('delhi') ? 'Delhi NCR'
            : 'Bengaluru South');
        return isUnderManagerTerritory(user as any, { territory });
      });
    }
    return list; // System Admin sees all
  },

  // ─── Reset today's punch (delete from Supabase + clear cache) ───────────

  async resetTodayPunch(user?: { id?: string; email?: string } | null): Promise<void> {
    const today = getTodayDateStr();
    const repId = this.resolveRepId(user);
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);

    // 1. Delete from Supabase (source of truth)
    if (isOnline()) {
      try {
        await supabase.from('attendance').delete().eq('work_date', today).eq('rep_id', repId);
        console.log('[Attendance] Today punch deleted from Supabase');
      } catch (err) {
        console.warn('[Attendance] Supabase delete failed:', err);
      }
    }

    // 2. Clear local cache
    clearCache(repId, userKey, today);
  },
};
