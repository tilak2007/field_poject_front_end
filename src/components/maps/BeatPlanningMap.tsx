import React, { useState, useEffect, useMemo } from 'react';
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
  Radio,
} from 'lucide-react';
import { LiveGpsMap } from './LiveGpsMap';
import type { RepLiveTelemetry, GeofencedOutlet } from '../../api/gpsApi';
import type { BeatPlan } from '../../types';

// Calculate distance in km (Haversine formula)
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Calculate bearing degrees and cardinal compass direction
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): { degrees: number; cardinal: string } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLam = toRad(lon2 - lon1);

  const y = Math.sin(deltaLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(deltaLam);
  let brng = toDeg(Math.atan2(y, x));
  brng = (brng + 360) % 360;

  const cardinals = [
    'North (N)',
    'North-East (NE)',
    'East (E)',
    'South-East (SE)',
    'South (S)',
    'South-West (SW)',
    'West (W)',
    'North-West (NW)',
  ];
  const index = Math.round(brng / 45) % 8;
  return { degrees: Math.round(brng), cardinal: cardinals[index] };
}

export interface Waypoint {
  id: string;
  sequence: number;
  name: string;
  owner: string;
  address: string;
  phone: string;
  type: string;
  x: number; // Percentage coordinate on map (0 - 100)
  y: number;
  lat: number;
  lng: number;
  status: 'Visited' | 'In Progress' | 'Scheduled';
  checkInTime?: string;
  orderAmount?: number;
}

export interface BeatRoute {
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

const defaultBaseRoutes: BeatRoute[] = [
  {
    id: 'beat-01',
    code: 'BEAT-BLR-S01',
    name: 'Jayanagar & JP Nagar Retail Loop',
    territory: 'Bengaluru South',
    repName: 'Vikram Sharma',
    repPhone: '+91 98220 11223',
    repBattery: 88,
    totalDistanceKm: 18.5,
    estimatedDuration: '6.5 hrs',
    waypoints: [
      {
        id: 'wp-1',
        sequence: 1,
        name: 'Sri Manjunatha Provision Store',
        owner: 'Manjunath Gowda',
        address: 'Shop 12, 11th Main, 4th Block, Jayanagar',
        phone: '+91 98101 23456',
        type: 'Kirana',
        x: 18,
        y: 28,
        lat: 12.9298,
        lng: 77.5832,
        status: 'Visited',
        checkInTime: '09:45 AM',
        orderAmount: 18480,
      },
      {
        id: 'wp-2',
        sequence: 2,
        name: 'Shree Lakshmi Supermart',
        owner: 'Lakshmi Narayana',
        address: 'Plot 45, 24th Main, 7th Phase, JP Nagar',
        phone: '+91 98102 34567',
        type: 'Supermarket',
        x: 35,
        y: 22,
        lat: 12.9082,
        lng: 77.574,
        status: 'Visited',
        checkInTime: '10:35 AM',
        orderAmount: 32400,
      },
      {
        id: 'wp-3',
        sequence: 3,
        name: 'Venkateshwara Daily Needs',
        owner: 'M. Venkatesh',
        address: 'Near Metro Station, RV Road, Jayanagar',
        phone: '+91 98103 45678',
        type: 'Kirana',
        x: 52,
        y: 42,
        lat: 12.924,
        lng: 77.581,
        status: 'In Progress',
        checkInTime: '11:20 AM',
        orderAmount: 0,
      },
      {
        id: 'wp-4',
        sequence: 4,
        name: 'Kaveri Departmental Store',
        owner: 'Pawan Kumar',
        address: 'Booth 6, 8th Block, Jayanagar',
        phone: '+91 98104 56789',
        type: 'Supermarket',
        x: 68,
        y: 35,
        lat: 12.915,
        lng: 77.585,
        status: 'Scheduled',
        orderAmount: 0,
      },
      {
        id: 'wp-5',
        sequence: 5,
        name: 'Mysuru Provision Hub',
        owner: 'Sunil Rao',
        address: 'Shop 22, 15th Cross, JP Nagar',
        phone: '+91 98105 67890',
        type: 'Wholesale',
        x: 82,
        y: 58,
        lat: 12.904,
        lng: 77.579,
        status: 'Scheduled',
        orderAmount: 0,
      },
      {
        id: 'wp-6',
        sequence: 6,
        name: 'Balaji Superstore',
        owner: 'Rajesh Prasad',
        address: 'Corner Plot 3, Outer Ring Road, Banashankari',
        phone: '+91 98106 78901',
        type: 'Supermarket',
        x: 75,
        y: 78,
        lat: 12.922,
        lng: 77.568,
        status: 'Scheduled',
        orderAmount: 0,
      },
    ],
  },
  {
    id: 'beat-02',
    code: 'BEAT-BLR-C02',
    name: 'BTM Layout & Koramangala Circuit',
    territory: 'Bengaluru Central',
    repName: 'Ananya Verma',
    repPhone: '+91 98112 33445',
    repBattery: 94,
    totalDistanceKm: 22.0,
    estimatedDuration: '7.0 hrs',
    waypoints: [
      {
        id: 'wp-21',
        sequence: 1,
        name: 'Koramangala Mart Supermarket',
        owner: 'Harish Malik',
        address: '80 Feet Rd, 5th Block, Koramangala',
        phone: '+91 98107 11223',
        type: 'Supermarket',
        x: 22,
        y: 65,
        lat: 12.934,
        lng: 77.622,
        status: 'Visited',
        checkInTime: '09:30 AM',
        orderAmount: 42000,
      },
      {
        id: 'wp-22',
        sequence: 2,
        name: 'Venkateshwara Daily Provisions',
        owner: 'Deepak Rao',
        address: 'Outer Ring Rd, BTM 2nd Stage',
        phone: '+91 98108 22334',
        type: 'Kirana',
        x: 44,
        y: 52,
        lat: 12.9165,
        lng: 77.6101,
        status: 'In Progress',
        checkInTime: '10:45 AM',
        orderAmount: 0,
      },
      {
        id: 'wp-23',
        sequence: 3,
        name: 'Royal Grocery Corner',
        owner: 'Amrit Gowda',
        address: '100 Feet Rd, 6th Block, Koramangala',
        phone: '+91 98109 33445',
        type: 'Kirana',
        x: 70,
        y: 40,
        lat: 12.938,
        lng: 77.628,
        status: 'Scheduled',
        orderAmount: 0,
      },
    ],
  },
];

interface BeatPlanningMapProps {
  selectedBeatId?: string;
  onSelectBeat?: (beatId: string) => void;
  beats?: BeatPlan[];
  user?: any;
  userCoords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    city?: string;
  };
  className?: string;
}

