/**
 * AttendanceContext — Global session-level punch-in/out state manager.
 *
 * Lives at the App root (outside BrowserRouter) so it NEVER unmounts on
 * page navigation. The punch-in state is therefore always preserved.
 *
 * Fix history:
 *   v1 — initial read passed `null` user to getCachedTodayAttendance, so the
 *         correct localStorage key was never found on first render.
 *   v2 — initial read now correctly passes the already-available `user` object
 *         from useAuth() (which reads synchronously from localStorage itself).
 *         Additionally, a storage event listener keeps state in sync across tabs.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { attendanceApi, type AttendanceRecord } from '../api/attendanceApi';
import { useAuth } from './AuthContext';

interface AttendanceContextType {
  /** Today's attendance record — null means not punched in yet */
  todayAttendance: AttendanceRecord | null;
  /** True while performing punch-in or punch-out */
  isSubmitting: boolean;
  /** Whether the user is currently punched in */
  isPunchedIn: boolean;
  /** Whether the user has punched out for today */
  isPunchedOut: boolean;
  /** Perform punch-in */
  punchIn: (params: {
    latitude: number;
    longitude: number;
    locationName?: string;
    notes?: string;
  }) => Promise<AttendanceRecord>;
  /** Perform punch-out */
  punchOut: (params: { notes?: string; endLocation?: string }) => Promise<AttendanceRecord>;
  /** Force-refresh from storage and Supabase */
  refresh: () => Promise<void>;
  /** Reset today's punch (for testing) */
  resetPunch: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // useAuth() reads synchronously from localStorage — user is already populated on first render
  const { user } = useAuth();

  // ── Synchronous initializer: MUST pass `user` (not null) so the right cache key is read ──
  // Because useAuth() runs before this useState call in the same render, `user` is available here.
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(() => {
    return attendanceApi.getCachedTodayAttendance(user);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track whether we have already loaded for the current user to avoid double-fetches
  const loadedForUserRef = useRef<string | null>(null);

  // ── Refresh: re-read cache then verify with Supabase ──
  const refresh = useCallback(async () => {
    if (!user) return;

    // 1. Synchronous cache read first (zero delay, no flash)
    const cached = attendanceApi.getCachedTodayAttendance(user);
    if (cached) {
      setTodayAttendance(cached);
    }

    // 2. Background Supabase verification — do NOT set to null on failure
    try {
      const verified = await attendanceApi.getTodayAttendance(user);
      if (verified) {
        setTodayAttendance(verified);
      }
      // If nothing returned from Supabase AND no local cache, leave as-is
    } catch {
      // Keep cached value on network failure — do NOT reset to null
    }
  }, [user]);

  // ── Run once per unique user identity (login) ──
  useEffect(() => {
    if (!user?.id && !user?.email) return;
    const userKey = user.id || user.email || '';
    if (loadedForUserRef.current === userKey) return; // avoid re-fetch on re-renders
    loadedForUserRef.current = userKey;

    // Immediately read cache for instant state
    const cached = attendanceApi.getCachedTodayAttendance(user);
    if (cached) {
      setTodayAttendance(cached);
    }

    // Background Supabase sync
    refresh();
  }, [user?.id, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Storage event: keeps state in sync if another tab writes the attendance key ──
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;
      const today = new Date().toISOString().split('T')[0];
      if (e.key.includes('attendance') && e.key.includes(today)) {
        try {
          const parsed: AttendanceRecord = JSON.parse(e.newValue);
          if (parsed?.work_date === today) {
            setTodayAttendance(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ── Punch In ──
  const punchIn = useCallback(
    async (params: {
      latitude: number;
      longitude: number;
      locationName?: string;
      notes?: string;
    }): Promise<AttendanceRecord> => {
      if (!user) throw new Error('Not authenticated');
      setIsSubmitting(true);
      try {
        const rec = await attendanceApi.checkIn({
          user,
          latitude: params.latitude,
          longitude: params.longitude,
          locationName: params.locationName,
          notes: params.notes,
        });
        setTodayAttendance(rec);
        return rec;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user]
  );

  // ── Punch Out ──
  const punchOut = useCallback(
    async (params: { notes?: string; endLocation?: string }): Promise<AttendanceRecord> => {
      if (!user || !todayAttendance) throw new Error('Not punched in');
      setIsSubmitting(true);
      try {
        const rec = await attendanceApi.checkOut({
          user,
          todayAttendance,
          notes: params.notes,
          endLocation: params.endLocation,
        });
        setTodayAttendance(rec);
        return rec;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, todayAttendance]
  );

  // ── Reset (for testing) ──
  const resetPunch = useCallback(async () => {
    await attendanceApi.resetTodayPunch(user);
    setTodayAttendance(null);
  }, [user]);

  const isPunchedIn = Boolean(todayAttendance?.check_in_time);
  const isPunchedOut = Boolean(todayAttendance?.check_out_time);

  return (
    <AttendanceContext.Provider
      value={{
        todayAttendance,
        isSubmitting,
        isPunchedIn,
        isPunchedOut,
        punchIn,
        punchOut,
        refresh,
        resetPunch,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = (): AttendanceContextType => {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error('useAttendance must be used inside <AttendanceProvider>');
  }
  return ctx;
};
