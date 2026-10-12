import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  Compass,
  CheckCircle2,
  Store,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  ShieldCheck,
  Layers,
} from 'lucide-react';

interface Waypoint {
  id: string;
  sequence: number;
  name: string;
  owner: string;
  address: string;
  phone: string;
  type: string;
  x: number; // Percentage coordinate on map (0 - 100)
  y: number;
  status: 'Visited' | 'In Progress' | 'Scheduled';
  checkInTime?: string;
  orderAmount?: number;
}

interface BeatRoute {
  id: string;
  code: string;
  name: string;
  territory: string;
  repName: string;
  repPhone: string;
  repBattery: number;
  totalDistanceKm: number;
  estimatedDuration: string;
  waypoints: Waypoint[];
}

const mockRoutes: BeatRoute[] = [
  {
    id: 'beat-01',
    code: 'BEAT-DEL-N01',
    name: 'Rohini Sector 7 & 8 Retail Beat',
    territory: 'North Delhi',
    repName: 'Vikram Sharma',
    repPhone: '+91 98220 11223',
    repBattery: 88,
    totalDistanceKm: 18.5,
    estimatedDuration: '6.5 hrs',
    waypoints: [
      {
        id: 'wp-1',
        sequence: 1,
        name: 'Sharma Kirana Store',
        owner: 'Radhe Shyam Sharma',
        address: 'Shop 12, Main Market, Sector 7',
        phone: '+91 98101 23456',
        type: 'Kirana',
        x: 18,
        y: 28,
        status: 'Visited',
        checkInTime: '09:45 AM',
        orderAmount: 18500,
      },
      {
        id: 'wp-2',
        sequence: 2,
        name: 'Gupta General Mart',
        owner: 'Sanjay Gupta',
        address: 'Plot 45, DDA Market, Sector 7',
        phone: '+91 98102 34567',
        type: 'Supermarket',
        x: 35,
        y: 22,
        status: 'Visited',
        checkInTime: '10:35 AM',
        orderAmount: 32400,
      },
      {
        id: 'wp-3',
        sequence: 3,
        name: 'Aggarwal Daily Needs',
        owner: 'Manoj Aggarwal',
        address: 'Near Metro Pillar 382, Sector 8',
        phone: '+91 98103 45678',
        type: 'Kirana',
        x: 52,
        y: 42,
        status: 'In Progress',
        checkInTime: '11:20 AM',
        orderAmount: 0,
      },
      {
        id: 'wp-4',
        sequence: 4,
        name: 'Verma Departmental Store',
        owner: 'Pawan Verma',
        address: 'Booth 6, Community Center, Sector 8',
        phone: '+91 98104 56789',
        type: 'Supermarket',
        x: 68,
        y: 35,
        status: 'Scheduled',
        orderAmount: 0,
      },
      {
        id: 'wp-5',
        sequence: 5,
        name: 'Modern Provision Hub',
        owner: 'Sunil Chawla',
        address: 'Shop 22, Pocket B, Sector 8',
        phone: '+91 98105 67890',
        type: 'Wholesale',
        x: 82,
        y: 58,
        status: 'Scheduled',
        orderAmount: 0,
      },
      {
        id: 'wp-6',
        sequence: 6,
        name: 'Balaji Superstore',
        owner: 'Rajesh Tyagi',
        address: 'Corner Plot 3, Ring Road Junction',
        phone: '+91 98106 78901',
        type: 'Supermarket',
        x: 75,
        y: 78,
        status: 'Scheduled',
        orderAmount: 0,
      },
    ],
  },
  {
    id: 'beat-02',
    code: 'BEAT-DEL-W02',
    name: 'Janakpuri District Center Circuit',
    territory: 'West Delhi',
    repName: 'Ananya Verma',
    repPhone: '+91 98112 33445',
    repBattery: 94,
    totalDistanceKm: 22.0,
    estimatedDuration: '7.0 hrs',
    waypoints: [
      {
        id: 'wp-21',
        sequence: 1,
        name: 'Janak Mart Supermarket',
        owner: 'Harish Malik',
        address: 'Block B1, Main Market',
        phone: '+91 98107 11223',
        type: 'Supermarket',
        x: 22,
        y: 65,
        status: 'Visited',
        checkInTime: '09:30 AM',
        orderAmount: 42000,
      },
      {
        id: 'wp-22',
        sequence: 2,
        name: 'Krishna Daily Provisions',
        owner: 'Deepak Arora',
        address: 'District Center Plaza',
        phone: '+91 98108 22334',
        type: 'Kirana',
        x: 44,
        y: 52,
        status: 'In Progress',
        checkInTime: '10:45 AM',
        orderAmount: 0,
      },
      {
        id: 'wp-23',
        sequence: 3,
        name: 'Royal Grocery Corner',
        owner: 'Amrit Singh',
        address: 'Near Metro Gate 2',
        phone: '+91 98109 33445',
        type: 'Kirana',
        x: 70,
        y: 40,
        status: 'Scheduled',
        orderAmount: 0,
      },
    ],
  },
];

