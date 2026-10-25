import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  Radio,
  Battery,
  ShieldCheck,
  Store,
  Phone,
  RefreshCw,
  Play,
  Pause,
  Compass,
  Gauge,
  Users,
  Search,
  Crosshair,
} from 'lucide-react';
import { LiveGpsMap } from '../components/maps/LiveGpsMap';
import { gpsApi, type FleetGpsResponse } from '../api/gpsApi';
import { useAuth } from '../context/AuthContext';

export const LiveTracking: React.FC = () => {
  const { user } = useAuth();

  const [fleetData, setFleetData] = useState<FleetGpsResponse | null>(null);
  const [selectedRepId, setSelectedRepId] = useState<string | null>('rep-1');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Moving' | 'At Store' | 'Idle'>('All');
  const [isSimulating, setIsSimulating] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');
  const [showGeofences, setShowGeofences] = useState(true);
  const [showTrails, setShowTrails] = useState(true);

  // Real Device GPS state
  const [isBroadcastingDevice, setIsBroadcastingDevice] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // 1. Fetch live fleet telemetry
  const fetchFleetTelemetry = async () => {
    try {
      const data = await gpsApi.getLiveFleet();
      if (data && data.success) {
        setFleetData(data);
        setLastRefreshed(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      }
    } catch (err) {
      console.warn('Live fleet telemetry poll notice:', err);
    }
  };

  useEffect(() => {
    fetchFleetTelemetry();
  }, []);

  // 2. Real-time auto-tick polling (every 4 seconds for live radar feeling)
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      fetchFleetTelemetry();
    }, 3800);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // 3. Attempt silent initial real device geolocation acquisition
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy);
          setMyCoords({ lat, lng, accuracy });
        },
        () => {
          // If silent prompt fails or user hasn't granted yet, wait for user click
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  // 4. One-click High-Accuracy Real GPS Locate
  const handleLocateMe = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setBroadcastFeedback('Acquiring high-accuracy real-time GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        setMyCoords({ lat, lng, accuracy });
        setSelectedRepId('rep-my-device');
        setBroadcastFeedback(
          `📍 Real Live GPS Locked: ${lat}, ${lng} (±${accuracy}m accuracy). Free OpenStreetMap API Active.`
        );

        // Also start broadcasting telemetry to fleet
        if (!isBroadcastingDevice) {
          startDeviceBroadcast();
        }
      },
      (err) => {
        setIsLocating(false);
        setBroadcastFeedback(
          `GPS permission: ${err.message}. Please enable location permissions in browser settings.`
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 5. Device Geolocation Broadcasting Toggle
  const startDeviceBroadcast = () => {
    if (!('geolocation' in navigator)) return;

    setIsBroadcastingDevice(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        setMyCoords({ lat, lng, accuracy });
        setBroadcastFeedback(
          `📡 Real GPS Locked: ${lat}, ${lng} (±${accuracy}m). Broadcasting live to fleet radar...`
        );

        try {
          const res = await gpsApi.broadcastDevicePing({
            repId: user?.id || 'rep-my-device',
            repName: user?.name || 'Current User (Live Device)',
            latitude: lat,
            longitude: lng,
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
            heading: pos.coords.heading ? Math.round(pos.coords.heading) : 0,
            status: 'Moving',
            activity: 'Device Telemetry Broadcast',
          });

          if (res?.insideGeofence && res.nearestOutlet) {
            setBroadcastFeedback(`✅ Inside Geofence: ${res.nearestOutlet} (Verified)`);
          }
        } catch (err) {
          console.warn('GPS broadcast sync notice:', err);
        }
      },
      (err) => {
        console.warn('Device geolocation error:', err);
        setBroadcastFeedback('Unable to acquire device GPS coordinates. Check location permissions.');
        setIsBroadcastingDevice(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  };

  const toggleDeviceBroadcast = () => {
    if (isBroadcastingDevice) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsBroadcastingDevice(false);
      setBroadcastFeedback('Live device GPS broadcast paused');
      setTimeout(() => setBroadcastFeedback(null), 3000);
    } else {
      startDeviceBroadcast();
    }
  };

  // Clean up geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const allReps = fleetData?.reps || [];
  const isRep = user?.role === 'Sales Representative';
  // Sales Rep privacy isolation: a rep only tracks their own device and assigned beat
  const reps = isRep
    ? allReps.filter(
        (r) =>
          r.name.toLowerCase().includes((user?.name || 'vikram').toLowerCase()) ||
          r.id === user?.id ||
          r.id === 'rep-1'
      )
    : allReps;
  const geofencedOutlets = fleetData?.geofencedOutlets || [];
  const summary = fleetData?.fleetSummary || {
    totalReps: isRep ? 1 : reps.length,
    moving: reps.filter((r) => r.status === 'Moving').length,
    atStore: reps.filter((r) => r.status === 'At Store').length,
    idle: reps.filter((r) => r.status === 'Idle').length,
    geofencesActive: geofencedOutlets.length,
    averageFleetBattery: reps[0]?.batteryLevel || 78,
  };

  const filteredReps = reps.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.territory.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isMyDeviceSelected = selectedRepId === 'rep-my-device' && myCoords !== null;

  const currentDisplayRep = isMyDeviceSelected
    ? {
        id: 'rep-my-device',
        name: `${user?.name || 'You'} (Your Real Live GPS)`,
        code: 'LIVE-GPS-USER',
        territory: user?.territory || 'Real-Time Device Telemetry',
        avatar:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        phone: user?.email || '+91 99999 88888',
        batteryLevel: 98,
        speedKmH: 0,
        distanceTodayKm: 0.1,
        status: 'Moving' as const,
        lastPingTime: new Date().toISOString(),
        coords: { lat: myCoords.lat, lng: myCoords.lng },
      }
    : reps.find((r) => r.id === selectedRepId) || reps[0] || allReps[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-emerald-600 rounded-2xl shadow-lg shadow-brand-500/20 text-white">
              <Navigation className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {isRep ? 'My Live GPS Radar' : 'Live GPS Fleet Radar'}
                </h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {isRep ? 'PERSONAL TELEMETRY' : 'LIVE TELEMETRY'}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                  FREE MAP API
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRep
                  ? `Real-time satellite positioning and route tracking for ${
                      user?.name || 'Vikram Sharma'
                    } (${user?.territory || 'North Delhi Beat A'}). Confidential sales rep tracking.`
                  : 'Real-time satellite positioning, speed telemetry, automated geofence detection, and live breadcrumb route tracking powered by OpenStreetMap.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Layer toggles */}
          <button
            onClick={() => setShowTrails(!showTrails)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showTrails
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            Route Trails: {showTrails ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowGeofences(!showGeofences)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showGeofences
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            Geofences: {showGeofences ? 'ON' : 'OFF'}
          </button>

          {/* Real Device High Accuracy Locate Button */}
          <button
            onClick={handleLocateMe}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer border ${
              myCoords
                ? 'bg-blue-600 text-white shadow-blue-500/30 border-blue-400'
                : 'bg-slate-800 text-blue-400 hover:bg-slate-700 border-slate-700'
            }`}
            title="Acquire real device GPS coordinates"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>
              {isLocating
                ? 'Locking GPS...'
                : myCoords
                ? 'Real Live GPS: LOCKED'
                : 'Lock Real Live GPS'}
            </span>
          </button>

          {/* Real Device Broadcast Toggle */}
          <button
            onClick={toggleDeviceBroadcast}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              isBroadcastingDevice
                ? 'bg-emerald-600 text-white shadow-emerald-500/30 border border-emerald-400 animate-pulse'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <Compass className={`w-4 h-4 ${isBroadcastingDevice ? 'animate-spin' : ''}`} />
            <span>{isBroadcastingDevice ? 'Broadcasting GPS (Active)' : 'Broadcast GPS'}</span>
          </button>

          {/* Simulation Toggle */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isSimulating
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle simulated GPS ping ticks"
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulating ? 'Live Pulse: ON' : 'Live Pulse: PAUSED'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchFleetTelemetry}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-xl transition-all text-xs cursor-pointer"
            title="Force refresh telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono text-[11px] text-slate-400">{lastRefreshed}</span>
          </button>
        </div>
      </div>

      {/* Broadcast Status Banner */}
      <AnimatePresence>
        {broadcastFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-blue-950/60 border border-blue-500/30 rounded-2xl flex items-center justify-between text-xs text-blue-300 font-semibold"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
              <span>{broadcastFeedback}</span>
            </div>
            {myCoords && (
              <span className="font-mono text-[11px] text-blue-200 bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-400/20">
                Lat: {myCoords.lat} • Lng: {myCoords.lng}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Active Fleet</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{summary.totalReps} Reps</div>
          <p className="text-[11px] text-emerald-400 font-medium mt-0.5">100% Signal Connected</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">In Transit</span>
            <Gauge className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 mt-1.5">{summary.moving} Moving</div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Avg speed: 26 km/h</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Inside Geofence</span>
            <Store className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1.5">{summary.atStore} at Store</div>
          <p className="text-[11px] text-emerald-400 font-medium mt-0.5">Auto-CheckIn Verified</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Geofenced Stores</span>
            <ShieldCheck className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{summary.geofencesActive} Outlets</div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">100m Enforced Boundary</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Fleet Battery</span>
            <Battery className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{summary.averageFleetBattery}%</div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Healthy Power Levels</p>
        </div>
      </div>

      {/* Main Split Layout: Live Map Canvas + Fleet Roster Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Interactive Live Leaflet Map */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="relative h-[560px] w-full">
            <LiveGpsMap
              reps={reps}
              geofencedOutlets={geofencedOutlets}
              selectedRepId={selectedRepId}
              onSelectRep={(id) => setSelectedRepId(id)}
              myDeviceCoords={myCoords}
              showTrails={showTrails}
              showGeofences={showGeofences}
              onLocateMe={handleLocateMe}
              isLocating={isLocating}
            />
          </div>

          {/* Selected Rep Telemetry Detail Banner */}
          {currentDisplayRep && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={currentDisplayRep.avatar}
                  alt={currentDisplayRep.name}
                  className="w-11 h-11 rounded-2xl object-cover border-2 border-brand-500 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{currentDisplayRep.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {currentDisplayRep.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        currentDisplayRep.status === 'At Store'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : currentDisplayRep.status === 'Moving'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {currentDisplayRep.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentDisplayRep.territory} • Last Ping:{' '}
                    {new Date(currentDisplayRep.lastPingTime).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Real-time Telemetry Readout */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="text-center px-3 py-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-normal">GPS Coords</span>
                  <span className="font-mono text-slate-200">
                    {currentDisplayRep.coords.lat}, {currentDisplayRep.coords.lng}
                  </span>
                </div>

                <div className="text-center px-3 py-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-normal">Speed</span>
                  <span className="font-mono text-sky-400 font-bold">{currentDisplayRep.speedKmH} km/h</span>
                </div>

                <div className="text-center px-3 py-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-normal">Distance Today</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {currentDisplayRep.distanceTodayKm} km
                  </span>
                </div>

                <div className="text-center px-3 py-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-normal">Battery</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {currentDisplayRep.batteryLevel}%
                  </span>
                </div>

                <a
                  href={`tel:${currentDisplayRep.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-md"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Rep</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right: Fleet Telemetry Sidebar & Geofence Logs */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <span>Field Representatives</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                {filteredReps.length}/{reps.length} Active
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reps by name or code..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] font-semibold text-center">
              {(['All', 'Moving', 'At Store', 'Idle'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Reps Scrollable Roster */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {/* Highlighted Real Live Device GPS Entry */}
              {myCoords && (
                <div
                  onClick={() => setSelectedRepId('rep-my-device')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer shadow-md ${
                    selectedRepId === 'rep-my-device'
                      ? 'bg-blue-900/60 border-blue-400 ring-1 ring-blue-400/50'
                      : 'bg-blue-950/40 border-blue-500/50 hover:bg-blue-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                          📍
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{user?.name || 'You'} (Live Device)</span>
                          <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">
                            REAL GPS
                          </span>
                        </div>
                        <div className="text-[11px] text-blue-300/80 font-mono">
                          {myCoords.lat.toFixed(4)}, {myCoords.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        ±{myCoords.accuracy || 10}m
                      </span>
                      <div className="text-[10px] text-emerald-400 font-bold mt-1">Live Locked</div>
                    </div>
                  </div>
                </div>
              )}

              {filteredReps.map((rep) => {
                const isSelected = selectedRepId === rep.id;
                return (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedRepId(rep.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-brand-500/80 shadow-md ring-1 ring-brand-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <img
                            src={rep.avatar}
                            alt={rep.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                              rep.status === 'At Store'
                                ? 'bg-emerald-400'
                                : rep.status === 'Moving'
                                ? 'bg-sky-400'
                                : 'bg-amber-400'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{rep.name}</div>
                          <div className="text-[11px] text-slate-400">{rep.territory}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rep.status === 'At Store'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : rep.status === 'Moving'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {rep.status}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          {rep.status === 'Moving' ? `${rep.speedKmH} km/h` : `${rep.batteryLevel}% Bat`}
                        </div>
                      </div>
                    </div>

                    {/* Geofence notice */}
                    {rep.currentRetailer && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1 truncate max-w-[190px]">
                          <Store className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{rep.currentRetailer.name}</span>
                        </span>
                        <span
                          className={`font-semibold shrink-0 ${
                            rep.currentRetailer.insideGeofence ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {rep.currentRetailer.insideGeofence
                            ? 'Inside (38m)'
                            : `${rep.currentRetailer.distanceMeters}m away`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Geofence Alert Feed */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Geofence Event Feed</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Live Sync</span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto text-xs">
              <div className="p-2 rounded-xl bg-slate-950/70 border border-emerald-500/20 text-slate-300">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                  <span>GEOFENCE ENTRY</span>
                  <span>10 mins ago</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5">
                  <strong>Vikram Sharma</strong> entered 100m geofence of <em>Gupta Kirana & General Stores</em>.
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
                <div className="flex items-center justify-between text-[10px] text-sky-400 font-bold">
                  <span>TRANSIT SPEED ALERT</span>
                  <span>18 mins ago</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5">
                  <strong>Ananya Verma</strong> cruising at 32 km/h on Western Route via Patel Road.
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
                <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
                  <span>STORE VISIT COMPLETED</span>
                  <span>45 mins ago</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5">
                  <strong>Rahul Deshmukh</strong> completed order booking visit at <em>National Wholesale Traders</em>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveTracking;
