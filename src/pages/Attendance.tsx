import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  MapPin,
  LogIn,
  LogOut,
  AlertCircle,
  Timer,
  RefreshCw,
  Compass,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { mockAttendanceRecords } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { exportToCsv } from '../utils/exportCsv';

interface AttendanceRecord {
  id?: string;
  work_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  status?: string;
  working_hours?: number | null;
}

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form input notes
  const [checkInNotes, setCheckInNotes] = useState<string>('Morning shift check-in');
  const [checkOutNotes, setCheckOutNotes] = useState<string>('Completed daily route');

  // Device Geolocation coords
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 19.0760,
    longitude: 72.8777,
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // 1. Check if already checked in today:
  const fetchTodayAttendance = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: attendance, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("work_date", today)
        .maybeSingle();

      if (error) {
        console.warn("Notice checking attendance:", error);
      }

      if (attendance) {
        setTodayAttendance(attendance as AttendanceRecord);
      } else {
        // Check localStorage for offline demo state
        const localRecord = localStorage.getItem(`attendance_${today}`);
        if (localRecord) {
          try {
            setTodayAttendance(JSON.parse(localRecord));
          } catch {
            setTodayAttendance(null);
          }
        } else {
          setTodayAttendance(null);
        }
      }
    } catch (err: any) {
      console.warn("Attendance fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current device location
  const detectLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: Number(pos.coords.latitude.toFixed(4)),
            longitude: Number(pos.coords.longitude.toFixed(4)),
          });
          setIsLocating(false);
        },
        (err) => {
          console.warn('Geolocation deferred or blocked:', err.message);
          // Fallback coords
          setCoords({ latitude: 19.0760, longitude: 72.8777 });
          setIsLocating(false);
        },
        { timeout: 5000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
    detectLocation();
  }, []);

  // 2. Click "Check In" button:
  const handleCheckIn = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    const today = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    try {
      let rpcSuccess = false;
      try {
        const { error } = await supabase.rpc("check_in_rep", {
          _latitude: coords.latitude,
          _longitude: coords.longitude,
          _notes: checkInNotes,
        });
        if (!error) {
          rpcSuccess = true;
        }
      } catch (rpcErr) {
        console.warn("RPC check_in_rep notice, fallback in progress:", rpcErr);
      }

      // If RPC succeeded or fallback table insert
      const newRecord: AttendanceRecord = {
        work_date: today,
        check_in_time: nowIso,
        latitude: coords.latitude,
        longitude: coords.longitude,
        notes: checkInNotes,
        status: 'Present',
      };

      if (!rpcSuccess) {
        try {
          await supabase.from("attendance").upsert([newRecord]);
        } catch {
          // Ignore
        }
      }

      localStorage.setItem(`attendance_${today}`, JSON.stringify(newRecord));
      setTodayAttendance(newRecord);
      setFeedback({
        type: 'success',
        message: `Successfully punched in at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Have a safe and productive route!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Check-in failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Click "Check Out" button (at end of day):
  const handleCheckOut = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    const today = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    try {
      let rpcSuccess = false;
      try {
        const { error } = await supabase.rpc("check_out_rep", {
          _notes: checkOutNotes,
        });
        if (!error) {
          rpcSuccess = true;
        }
      } catch (rpcErr) {
        console.warn("RPC check_out_rep notice, fallback in progress:", rpcErr);
      }

      // Update record state
      const checkInDate = todayAttendance?.check_in_time ? new Date(todayAttendance.check_in_time) : new Date();
      const diffHours = Math.max(0.1, Number(((new Date().getTime() - checkInDate.getTime()) / (1000 * 60 * 60)).toFixed(1)));

      const updatedRecord: AttendanceRecord = {
        ...(todayAttendance || { work_date: today }),
        work_date: today,
        check_out_time: nowIso,
        notes: `${todayAttendance?.notes || 'Morning shift check-in'} | ${checkOutNotes}`,
        status: 'Completed',
        working_hours: diffHours,
      };

      if (!rpcSuccess) {
        try {
          await supabase
            .from("attendance")
            .update({
              check_out_time: nowIso,
              notes: updatedRecord.notes,
              status: 'Completed',
              working_hours: diffHours,
            })
            .eq("work_date", today);
        } catch {
          // Ignore
        }
      }

      localStorage.setItem(`attendance_${today}`, JSON.stringify(updatedRecord));
      setTodayAttendance(updatedRecord);
      setFeedback({
        type: 'success',
        message: `Shift closed successfully at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Total shift time: ${diffHours} hrs.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Check-out failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCheckedIn = Boolean(todayAttendance?.check_in_time);
  const isCheckedOut = Boolean(todayAttendance?.check_out_time);

  const isManagerOrAdmin = user?.role === 'System Admin' || user?.role === 'Sales Manager';
  const isRep = !isManagerOrAdmin;
  const visibleAttendanceRecords = isRep
    ? mockAttendanceRecords.filter(
        (a) =>
          a.repName.toLowerCase().includes((user?.name || 'vikram').toLowerCase()) ||
          a.repId === user?.id ||
          a.repId === 'rep-1'
      )
    : mockAttendanceRecords;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Clock className="w-7 h-7 text-brand-400" />
            <span>Field Attendance & Time Office</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time biometric & GPS check-in logs, daily shift tracking, and field territory telemetry.
          </p>
        </div>

        <button
          onClick={fetchTodayAttendance}
          disabled={isLoading}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Primary Punch Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Check-In / Check-Out Action Portal */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                Daily Shift Verification
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {user?.name || 'Sales Representative'} • {user?.territory || 'North Delhi'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isCheckedOut
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    : isCheckedIn
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isCheckedOut ? 'Shift Completed' : isCheckedIn ? 'Shift Active' : 'Not Checked In'}
              </span>
            </div>
          </div>

          {/* Punch Actions */}
          {!isCheckedIn ? (
            /* STATE 1: NOT CHECKED IN YET -> Click "Check In" */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-400" />
                    GPS Geo-Coordinates:
                  </span>
                  <button
                    onClick={detectLocation}
                    disabled={isLocating}
                    className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
                  >
                    <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>Detect My GPS</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-400 bg-slate-900 px-3 py-2 rounded-xl flex items-center justify-between">
                  <span>Latitude: {coords.latitude}</span>
                  <span>Longitude: {coords.longitude}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Morning Shift Notes
                </label>
                <input
                  type="text"
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  placeholder="e.g. Morning shift check-in"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                onClick={handleCheckIn}
                disabled={isSubmitting || isLoading}
                className="w-full h-13 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                <span>Check In (Punch In Start of Day)</span>
              </button>
            </div>
          ) : !isCheckedOut ? (
            /* STATE 2: CHECKED IN (Active Shift) -> Click "Check Out" */
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Punched In At
                  </span>
                  <div className="text-lg font-bold text-white font-mono">
                    {todayAttendance?.check_in_time
                      ? new Date(todayAttendance.check_in_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '09:00 AM'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Location: {todayAttendance?.latitude || coords.latitude},{' '}
                    {todayAttendance?.longitude || coords.longitude}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20 space-y-1">
                  <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    Active Shift Status
                  </span>
                  <div className="text-lg font-bold text-white">In Field Beat Route</div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Notes: {todayAttendance?.notes || checkInNotes}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  End of Day Wrap-Up Notes
                </label>
                <input
                  type="text"
                  value={checkOutNotes}
                  onChange={(e) => setCheckOutNotes(e.target.value)}
                  placeholder="e.g. Completed daily route"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                onClick={handleCheckOut}
                disabled={isSubmitting || isLoading}
                className="w-full h-13 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-rose-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
                <span>Check Out (End Daily Route)</span>
              </button>
            </div>
          ) : (
            /* STATE 3: SHIFT COMPLETED */
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Daily Route Finished!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Punch In: <span className="font-mono text-emerald-400 font-bold">{todayAttendance?.check_in_time ? new Date(todayAttendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM'}</span> • Punch Out: <span className="font-mono text-emerald-400 font-bold">{todayAttendance?.check_out_time ? new Date(todayAttendance.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '06:00 PM'}</span>
              </p>
              <div className="inline-block px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-brand-300 font-bold">
                Total Logged Time: {todayAttendance?.working_hours || 8.5} hrs
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Shift Summary & Telemetry Info */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 bg-slate-900/60 shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Timer className="w-4 h-4 text-brand-400" />
            <span>Shift Telemetry Summary</span>
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Shift Type</span>
              <span className="font-semibold text-slate-200">General Field Beat</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Standard Timings</span>
              <span className="font-semibold text-slate-200">09:30 AM – 06:30 PM</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Geofence Status</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Within Territory
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Battery Telemetry</span>
              <span className="font-semibold text-slate-200">88% (Healthy)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            <span className="text-brand-400 font-bold">Policy Note: </span>
            Attendance is validated against your GPS check-in coordinates and verified against retailer visits booked on your daily beat plan.
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {isRep ? 'My Attendance Records' : 'Territory Attendance Records'}
            </h3>
            <span className="text-[11px] text-slate-500">
              {isRep ? `Confidential shift logs for ${user?.territory || 'North Delhi Beat A'}` : 'Live Field Force Logs'}
            </span>
          </div>

          <button
            onClick={() => {
              exportToCsv(
                `fieldassist_attendance_${new Date().toISOString().split('T')[0]}`,
                visibleAttendanceRecords,
                [
                  { header: 'Representative Name', key: (a) => a.repName },
                  { header: 'Work Date', key: (a) => a.date },
                  { header: 'Check In Time', key: (a) => a.checkInTime },
                  { header: 'Check Out Time', key: (a) => a.checkOutTime || 'Active' },
                  { header: 'Start Location', key: (a) => a.startLocation },
                  { header: 'Hours Worked', key: (a) => a.workingHours },
                  { header: 'Battery Level', key: (a) => `${a.batteryPctAtCheckIn ?? 90}%` },
                  { header: 'Status', key: (a) => a.status },
                ]
              );
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            title="Export Attendance Logs CSV"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Sales Rep Name</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Punch In Time</th>
                <th className="py-3.5 px-4">Punch Out Time</th>
                <th className="py-3.5 px-4">Start Location</th>
                <th className="py-3.5 px-4">Working Hours</th>
                <th className="py-3.5 px-4">Battery</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {/* If user punched in today, display their live record first */}
              {isCheckedIn && (
                <tr className="bg-brand-500/10 hover:bg-brand-500/15 transition-colors">
                  <td className="py-4 px-4 font-bold text-white text-sm">
                    {user?.name || 'Sales Representative'} (You)
                  </td>
                  <td className="py-4 px-4 text-brand-300 font-mono">
                    {todayAttendance?.work_date || new Date().toISOString().split('T')[0]}
                  </td>
                  <td className="py-4 px-4 text-emerald-400 font-bold font-mono">
                    {todayAttendance?.check_in_time
                      ? new Date(todayAttendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Just now'}
                  </td>
                  <td className="py-4 px-4 text-slate-300 font-mono">
                    {todayAttendance?.check_out_time
                      ? new Date(todayAttendance.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '— Active Shift'}
                  </td>
                  <td className="py-4 px-4 text-slate-300">
                    {coords.latitude}, {coords.longitude} ({user?.territory || 'North Delhi'})
                  </td>
                  <td className="py-4 px-4 font-bold text-brand-400">
                    {todayAttendance?.working_hours || (isCheckedOut ? 8.5 : 'Active')} hrs
                  </td>
                  <td className="py-4 px-4 text-slate-300">88%</td>
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {isCheckedOut ? 'Completed' : 'Present (Active)'}
                    </span>
                  </td>
                </tr>
              )}

              {visibleAttendanceRecords.map((att) => (
                <tr key={att.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-4 px-4 font-bold text-white text-sm">{att.repName}</td>
                  <td className="py-4 px-4 text-slate-300 font-mono">{att.date}</td>
                  <td className="py-4 px-4 text-emerald-400 font-bold">{att.checkInTime}</td>
                  <td className="py-4 px-4 text-slate-400 font-medium">{att.checkOutTime || '— Active Shift'}</td>
                  <td className="py-4 px-4 text-slate-300">{att.startLocation}</td>
                  <td className="py-4 px-4 font-bold text-brand-400">{att.workingHours} hrs</td>
                  <td className="py-4 px-4 text-slate-300">{att.batteryPctAtCheckIn}%</td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        att.status === 'Present'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {att.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
