/**
 * AttendanceContext — Global session-level punch-in/out state manager.
 *
 * Problem this solves:
 *   The Attendance page component unmounts when users navigate away and remounts
 *   on return, resetting all local useState. Even though data is written to
 *   localStorage, the async Supabase re-fetch on remount could momentarily
 *   show "Not Checked In" before resolving. More importantly, any page that
 *   wants to know if the user is currently punched in must duplicate the
 *   localStorage read logic.
 *
 * Solution:
 *   This context lives at the App root (never unmounts) and owns the
 *   authoritative `todayAttendance` state. It pre-loads synchronously from
 *   localStorage on mount so there is ZERO flash of incorrect state. All
 *   pages that need punch state import this context instead of reading
 *   localStorage themselves.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
  const { user } = useAuth();

  // ── Synchronous initializer: reads localStorage immediately (zero flash) ──
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(() => {
    return attendanceApi.getCachedTodayAttendance(null); // initial read without user (before auth)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Re-read from cache when user is known, then verify with Supabase ──
  const refresh = useCallback(async () => {
    if (!user) return;

    // 1. Synchronous cache read first (zero delay)
    const cached = attendanceApi.getCachedTodayAttendance(user);
    if (cached) {
      setTodayAttendance(cached);
    }

    // 2. Async Supabase verification
    try {
      const verified = await attendanceApi.getTodayAttendance(user);
      if (verified) {
        setTodayAttendance(verified);
      } else if (!cached) {
        setTodayAttendance(null);
      }
    } catch {
      // Keep cached value on network failure — do NOT reset to null
    }
  }, [user]);

  // Run once when user is determined (login) and whenever user changes
  useEffect(() => {
    if (!user) return;

    // Immediately load from cache for instant display
    const cached = attendanceApi.getCachedTodayAttendance(user);
    if (cached) {
      setTodayAttendance(cached);
    }

    // Then verify in background (don't await — no blocking)
    refresh();
  }, [user?.id]); // Only re-run when user identity changes, NOT on every render

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