interface BeatPlanningMapProps {
  selectedBeatId?: string;
  onSelectBeat?: (beatId: string) => void;
  className?: string;
}

export const BeatPlanningMap: React.FC<BeatPlanningMapProps> = ({
  selectedBeatId = 'beat-01',
  onSelectBeat,
  className = '',
}) => {
  const [activeRouteId, setActiveRouteId] = useState<string>(selectedBeatId);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    if (selectedBeatId) {
      setActiveRouteId(selectedBeatId);
      setSelectedWaypoint(null);
    }
  }, [selectedBeatId]);

  const currentRoute =
    mockRoutes.find((r) => r.id === activeRouteId) || mockRoutes[0];

  const handleRouteChange = (id: string) => {
    setActiveRouteId(id);
    setSelectedWaypoint(null);
    onSelectBeat?.(id);
  };

  // SVG Polyline generator connecting points in sequence
  const pathD = currentRoute.waypoints.reduce((acc, wp, index) => {
    return `${acc} ${index === 0 ? 'M' : 'L'} ${wp.x * 10} ${wp.y * 7}`;
  }, '');

  // Current active waypoint for rep pin
  const activeWaypoint =
    currentRoute.waypoints.find((w) => w.status === 'In Progress') ||
    currentRoute.waypoints[0];

  return (
    <div className={`space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {/* Top Map Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-inner">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-brand-400">
                {currentRoute.code}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Optimized Beat Route
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">
              {currentRoute.name} ({currentRoute.territory})
            </h2>
          </div>
        </div>

        {/* Route Selector & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeRouteId}
            onChange={(e) => handleRouteChange(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
          >
            {mockRoutes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isSimulating
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulating ? 'Pause GPS' : 'Live Beat Sim'}</span>
          </button>
        </div>
      </div>

      {/* Main Map Viewer Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Map Canvas */}
        <div className="lg:col-span-8 relative h-[480px] rounded-3xl overflow-hidden border border-slate-800 bg-[#071326] shadow-2xl">
          {/* Subtle Map Grid Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          {/* Map Vector Roads / Background Geometry */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
            viewBox="0 0 1000 700"
            preserveAspectRatio="none"
          >
            {/* Major Arterial Roads */}
            <path
              d="M-50,150 Q400,280 1050,180"
              stroke="#334155"
              strokeWidth="6"
              fill="none"
            />
            <path
              d="M150,-50 Q280,350 350,750"
              stroke="#334155"
              strokeWidth="5"
              fill="none"
            />
            <path
              d="M650,-50 Q600,400 850,750"
              stroke="#334155"
              strokeWidth="5"
              fill="none"
            />
            <path
              d="M-50,520 Q550,480 1050,620"
              stroke="#334155"
              strokeWidth="6"
              fill="none"
            />

            {/* Geofenced Territory Boundary */}
            <polygon
              points="100,80 900,100 920,620 80,600"
              fill="#3b82f6"
              fillOpacity="0.03"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
          </svg>

          {/* Dynamic Transform Container for Zoom/Pan */}
          <motion.div
            className="relative w-full h-full"
            animate={{ scale: zoomLevel }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            {/* SVG Beat Route Polyline */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1000 700"
            >
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>

              {/* Glowing Outer Route Halo */}
              <path
                d={pathD}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.25"
                filter="blur(4px)"
              />

              {/* Core Route Path */}
              <path
                d={pathD}
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isSimulating ? '8 4' : 'none'}
                className={isSimulating ? 'animate-pulse' : ''}
              />

              {/* Geofence Ring Around Active Waypoint */}
              {activeWaypoint && (
                <circle
                  cx={activeWaypoint.x * 10}
                  cy={activeWaypoint.y * 7}
                  r="45"
                  fill="#10b981"
                  fillOpacity="0.08"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
              )}
            </svg>

            {/* Waypoint Markers */}
            {currentRoute.waypoints.map((wp) => {
              const isSelected = selectedWaypoint?.id === wp.id;
              const isCurrent = wp.status === 'In Progress';
              const isVisited = wp.status === 'Visited';

              return (
                <div
                  key={wp.id}
                  style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
                  onClick={() => setSelectedWaypoint(wp)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  {/* Waypoint Pulse ring */}
                  {isCurrent && (
                    <span className="absolute -inset-2 rounded-full bg-brand-500/30 animate-ping pointer-events-none" />
                  )}

                  <div
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-lg transition-transform transform group-hover:scale-125 ${
                      isSelected
                        ? 'ring-4 ring-white scale-125'
                        : ''
                    } ${
                      isVisited
                        ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                        : isCurrent
                        ? 'bg-brand-600 text-white shadow-brand-500/50'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {isVisited ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span>{wp.sequence}</span>
                    )}
                  </div>

                  {/* Waypoint Hover Tooltip Tag */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap z-30 pointer-events-none">
                    <div className="px-2.5 py-1 rounded-lg bg-slate-950/95 text-white border border-slate-800 text-[11px] font-semibold shadow-xl">
                      {wp.name}
                      <span className="block text-[10px] text-brand-300 font-mono">
                        {wp.status} {wp.checkInTime ? `(${wp.checkInTime})` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Live Sales Rep GPS Beacon Marker */}
            {activeWaypoint && (
              <motion.div
                style={{
                  left: `${activeWaypoint.x}%`,
                  top: `${activeWaypoint.y}%`,
                }}
                animate={
                  isSimulating
                    ? {
                        scale: [1, 1.15, 1],
                      }
                    : {}
                }
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
              >
                <div className="relative flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 border-2 border-brand-400 flex items-center justify-center text-white shadow-2xl backdrop-blur-sm">
                    <Navigation className="w-5 h-5 text-brand-300 transform rotate-45" />
                  </div>
                  <div className="px-2 py-0.5 rounded-full bg-slate-950/90 border border-brand-500/40 text-[9px] font-bold text-brand-300 mt-1 whitespace-nowrap shadow-md">
                    {currentRoute.repName} (On Route)
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Map Floating HUD: Navigation & Zoom Controls */}
          <div className="absolute top-4 right-4 z-40 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl shadow-xl backdrop-blur-md">
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.2))}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Left Map Route Metrics HUD */}
          <div className="absolute bottom-4 left-4 z-40 flex items-center gap-3 bg-slate-950/90 border border-slate-800/90 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Total Route:</span>
              <span className="font-bold text-white font-mono">{currentRoute.totalDistanceKm} km</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Est. Time:</span>
              <span className="font-bold text-emerald-400 font-mono">{currentRoute.estimatedDuration}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Stops:</span>
              <span className="font-bold text-brand-300 font-mono">{currentRoute.waypoints.length} Outlets</span>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Waypoint Inspector & Turn-by-Turn Sequence */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Waypoint Details Card (If clicked) */}
          <AnimatePresence mode="wait">
            {selectedWaypoint ? (
              <motion.div
                key={selectedWaypoint.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-5 rounded-3xl bg-slate-900 border border-brand-500/30 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-400 font-bold text-xs flex items-center justify-center">
                      #{selectedWaypoint.sequence}
                    </span>
                    <span className="text-xs font-bold text-white">Stop Inspection</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedWaypoint.status === 'Visited'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : selectedWaypoint.status === 'In Progress'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedWaypoint.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{selectedWaypoint.name}</h3>
                  <p className="text-xs text-slate-300 font-medium">Proprietor: {selectedWaypoint.owner}</p>
                  <p className="text-[11px] text-slate-400">{selectedWaypoint.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Contact</span>
                    <span className="font-semibold text-slate-200">{selectedWaypoint.phone}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Outlet Type</span>
                    <span className="font-semibold text-slate-200">{selectedWaypoint.type}</span>
                  </div>
                </div>

                {selectedWaypoint.orderAmount ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <span className="text-slate-300">Order Booked on Visit</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      ₹{selectedWaypoint.orderAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>Geofence check-in verified within 50m radius.</span>
                </div>
              </motion.div>
            ) : (
              <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                <Store className="w-8 h-8 text-brand-400 mx-auto opacity-70" />
                <h3 className="text-xs font-bold text-white">Click any waypoint pin on map</h3>
                <p className="text-[11px] text-slate-400">
                  Inspect retail outlet store information, check-in timestamps, and secondary orders.
                </p>
              </div>
            )}
          </AnimatePresence>

          {/* Sequenced Route List */}
          <div className="flex-1 p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-400" />
                <span>Sequenced Beat Stops</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentRoute.waypoints.filter((w) => w.status === 'Visited').length}/
                {currentRoute.waypoints.length} Done
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
              {currentRoute.waypoints.map((wp) => (
                <div
                  key={wp.id}
                  onClick={() => setSelectedWaypoint(wp)}
                  className={`p-2.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedWaypoint?.id === wp.id
                      ? 'bg-brand-950/40 border-brand-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg font-bold text-[11px] flex items-center justify-center flex-shrink-0 ${
                        wp.status === 'Visited'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : wp.status === 'In Progress'
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {wp.sequence}
                    </span>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-200 block truncate">{wp.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{wp.address}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      wp.status === 'Visited'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : wp.status === 'In Progress'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {wp.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeatPlanningMap;
