import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Map, LayoutGrid, X, CheckCircle2, Calendar, User, Navigation, Clock } from 'lucide-react';
import { mockBeatPlans } from '../data/mockData';
import { BeatPlanningMap } from '@/components/maps/BeatPlanningMap';
import { useAuth } from '../context/AuthContext';
import { isUnderManagerTerritory } from '../utils/territory';
import { acquireLiveLocation } from '../utils/geolocation';
import type { BeatPlan } from '../types';

export const BeatPlans: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Sales Manager';
  const isRep = user?.role === 'Sales Representative';

  const [beatPlansList, setBeatPlansList] = useState<BeatPlan[]>(() => {
    const saved = localStorage.getItem('fieldassist_beat_plans');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockBeatPlans;
  });

  // Acquire device's real live coordinates
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    city?: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('fieldassist_user_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return {
            latitude: parsed.lat,
            longitude: parsed.lng,
            accuracy: parsed.accuracy || 20,
            city: parsed.city || 'Bengaluru South',
          };
        }
      }
    } catch {}
    return {
      latitude: 12.9298,
      longitude: 77.5832,
      accuracy: 25,
      city: 'Bengaluru South (Jayanagar 4th Block)',
    };
  });

  useEffect(() => {
    acquireLiveLocation(
      (loc) => {
        setUserCoords({
          latitude: loc.lat,
          longitude: loc.lng,
          accuracy: loc.accuracy,
          city: loc.city,
        });
      },
      () => {}
    );
  }, []);

  // Territory governance: Sales Manager sees beats under their territory, Sales Rep sees their assigned beats
  const visibleBeats = useMemo(() => {
    let list = beatPlansList;
    if (isRep) {
      const isVikram = user?.email === 'vikram@fieldassist.io' || user?.email === 'vikram.s@fieldassist.io';
      let userBeats = isVikram
        ? list.filter((b) => b.repName.toLowerCase().includes('vikram') || b.repId === 'rep-1')
        : list.filter(
            (b) =>
              (user?.name && b.repName.toLowerCase() === user.name.toLowerCase()) ||
              (user?.id && b.repId === user.id) ||
              (user?.email && b.repId.includes(user.email.split('@')[0]))
          );

      // If a representative does not have an assigned beat yet, automatically synthesize their assigned beat route!
      if (userBeats.length === 0 && user?.name) {
        const synthesizedBeat: BeatPlan = {
          id: `beat-assigned-${user.id || user.name.replace(/\s+/g, '-').toLowerCase()}`,
          beatName: `${user.territory || 'Bengaluru South'} - Assigned Daily Beat Route`,
          code: `BEAT-${(user.territory || 'BLR').slice(0, 3).toUpperCase()}-01`,
          territory: user.territory || 'Bengaluru South',
          repId: user.id || 'rep-my-id',
          repName: user.name,
          retailersCount: 16,
          scheduledDay: 'Monday',
          estimatedDistanceKm: 18.5,
          estimatedVisitsDurationHours: 6.5,
          completionPct: 25,
          status: 'Active',
        };
        userBeats = [synthesizedBeat];
      }
      return userBeats;
    }

    if (isManager) {
      return list.filter((b) => isUnderManagerTerritory(user, { territory: b.territory }));
    }

    return list;
  }, [beatPlansList, isRep, isManager, user]);

  const [selectedBeatId, setSelectedBeatId] = useState<string>(() => {
    return visibleBeats[0]?.id || beatPlansList[0]?.id || 'beat-01';
  });

  useEffect(() => {
    if (visibleBeats.length > 0) {
      if (!selectedBeatId || !visibleBeats.some((b) => b.id === selectedBeatId)) {
        setSelectedBeatId(visibleBeats[0].id);
      }
    }
  }, [visibleBeats, selectedBeatId]);

  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Beat Form fields
  const [beatName, setBeatName] = useState('');
  const [beatCode, setBeatCode] = useState('');
  const [repName, setRepName] = useState(user?.name || 'Vikram Sharma');
  const [territory, setTerritory] = useState(user?.territory || 'Bengaluru South');
  const [scheduledDay, setScheduledDay] = useState<
    'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  >('Monday');
  const [retailersCount, setRetailersCount] = useState(16);
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState(15.5);
  const [estimatedDurationHours, setEstimatedDurationHours] = useState(6.0);

  const handleOpenCreateModal = () => {
    const nextNumber = beatPlansList.length + 1;
    setBeatCode(`BEAT-BLR-${String(nextNumber).padStart(2, '0')}`);
    setBeatName('');
    setRepName(user?.name || 'Vikram Sharma');
    setTerritory(user?.territory || 'Bengaluru South');
    setShowCreateModal(true);
  };

  const handleCreateBeat = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = beatCode.trim() || `BEAT-DEL-${String(beatPlansList.length + 1).padStart(2, '0')}`;
    const finalName = beatName.trim() || `${territory} ${scheduledDay} Beat Route`;

    const newBeat: BeatPlan = {
      id: `beat-${Date.now()}`,
      beatName: finalName,
      code: finalCode,
      territory,
      repId: user?.id || `rep-${Date.now()}`,
      repName,
      retailersCount: Number(retailersCount) || 12,
      scheduledDay,
      estimatedDistanceKm: Number(estimatedDistanceKm) || 15.0,
      estimatedVisitsDurationHours: Number(estimatedDurationHours) || 6.0,
      completionPct: 0,
      status: 'Active',
    };

    const updated = [newBeat, ...beatPlansList];
    setBeatPlansList(updated);
    localStorage.setItem('fieldassist_beat_plans', JSON.stringify(updated));
    setSelectedBeatId(newBeat.id);
    setShowCreateModal(false);

    setToastMessage(`Beat Plan "${finalName}" (${finalCode}) successfully created!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-xs font-semibold shadow-xl"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <MapPin className="w-7 h-7 text-brand-400" />
            <span>Beat Plans & Route Optimization</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Weekly beat schedules, stop sequences, mileage optimization, and completion status.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid View</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Beat Plan</span>
          </button>
        </div>
      </div>

      {/* Interactive GPS Beat Planning Map View */}
      {viewMode === 'map' && (
        <BeatPlanningMap
          selectedBeatId={selectedBeatId}
          onSelectBeat={(id) => setSelectedBeatId(id)}
          beats={visibleBeats}
          user={user}
          userCoords={userCoords}
        />
      )}

      {/* Beat Plans Grid */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Active Beat Schedules ({visibleBeats.length})
          </h2>
          <button
            onClick={handleOpenCreateModal}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Beat Plan</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleBeats.map((beat) => {
            const isSelected = selectedBeatId === beat.id;

            return (
              <div
                key={beat.id}
                onClick={() => {
                  setSelectedBeatId(beat.id);
                  if (viewMode !== 'map') setViewMode('map');
                }}
                className={`glass-card glass-card-hover p-6 rounded-2xl space-y-5 border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-brand-500 shadow-lg shadow-brand-500/20 bg-slate-900/90'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-brand-400">{beat.code}</span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      beat.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {beat.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white line-clamp-1">{beat.beatName}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {beat.territory} • {beat.scheduledDay} Schedule
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Beat Completion</span>
                    <span className="font-bold text-white">{beat.completionPct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-500 h-full rounded-full transition-all"
                      style={{ width: `${beat.completionPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Outlets</span>
                    <span className="font-bold text-white">{beat.retailersCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Est. Dist</span>
                    <span className="font-bold text-white">{beat.estimatedDistanceKm} km</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Duration</span>
                    <span className="font-bold text-white">
                      {beat.estimatedVisitsDurationHours} hrs
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Assigned Rep: <strong className="text-slate-200">{beat.repName}</strong>
                  </span>
                  <span className="text-brand-400 text-[11px] font-semibold">View Map →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Create New Beat Plan */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Create New Beat Plan</h2>
                    <p className="text-xs text-slate-400">Schedule GPS-optimized route for field representatives</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBeat} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">Beat Plan Name *</label>
                    <input
                      type="text"
                      required
                      value={beatName}
                      onChange={(e) => setBeatName(e.target.value)}
                      placeholder="e.g. Jayanagar & JP Nagar Retail Loop"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Beat Code *</label>
                    <input
                      type="text"
                      required
                      value={beatCode}
                      onChange={(e) => setBeatCode(e.target.value)}
                      placeholder="BEAT-BLR-05"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-brand-400" />
                      <span>Assigned Rep *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-400" />
                      <span>Scheduled Day *</span>
                    </label>
                    <select
                      value={scheduledDay}
                      onChange={(e) => setScheduledDay(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Territory Coverage</label>
                    <select
                      value={territory}
                      onChange={(e) => setTerritory(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="Bengaluru South">Bengaluru South</option>
                      <option value="Bengaluru Central">Bengaluru Central</option>
                      <option value="Bengaluru East">Bengaluru East</option>
                      <option value="Bengaluru West">Bengaluru West</option>
                      <option value="Bengaluru North">Bengaluru North</option>
                      <option value="Mumbai South">Mumbai South</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Kolkata Central">Kolkata Central</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Retail Outlets Count</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={retailersCount}
                      onChange={(e) => setRetailersCount(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-brand-400" />
                      <span>Estimated Distance (km)</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={estimatedDistanceKm}
                      onChange={(e) => setEstimatedDistanceKm(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-brand-400" />
                      <span>Estimated Duration (Hours)</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      max={14}
                      value={estimatedDurationHours}
                      onChange={(e) => setEstimatedDurationHours(Number(e.target.value))}
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save & Deploy Beat Plan</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BeatPlans;
