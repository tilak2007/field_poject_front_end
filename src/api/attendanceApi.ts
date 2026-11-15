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
}

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

export const attendanceApi = {
  /**
   * Helper to resolve standard repId for a user
   */
  resolveRepId(user?: { id?: string; email?: string; name?: string } | null): string {
    if (user?.email === 'vikram@fieldassist.io' || user?.email === 'vikram.s@fieldassist.io') {
      return 'rep-1';
    }
    if (user?.email === 'ananya@fieldassist.io' || user?.email === 'ananya.v@fieldassist.io') {
      return 'rep-2';
    }
    if (user?.email === 'rahul@fieldassist.io' || user?.email === 'rahul.d@fieldassist.io') {
      return 'rep-3';
    }
    if (user?.email?.includes('nagarjun')) {
      return 'rep-nagarjun';
    }
    if (user?.id && !user.id.includes('@')) {
      return user.id;
    }
    if (user?.email) {
      return `rep-${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    return 'rep-1';
  },

  /**
   * Ensure rep exists in Supabase sales_reps table to satisfy foreign keys
   */
  async ensureRepExists(user: { id?: string; name?: string; email?: string; territory?: string; region?: string }): Promise<string> {
    const repId = this.resolveRepId(user);
    try {
      const repPayload = {
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

      await supabase.from('sales_reps').upsert([repPayload], { onConflict: 'id' });
    } catch (err) {
      console.warn('ensureRepExists notice:', err);
    }
    return repId;
  },

  /**
   * Synchronous local read for zero-delay UI rendering
   */
  getCachedTodayAttendance(user?: { id?: string; email?: string } | null): AttendanceRecord | null {
    const today = getTodayDateStr();
    const repId = this.resolveRepId(user);
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);

    // 1. Try user-scoped key
    const userScopedKey = `fieldassist_attendance_${userKey}_${today}`;
    const userScoped = localStorage.getItem(userScopedKey);
    if (userScoped) {
      try {
        const parsed = JSON.parse(userScoped);
        if (parsed && parsed.work_date === today) return parsed;
      } catch {}
    }

    // 2. Try rep-scoped key
    const repScoped = localStorage.getItem(`fieldassist_attendance_${repId}_${today}`);
    if (repScoped) {
      try {
        const parsed = JSON.parse(repScoped);
        if (parsed && parsed.work_date === today) return parsed;
      } catch {}
    }

    // 3. Try generic key
    const generic = localStorage.getItem(`attendance_${today}`);
    if (generic) {
      try {
        const parsed = JSON.parse(generic);
        if (parsed && parsed.work_date === today) {
          if (!parsed.repId || parsed.repId === repId || parsed.repId === user?.id) {
            return parsed;
          }
        }
      } catch {}
    }

    return null;
  },

  /**
   * Asynchronously fetch today's attendance record from Supabase with fallback to cache
   */
  async getTodayAttendance(user?: { id?: string; email?: string; name?: string } | null): Promise<AttendanceRecord | null> {
    const today = getTodayDateStr();
    const repId = this.resolveRepId(user);
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);

    // Synchronous local read first
    const cached = this.getCachedTodayAttendance(user);

    try {
      // Query Supabase for today's punch for this rep
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
          location_name: cached?.location_name || `${data.latitude?.toFixed(4)}, ${data.longitude?.toFixed(4)}`,
        };

        // Cache locally
        localStorage.setItem(`fieldassist_attendance_${userKey}_${today}`, JSON.stringify(record));
        localStorage.setItem(`fieldassist_attendance_${repId}_${today}`, JSON.stringify(record));
        localStorage.setItem(`attendance_${today}`, JSON.stringify(record));
        return record;
      }
    } catch (err) {
      console.warn('Supabase attendance check notice:', err);
    }

    return cached;
  },

  /**
   * Check in (Punch in)
   */
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
    const locationDisplay =
      params.locationName ||
      `${params.user.territory || 'Bengaluru South'} (${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)})`;

    let generatedId = `att-${Date.now()}`;

    // 1. Supabase insert
    try {
      const { data, error } = await supabase
        .from('attendance')
        .insert([
          {
            rep_id: repId,
            user_id: null,
            work_date: today,
            check_in_time: nowIso,
            latitude: params.latitude,
            longitude: params.longitude,
            notes: params.notes || 'Morning shift check-in',
            status: 'Present',
            working_hours: 0,
          },
        ])
        .select()
        .single();

      if (!error && data?.id) {
        generatedId = data.id;
      }
    } catch (err) {
      console.warn('Supabase checkIn warning:', err);
    }

    const newRecord: AttendanceRecord = {
      id: generatedId,
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
    };

    // 2. Persistent Local Storage
    localStorage.setItem(`fieldassist_attendance_${userKey}_${today}`, JSON.stringify(newRecord));
    localStorage.setItem(`fieldassist_attendance_${repId}_${today}`, JSON.stringify(newRecord));
    localStorage.setItem(`attendance_${today}`, JSON.stringify(newRecord));

    // 3. Add to history
    const historyItem: AttendanceHistoryItem = {
      id: `att-hist-${Date.now()}`,
      repId,
      repName: params.user.name || 'Sales Representative',
      date: today,
      checkInTime: timeFormatted,
      status: 'Present',
      startLocation: locationDisplay,
      workingHours: 0,
      batteryPctAtCheckIn: 94,
      geofenceVerified: true,
      territory: params.user.territory || 'Bengaluru South',
    };

    try {
      const existingHistStr = localStorage.getItem('fieldassist_attendance_history');
      let hist: AttendanceHistoryItem[] = existingHistStr ? JSON.parse(existingHistStr) : [];
      hist = [historyItem, ...hist.filter((h) => !(h.date === today && (h.repId === repId || h.repName === params.user.name)))];
      localStorage.setItem('fieldassist_attendance_history', JSON.stringify(hist));
    } catch {}

    return newRecord;
  },

  /**
   * Check out (Punch out)
   */
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
      ? new Date(params.todayAttendance.check_in_time)
      : new Date();
    const diffHours = Math.max(
      0.1,
      Number(((new Date().getTime() - checkInDate.getTime()) / (1000 * 60 * 60)).toFixed(1))
    );

    const fullNotes = `${params.todayAttendance.notes || 'Morning shift'} | ${params.notes || 'Completed daily route'}`;

    // 1. Supabase update
    try {
      await supabase
        .from('attendance')
        .update({
          check_out_time: nowIso,
          status: 'Completed',
          working_hours: diffHours,
          notes: fullNotes,
        })
        .eq('work_date', today)
        .eq('rep_id', repId);
    } catch (err) {
      console.warn('Supabase checkOut warning:', err);
    }

    const updatedRecord: AttendanceRecord = {
      ...params.todayAttendance,
      work_date: today,
      check_out_time: nowIso,
      status: 'Completed',
      working_hours: diffHours,
      notes: fullNotes,
    };

    // 2. Persistent Local Storage
    localStorage.setItem(`fieldassist_attendance_${userKey}_${today}`, JSON.stringify(updatedRecord));
    localStorage.setItem(`fieldassist_attendance_${repId}_${today}`, JSON.stringify(updatedRecord));
    localStorage.setItem(`attendance_${today}`, JSON.stringify(updatedRecord));

    // 3. Update history
    try {
      const existingHistStr = localStorage.getItem('fieldassist_attendance_history');
      let hist: AttendanceHistoryItem[] = existingHistStr ? JSON.parse(existingHistStr) : [];
      hist = hist.map((item) => {
        if (item.date === today && (item.repId === repId || item.repName === params.user.name)) {
          return {
            ...item,
            checkOutTime: timeFormatted,
            workingHours: diffHours,
            status: 'Completed' as const,
            endLocation: params.endLocation || params.user.territory || 'Bengaluru South Depot',
          };
        }
        return item;
      });
      localStorage.setItem('fieldassist_attendance_history', JSON.stringify(hist));
    } catch {}

    return updatedRecord;
  },

  /**
   * Fetch attendance history records, scoped by role & territory
   */
  async getAttendanceHistory(user?: { id?: string; name?: string; role?: string; territory?: string; email?: string } | null): Promise<AttendanceHistoryItem[]> {
    let localHist: AttendanceHistoryItem[] = [];
    try {
      const saved = localStorage.getItem('fieldassist_attendance_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) localHist = parsed;
      }
    } catch {}

    if (localHist.length === 0) {
      localHist = mockAttendanceRecords as AttendanceHistoryItem[];
    }

    // Try fetching recent from Supabase and merge
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*, sales_reps(name, territory, code)')
        .order('created_at', { ascending: false })
        .limit(30);

      if (data && data.length > 0) {
        const sbItems: AttendanceHistoryItem[] = data.map((r: any) => {
          const repInfo = r.sales_reps || {};
          const checkIn = r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM';
          const checkOut = r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined;
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

        // Merge without duplicates
        const mapById = new Map<string, AttendanceHistoryItem>();
        for (const it of [...sbItems, ...localHist]) {
          const key = `${it.repId}_${it.date}`;
          if (!mapById.has(key)) mapById.set(key, it);
        }
        localHist = Array.from(mapById.values());
      }
    } catch {}

    // Role & territory governance:
    const isManagerOrAdmin = user?.role === 'System Admin' || user?.role === 'Sales Manager';
    const isRep = !isManagerOrAdmin;

    if (isRep) {
      const myRepId = this.resolveRepId(user);
      return localHist.filter(
        (a) =>
          (user?.email === 'vikram@fieldassist.io' && (a.repId === 'rep-1' || a.repName.toLowerCase().includes('vikram'))) ||
          a.repId === myRepId ||
          (user?.id && a.repId === user.id) ||
          (user?.name && a.repName.toLowerCase() === user.name.toLowerCase())
      );
    }

    if (user?.role === 'Sales Manager') {
      return localHist.filter((a) => {
        const territory =
          a.territory ||
          (a.startLocation.toLowerCase().includes('mumbai') || a.repName.toLowerCase().includes('rohit')
            ? 'Mumbai South'
            : a.startLocation.toLowerCase().includes('kolkata') || a.repName.toLowerCase().includes('amitabh')
            ? 'Kolkata Central'
            : a.startLocation.toLowerCase().includes('delhi') || a.repName.toLowerCase().includes('suresh')
            ? 'Delhi NCR'
            : 'Bengaluru South');
        return isUnderManagerTerritory(user as any, { territory });
      });
    }

    // System Admin sees all
    return localHist;
  },

  /**
   * Reset today's punch for testing
   */
  async resetTodayPunch(user?: { id?: string; email?: string } | null): Promise<void> {
    const today = getTodayDateStr();
    const repId = this.resolveRepId(user);
    const userKey = user?.id || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : repId);

    localStorage.removeItem(`fieldassist_attendance_${userKey}_${today}`);
    localStorage.removeItem(`fieldassist_attendance_${repId}_${today}`);
    localStorage.removeItem(`attendance_${today}`);

    try {
      await supabase.from('attendance').delete().eq('work_date', today).eq('rep_id', repId);
    } catch {}
  },
};
