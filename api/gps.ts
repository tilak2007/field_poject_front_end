// FieldAssist Serverless Backend: Live GPS Fleet Telemetry & Geofencing API
interface RepLiveTelemetry {
  id: string;
  name: string;
  code: string;
  avatar: string;
  phone: string;
  territory: string;
  status: 'Moving' | 'At Store' | 'Idle' | 'Offline';
  coords: { lat: number; lng: number };
  speedKmH: number;
  batteryLevel: number;
  signal: '5G' | '4G' | 'GPS Lock';
  headingDeg: number;
  distanceTodayKm: number;
  currentRetailer?: {
    id: string;
    name: string;
    address: string;
    distanceMeters: number;
    insideGeofence: boolean;
  };
  dailyTrail: Array<{ lat: number; lng: number; time: string; activity?: string }>;
  lastPingTime: string;
}

interface GeofencedOutlet {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  coords: { lat: number; lng: number };
  geofenceRadiusMeters: number;
  type: string;
}

// Initial Geofenced Outlets in Bengaluru territory
const GEOFENCED_OUTLETS: GeofencedOutlet[] = [
  {
    id: 'ret-101',
    name: 'Sri Manjunatha Provision Store',
    ownerName: 'Manjunath Gowda',
    address: 'Shop 14, 11th Main Rd, 4th Block, Jayanagar',
    coords: { lat: 12.9295, lng: 77.5830 },
    geofenceRadiusMeters: 100,
    type: 'Kirana',
  },
  {
    id: 'ret-102',
    name: 'Shree Lakshmi Supermart',
    ownerName: 'Lakshmi Narayana',
    address: 'Plot 45, 24th Main, 7th Phase, JP Nagar',
    coords: { lat: 12.9082, lng: 77.5740 },
    geofenceRadiusMeters: 120,
    type: 'Supermarket',
  },
  {
    id: 'ret-103',
    name: 'Venkateshwara Traders',
    ownerName: 'R. Venkatesh',
    address: 'Outer Ring Rd, BTM Layout 2nd Stage',
    coords: { lat: 12.9165, lng: 77.6101 },
    geofenceRadiusMeters: 90,
    type: 'Kirana',
  },
  {
    id: 'ret-104',
    name: 'Ganesh Grand Bazaar',
    ownerName: 'Ganesh Hegde',
    address: '80 Feet Rd, 5th Block, Koramangala',
    coords: { lat: 12.9340, lng: 77.6220 },
    geofenceRadiusMeters: 150,
    type: 'Wholesale',
  },
  {
    id: 'ret-105',
    name: 'Balaji Daily Needs',
    ownerName: 'Balaji Prasad',
    address: '100 Feet Ring Rd, 2nd Stage, Banashankari',
    coords: { lat: 12.9220, lng: 77.5680 },
    geofenceRadiusMeters: 100,
    type: 'Modern Trade',
  },
];