export const BeatPlanningMap: React.FC<BeatPlanningMapProps> = ({
  selectedBeatId,
  onSelectBeat,
  beats = [],
  user,
  userCoords,
  className = '',
}) => {
  // Map display mode: Vector Blueprint or Real-world OpenStreetMap Leaflet Map
  const [mapEngine, setMapEngine] = useState<'blueprint' | 'satellite'>('blueprint');

  // Build dynamic routes list incorporating the logged-in user's assigned beats
  const dynamicRoutes = useMemo(() => {
    const list: BeatRoute[] = [...defaultBaseRoutes];

    // If user is logged in, ensure a tailored beat route exists for them!
    const userName = user?.name || 'Sales Representative';
    const userTerritory = user?.territory || 'Bengaluru South';
    const userRepId = user?.id || 'rep-user';

    const userBeats = beats.filter(
      (b) =>
        b.repName?.toLowerCase() === userName.toLowerCase() ||
        b.repId === userRepId ||
        (user?.email && b.repId === user.email)
    );

    // Read logged-in user's recorded visits to eliminate any false claims
    let userRecordedVisits: any[] = [];
    try {
      const savedVisits = localStorage.getItem('fieldassist_visits');
      if (savedVisits) {
        userRecordedVisits = JSON.parse(savedVisits);
      }
    } catch {}

    const getWaypointVisitStatus = (outletName: string) => {
      const match = userRecordedVisits.find(
        (v) =>
          (v.repId === userRepId || (user?.name && v.repName?.toLowerCase() === userName.toLowerCase())) &&
          (v.retailerName?.toLowerCase().includes(outletName.toLowerCase()) ||
            outletName.toLowerCase().includes(v.retailerName?.toLowerCase()))
      );
      if (match) {
        if (match.status === 'Completed') {
          return { status: 'Visited' as const, checkInTime: match.actualCheckIn, orderAmount: match.orderBookedAmount || 0 };
        }
        if (match.status === 'In Progress') {
          return { status: 'In Progress' as const, checkInTime: match.actualCheckIn, orderAmount: 0 };
        }
      }
      return { status: 'Scheduled' as const, checkInTime: undefined, orderAmount: 0 };
    };

    if (userBeats.length > 0) {
      userBeats.forEach((b, idx) => {
        const routeId = b.id || `beat-user-${idx}`;
        const existingIdx = list.findIndex((r) => r.id === routeId);
        const s1 = getWaypointVisitStatus(`${b.territory} Central Hub`);
        const s2 = getWaypointVisitStatus('City Supermart Outlet');
        const s3 = getWaypointVisitStatus('Venkateshwara General Stores');
        const s4 = getWaypointVisitStatus('Annapurna Daily Fresh');

        const routeObj: BeatRoute = {
          id: routeId,
          code: b.code || `BEAT-BLR-${idx + 1}`,
          name: b.beatName || `${b.territory} Field Circuit`,
          territory: b.territory || userTerritory,
          repName: userName,
          repPhone: '+91 98000 12345',
          repBattery: 95,
          totalDistanceKm: b.estimatedDistanceKm || 18.0,
          estimatedDuration: `${b.estimatedVisitsDurationHours || 6.5} hrs`,
          waypoints: [
            {
              id: `wp-u1-${routeId}`,
              sequence: 1,
              name: `${b.territory} Central Hub`,
              owner: 'Area Distributor',
              address: `1st Main, ${b.territory}`,
              phone: '+91 98450 11223',
              type: 'Wholesale',
              x: 18,
              y: 32,
              lat: (userCoords?.latitude || 12.9298) - 0.005,
              lng: (userCoords?.longitude || 77.5832) - 0.005,
              status: s1.status,
              checkInTime: s1.checkInTime,
              orderAmount: s1.orderAmount,
            },
            {
              id: `wp-u2-${routeId}`,
              sequence: 2,
              name: 'City Supermart Outlet',
              owner: 'S. K. Gowda',
              address: `Shop 45, Main Market, ${b.territory}`,
              phone: '+91 98450 22334',
              type: 'Supermarket',
              x: 42,
              y: 25,
              lat: (userCoords?.latitude || 12.9298) + 0.003,
              lng: (userCoords?.longitude || 77.5832) - 0.002,
              status: s2.status,
              checkInTime: s2.checkInTime,
              orderAmount: s2.orderAmount,
            },
            {
              id: `wp-u3-${routeId}`,
              sequence: 3,
              name: 'Venkateshwara General Stores',
              owner: 'M. Venkatesh',
              address: `Near Metro Bus Stop, ${b.territory}`,
              phone: '+91 98450 33445',
              type: 'Kirana',
              x: 65,
              y: 48,
              lat: (userCoords?.latitude || 12.9298) + 0.006,
              lng: (userCoords?.longitude || 77.5832) + 0.004,
              status: s3.status,
              checkInTime: s3.checkInTime,
              orderAmount: s3.orderAmount,
            },
            {
              id: `wp-u4-${routeId}`,
              sequence: 4,
              name: 'Annapurna Daily Fresh',
              owner: 'R. K. Sharma',
              address: `Cross Road 7, ${b.territory}`,
              phone: '+91 98450 44556',
              type: 'Kirana',
              x: 82,
              y: 65,
              lat: (userCoords?.latitude || 12.9298) - 0.004,
              lng: (userCoords?.longitude || 77.5832) + 0.007,
              status: s4.status,
              checkInTime: s4.checkInTime,
              orderAmount: s4.orderAmount,
            },
          ],
        };

        if (existingIdx !== -1) {
          list[existingIdx] = routeObj;
        } else {
          list.unshift(routeObj); // Put user route at the top!
        }
      });
    } else if (user?.role === 'Sales Representative' && user?.name && user?.name !== 'Vikram Sharma') {
      const myS1 = getWaypointVisitStatus(`${userTerritory} Depot & Hub`);
      const myS2 = getWaypointVisitStatus('Sri Krishna Provisions');
      const myS3 = getWaypointVisitStatus('Balaji Supermart');

      // Synthesize user's assigned route at the top
      const userRoute: BeatRoute = {
        id: `beat-assigned-${user.id || 'my-beat'}`,
        code: `BEAT-${(userTerritory.slice(0, 3) || 'BLR').toUpperCase()}-01`,
        name: `${userTerritory} - Assigned Beat Route`,
        territory: userTerritory,
        repName: userName,
        repPhone: '+91 98000 12345',
        repBattery: 95,
        totalDistanceKm: 18.5,
        estimatedDuration: '6.5 hrs',
        waypoints: [
          {
            id: 'wp-my-1',
            sequence: 1,
            name: `${userTerritory} Depot & Hub`,
            owner: 'Regional Logistics Hub',
            address: `Main Ring Road, ${userTerritory}`,
            phone: '+91 98450 11223',
            type: 'Wholesale',
            x: 20,
            y: 35,
            lat: (userCoords?.latitude || 12.9298) - 0.004,
            lng: (userCoords?.longitude || 77.5832) - 0.004,
            status: myS1.status,
            checkInTime: myS1.checkInTime,
            orderAmount: myS1.orderAmount,
          },
          {
            id: 'wp-my-2',
            sequence: 2,
            name: 'Sri Krishna Provisions',
            owner: 'Krishna Murthy',
            address: `4th Cross, Market Area, ${userTerritory}`,
            phone: '+91 98450 22334',
            type: 'Kirana',
            x: 45,
            y: 28,
            lat: (userCoords?.latitude || 12.9298) + 0.002,
            lng: (userCoords?.longitude || 77.5832) - 0.002,
            status: myS2.status,
            checkInTime: myS2.checkInTime,
            orderAmount: myS2.orderAmount,
          },
          {
            id: 'wp-my-3',
            sequence: 3,
            name: 'Balaji Supermart',
            owner: 'Balaji Rao',
            address: `Near Metro Station, ${userTerritory}`,
            phone: '+91 98450 33445',
            type: 'Supermarket',
            x: 70,
            y: 52,
            lat: (userCoords?.latitude || 12.9298) + 0.005,
            lng: (userCoords?.longitude || 77.5832) + 0.003,
            status: myS3.status,
            checkInTime: myS3.checkInTime,
            orderAmount: myS3.orderAmount,
          },
        ],
      };
      list.unshift(userRoute);
    }

    return list;
  }, [beats, user, userCoords]);

  const [activeRouteId, setActiveRouteId] = useState<string>(() => {
    return selectedBeatId || dynamicRoutes[0]?.id || 'beat-01';
  });

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    if (selectedBeatId) {
      setActiveRouteId(selectedBeatId);
      setSelectedWaypoint(null);
    } else if (dynamicRoutes.length > 0 && !dynamicRoutes.some((r) => r.id === activeRouteId)) {
      setActiveRouteId(dynamicRoutes[0].id);
    }
  }, [selectedBeatId, dynamicRoutes]);

  const currentRoute = useMemo(() => {
    return dynamicRoutes.find((r) => r.id === activeRouteId) || dynamicRoutes[0] || defaultBaseRoutes[0];
  }, [dynamicRoutes, activeRouteId]);

  const isUserOwnRoute =
    user?.name && currentRoute.repName?.toLowerCase() === user.name.toLowerCase();

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

  // Convert current route waypoints and user location for the Leaflet satellite map
  const leafletReps: RepLiveTelemetry[] = useMemo(() => {
    const lat = userCoords?.latitude || activeWaypoint?.lat || 12.9298;
    const lng = userCoords?.longitude || activeWaypoint?.lng || 77.5832;

    return [
      {
        id: user?.id || 'rep-current',
        name: currentRoute.repName,
        code: currentRoute.code,
        avatar: '',
        phone: currentRoute.repPhone,
        territory: currentRoute.territory,
        status: 'Moving' as const,
        coords: { lat, lng },
        speedKmH: 18,
        batteryLevel: currentRoute.repBattery,
        signal: 'GPS Lock' as const,
        headingDeg: 45,
        distanceTodayKm: currentRoute.totalDistanceKm,
        dailyTrail: currentRoute.waypoints.map((w) => ({
          lat: w.lat,
          lng: w.lng,
          time: w.checkInTime || '09:00 AM',
          activity: w.name,
        })),
        lastPingTime: 'Just now',
      },
    ];
  }, [currentRoute, userCoords, activeWaypoint, user]);

  const leafletOutlets: GeofencedOutlet[] = useMemo(() => {
    return currentRoute.waypoints.map((wp) => ({
      id: wp.id,
      name: wp.name,
      ownerName: wp.owner,
      address: wp.address,
      coords: { lat: wp.lat, lng: wp.lng },
      geofenceRadiusMeters: 80,
      type: wp.type,
    }));
  }, [currentRoute]);

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
                {isUserOwnRoute ? 'Your Assigned Route' : 'Optimized Beat Route'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">
              {currentRoute.name} • {currentRoute.repName} ({currentRoute.territory})
            </h2>
          </div>
        </div>

        {/* Route Selector & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Map Engine Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setMapEngine('blueprint')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                mapEngine === 'blueprint'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Route Blueprint
            </button>
            <button
              onClick={() => setMapEngine('satellite')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                mapEngine === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3 text-emerald-300" />
              <span>Live Leaflet GPS</span>
            </button>
          </div>

          <select
            value={activeRouteId}
            onChange={(e) => handleRouteChange(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            {dynamicRoutes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.repName})
              </option>
            ))}
          </select>

          {mapEngine === 'blueprint' && (
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSimulating
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? 'Pause Sim' : 'Live Beat Sim'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Viewer Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Map Canvas */}
        <div className="lg:col-span-8 relative h-[500px] rounded-3xl overflow-hidden border border-slate-800 bg-[#071326] shadow-2xl">
          {mapEngine === 'satellite' ? (
            /* REAL OPENSTREETMAP LEAFLET MAP */
            <div className="w-full h-full relative">
              <LiveGpsMap
                reps={leafletReps}
                geofencedOutlets={leafletOutlets}
                selectedRepId={user?.id || 'rep-current'}
                onSelectRep={() => {}}
                myDeviceCoords={
                  userCoords
                    ? {
                        lat: userCoords.latitude,
                        lng: userCoords.longitude,
                        accuracy: userCoords.accuracy || 15,
                      }
                    : null
                }
              />
            </div>
          ) : (
            /* VECTOR BLUEPRINT SCHEMATIC */
            <>
              {/* Subtle Map Grid Lines */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

              {/* Map Vector Roads / Background Geometry */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
                viewBox="0 0 1000 700"
                preserveAspectRatio="none"
              >
                {/* Major Arterial Roads */}
                <path d="M-50,150 Q400,280 1050,180" stroke="#334155" strokeWidth="6" fill="none" />
                <path d="M150,-50 Q280,350 350,750" stroke="#334155" strokeWidth="5" fill="none" />
                <path d="M650,-50 Q600,400 850,750" stroke="#334155" strokeWidth="5" fill="none" />
                <path d="M-50,520 Q550,480 1050,620" stroke="#334155" strokeWidth="6" fill="none" />

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
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 700">
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

                  {/* Directional Vector Line from User's active location to selected waypoint */}
                  {selectedWaypoint && activeWaypoint && selectedWaypoint.id !== activeWaypoint.id && (
                    <line
                      x1={activeWaypoint.x * 10}
                      y1={activeWaypoint.y * 7}
                      x2={selectedWaypoint.x * 10}
                      y2={selectedWaypoint.y * 7}
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      strokeLinecap="round"
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
                          isSelected ? 'ring-4 ring-white scale-125' : ''
                        } ${
                          isVisited
                            ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                            : isCurrent
                            ? 'bg-brand-600 text-white shadow-brand-500/50'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isVisited ? <CheckCircle2 className="w-4 h-4" /> : <span>{wp.sequence}</span>}
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
                    animate={isSimulating ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                  >
                    <div className="relative flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-white shadow-2xl backdrop-blur-sm animate-pulse">
                        <Navigation className="w-5 h-5 text-emerald-300 transform rotate-45" />
                      </div>
                      <div className="px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-emerald-500/40 text-[9px] font-bold text-emerald-300 mt-1 whitespace-nowrap shadow-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>
                          {isUserOwnRoute
                            ? `📍 YOU: ${currentRoute.repName}`
                            : `${currentRoute.repName} (On Route)`}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Map Floating HUD: Navigation & Zoom Controls */}
              <div className="absolute top-4 right-4 z-40 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl shadow-xl backdrop-blur-md">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.2))}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom Left Map Route Metrics HUD */}
              <div className="absolute bottom-4 left-4 z-40 flex items-center gap-3 bg-slate-950/90 border border-slate-800/90 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-xl text-xs flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total Route:</span>
                  <span className="font-bold text-white font-mono">{currentRoute.totalDistanceKm} km</span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Est. Time:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {currentRoute.estimatedDuration}
                  </span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Stops:</span>
                  <span className="font-bold text-brand-300 font-mono">
                    {currentRoute.waypoints.length} Outlets
                  </span>
                </div>
                {userCoords && (
                  <>
                    <span className="text-slate-700">|</span>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>
                        GPS: {userCoords.latitude.toFixed(4)}, {userCoords.longitude.toFixed(4)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
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

                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Store className="w-4 h-4 text-brand-400" />
                    <span>{selectedWaypoint.name}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">{selectedWaypoint.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Proprietor</span>
                    <span className="font-semibold text-slate-200">{selectedWaypoint.owner}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Contact Phone</span>
                    <span className="font-semibold text-slate-200">{selectedWaypoint.phone}</span>
                  </div>
                </div>

                {selectedWaypoint.orderAmount ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                    <span className="text-emerald-300 font-semibold">Booked Order Value</span>
                    <span className="font-bold text-white font-mono">
                      ₹{selectedWaypoint.orderAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : null}

                {/* Real GPS Bearing, Distance & Google Maps Navigation */}
                {(() => {
                  const originLat = userCoords?.latitude || activeWaypoint?.lat || 12.9298;
                  const originLng = userCoords?.longitude || activeWaypoint?.lng || 77.5832;
                  const destLat = selectedWaypoint.lat || 12.9298;
                  const destLng = selectedWaypoint.lng || 77.5832;
                  const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
                  const bearing = calculateBearing(originLat, originLng, destLat, destLng);
                  const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;

                  return (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-2xl bg-slate-950/80 border border-brand-500/30 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                            <Compass className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                            <span>Live Bearing & Distance:</span>
                          </span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {distKm} km away
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="text-[11px] text-slate-400">Direction from My GPS:</span>
                          <span className="font-mono font-bold text-brand-300 text-[11px]">
                            {bearing.cardinal} ({bearing.degrees}°)
                          </span>
                        </div>
                      </div>

                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Navigation className="w-4 h-4 transform rotate-45" />
                        <span>🧭 Turn-by-Turn Navigate (Google Maps)</span>
                      </a>
                    </div>
                  );
                })()}

                <button
                  onClick={() => setSelectedWaypoint(null)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Turn-by-Turn Waypoint List */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Turn-by-Turn Route Stops
                </h3>
                <span className="text-[10px] text-slate-400">
                  {currentRoute.waypoints.length} sequenced retail stops
                </span>
              </div>
              <span className="text-[10px] text-brand-400 font-semibold">
                {currentRoute.totalDistanceKm} km total
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1">
              {currentRoute.waypoints.map((wp) => {
                const isSelected = selectedWaypoint?.id === wp.id;
                const isCurrent = wp.status === 'In Progress';
                const isVisited = wp.status === 'Visited';
                const originLat = userCoords?.latitude || activeWaypoint?.lat || 12.9298;
                const originLng = userCoords?.longitude || activeWaypoint?.lng || 77.5832;
                const dist = calculateDistanceKm(originLat, originLng, wp.lat, wp.lng);
                const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${wp.lat},${wp.lng}&travelmode=driving`;

                return (
                  <div
                    key={wp.id}
                    onClick={() => setSelectedWaypoint(wp)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-800/90 border-brand-500 shadow-md'
                        : isCurrent
                        ? 'bg-brand-500/10 border-brand-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          isVisited
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isCurrent
                            ? 'bg-brand-500/20 text-brand-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {wp.sequence}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate text-[11px]">{wp.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{wp.type} • {wp.address}</div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        {dist} km
                      </span>
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                        title="Turn-by-turn Navigation in Google Maps"
                      >
                        <Navigation className="w-3.5 h-3.5 transform rotate-45" />
                      </a>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isVisited
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : isCurrent
                            ? 'bg-brand-500/10 text-brand-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {wp.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