// Initial Live Telemetry state for Sales Representatives
let LIVE_REPS_TELEMETRY: RepLiveTelemetry[] = [
  {
    id: 'rep-1',
    name: 'Vikram Sharma',
    code: 'FA-REP-101',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '+91 98110 11223',
    territory: 'Bengaluru South (Jayanagar - JP Nagar)',
    status: 'At Store',
    coords: { lat: 12.9298, lng: 77.5832 }, // Near Sri Manjunatha Provision Store
    speedKmH: 0,
    batteryLevel: 82,
    signal: '5G',
    headingDeg: 45,
    distanceTodayKm: 16.4,
    currentRetailer: {
      id: 'ret-101',
      name: 'Sri Manjunatha Provision Store',
      address: 'Shop 14, 11th Main Rd, 4th Block, Jayanagar',
      distanceMeters: 38,
      insideGeofence: true,
    },
    dailyTrail: [
      { lat: 12.9200, lng: 77.5800, time: '09:00 AM', activity: 'Shift Started at South Bengaluru Depot' },
      { lat: 12.9240, lng: 77.5815, time: '09:35 AM', activity: 'En route via 11th Main' },
      { lat: 12.9220, lng: 77.5680, time: '10:15 AM', activity: 'Balaji Daily Needs Visit' },
      { lat: 12.9082, lng: 77.5740, time: '11:40 AM', activity: 'Shree Lakshmi Supermart Visit' },
      { lat: 12.9298, lng: 77.5832, time: '01:10 PM', activity: 'Sri Manjunatha Provision Store Visit (Active)' },
    ],
    lastPingTime: new Date().toISOString(),
  },
  {
    id: 'rep-2',
    name: 'Ananya Verma',
    code: 'FA-REP-102',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    phone: '+91 98220 22334',
    territory: 'Bengaluru Central (BTM - Koramangala)',
    status: 'Moving',
    coords: { lat: 12.9210, lng: 77.6150 },
    speedKmH: 26,
    batteryLevel: 74,
    signal: '5G',
    headingDeg: 120,
    distanceTodayKm: 22.8,
    currentRetailer: {
      id: 'ret-103',
      name: 'Venkateshwara Traders',
      address: 'En route via Outer Ring Road',
      distanceMeters: 420,
      insideGeofence: false,
    },
    dailyTrail: [
      { lat: 12.9100, lng: 77.6050, time: '09:15 AM', activity: 'Shift Started at Central Hub' },
      { lat: 12.9130, lng: 77.6080, time: '10:00 AM', activity: 'Visit #1 Completed' },
      { lat: 12.9210, lng: 77.6150, time: '12:30 PM', activity: 'Transit to Beat Point 3' },
    ],
    lastPingTime: new Date().toISOString(),
  },
  {
    id: 'rep-3',
    name: 'Rahul Deshmukh',
    code: 'FA-REP-103',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '+91 98330 33445',
    territory: 'Bengaluru East (Indiranagar - Koramangala)',
    status: 'At Store',
    coords: { lat: 12.9345, lng: 77.6225 },
    speedKmH: 0,
    batteryLevel: 45,
    signal: '4G',
    headingDeg: 280,
    distanceTodayKm: 11.2,
    currentRetailer: {
      id: 'ret-104',
      name: 'Ganesh Grand Bazaar',
      address: '80 Feet Rd, 5th Block, Koramangala',
      distanceMeters: 65,
      insideGeofence: true,
    },
    dailyTrail: [
      { lat: 12.9380, lng: 77.6250, time: '09:30 AM', activity: 'Shift Started' },
      { lat: 12.9345, lng: 77.6225, time: '11:15 AM', activity: 'Order Booking in Progress' },
    ],
    lastPingTime: new Date().toISOString(),
  },
];

// Helper: Calculate Haversine distance in meters
function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch live fleet locations, geofences, and alerts
  if (req.method === 'GET') {
    const { repId } = req.query || {};

    let reps = [...LIVE_REPS_TELEMETRY];
    if (repId) {
      reps = reps.filter((r) => r.id === repId);
    }

    // Dynamic micro-jitter to simulate live real-time GPS telemetry movement when polled
    reps = reps.map((rep) => {
      if (rep.status === 'Moving') {
        const jitterLat = (Math.random() - 0.48) * 0.0004;
        const jitterLng = (Math.random() - 0.48) * 0.0004;
        const newLat = Number((rep.coords.lat + jitterLat).toFixed(6));
        const newLng = Number((rep.coords.lng + jitterLng).toFixed(6));
        const newSpeed = Math.floor(18 + Math.random() * 20);

        return {
          ...rep,
          coords: { lat: newLat, lng: newLng },
          speedKmH: newSpeed,
          lastPingTime: new Date().toISOString(),
        };
      }
      return rep;
    });

    const activeMovingCount = reps.filter((r) => r.status === 'Moving').length;
    const activeAtStoreCount = reps.filter((r) => r.status === 'At Store').length;
    const idleCount = reps.filter((r) => r.status === 'Idle').length;

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      fleetSummary: {
        totalReps: reps.length,
        moving: activeMovingCount,
        atStore: activeAtStoreCount,
        idle: idleCount,
        geofencesActive: GEOFENCED_OUTLETS.length,
        averageFleetBattery: Math.round(reps.reduce((s, r) => s + r.batteryLevel, 0) / reps.length),
      },
      reps,
      geofencedOutlets: GEOFENCED_OUTLETS,
    });
  }

  // POST: Record device GPS ping (from real mobile browser / rep field app)
  if (req.method === 'POST') {
    const body = req.body || {};
    const {
      repId = 'rep-1',
      latitude,
      longitude,
      speed = 0,
      heading = 0,
      battery = 85,
      status = 'Moving',
      activity = 'Live GPS Broadcast',
    } = body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    // Find closest geofenced retailer
    let closestOutlet: GeofencedOutlet | null = null;
    let minDistance = Infinity;

    for (const outlet of GEOFENCED_OUTLETS) {
      const dist = getHaversineDistanceMeters(latNum, lngNum, outlet.coords.lat, outlet.coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestOutlet = outlet;
      }
    }

    const insideGeofence = closestOutlet ? minDistance <= closestOutlet.geofenceRadiusMeters : false;

    // Check if rep exists in telemetry store
    const repIndex = LIVE_REPS_TELEMETRY.findIndex((r) => r.id === repId);
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newTrailPoint = {
      lat: latNum,
      lng: lngNum,
      time: nowTimeStr,
      activity: insideGeofence && closestOutlet ? `Inside Geofence: ${closestOutlet.name}` : activity,
    };

    if (repIndex !== -1) {
      LIVE_REPS_TELEMETRY[repIndex] = {
        ...LIVE_REPS_TELEMETRY[repIndex],
        coords: { lat: latNum, lng: lngNum },
        speedKmH: Number(speed) || 0,
        headingDeg: Number(heading) || 0,
        batteryLevel: Number(battery) || LIVE_REPS_TELEMETRY[repIndex].batteryLevel,
        status: insideGeofence ? 'At Store' : status,
        currentRetailer: closestOutlet
          ? {
              id: closestOutlet.id,
              name: closestOutlet.name,
              address: closestOutlet.address,
              distanceMeters: minDistance,
              insideGeofence,
            }
          : undefined,
        dailyTrail: [...LIVE_REPS_TELEMETRY[repIndex].dailyTrail, newTrailPoint].slice(-50), // keep last 50
        lastPingTime: new Date().toISOString(),
      };
    } else {
      // Add as custom live rep
      const newLiveRep: RepLiveTelemetry = {
        id: repId,
        name: body.repName || 'Field Executive',
        code: `FA-REP-${Date.now().toString().slice(-3)}`,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        phone: body.phone || '+91 98000 00000',
        territory: body.territory || 'Bengaluru Live Fleet',
        status: insideGeofence ? 'At Store' : status,
        coords: { lat: latNum, lng: lngNum },
        speedKmH: Number(speed) || 0,
        batteryLevel: Number(battery) || 90,
        signal: '5G',
        headingDeg: Number(heading) || 0,
        distanceTodayKm: 5.2,
        currentRetailer: closestOutlet
          ? {
              id: closestOutlet.id,
              name: closestOutlet.name,
              address: closestOutlet.address,
              distanceMeters: minDistance,
              insideGeofence,
            }
          : undefined,
        dailyTrail: [newTrailPoint],
        lastPingTime: new Date().toISOString(),
      };
      LIVE_REPS_TELEMETRY.push(newLiveRep);
    }

    return res.status(200).json({
      success: true,
      message: 'Live GPS coordinate synchronized with central fleet radar',
      insideGeofence,
      distanceToNearestOutletMeters: minDistance,
      nearestOutlet: closestOutlet ? closestOutlet.name : null,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
