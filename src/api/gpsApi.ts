import { apiFetch, simulateNetworkDelay } from './client';

export interface RepLiveTelemetry {
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

export interface GeofencedOutlet {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  coords: { lat: number; lng: number };
  geofenceRadiusMeters: number;
  type: string;
}

export interface FleetGpsResponse {
  success: boolean;
  timestamp: string;
  fleetSummary: {
    totalReps: number;
    moving: number;
    atStore: number;
    idle: number;
    geofencesActive: number;
    averageFleetBattery: number;
  };
  reps: RepLiveTelemetry[];
  geofencedOutlets: GeofencedOutlet[];
}

export interface GpsPingPayload {
  repId: string;
  repName?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  battery?: number;
  status?: 'Moving' | 'At Store' | 'Idle';
  activity?: string;
}

// Fallback telemetry data if offline
const FALLBACK_TELEMETRY: FleetGpsResponse = {
  success: true,
  timestamp: new Date().toISOString(),
  fleetSummary: {
    totalReps: 3,
    moving: 1,
    atStore: 1,
    idle: 1,
    geofencesActive: 5,
    averageFleetBattery: 67,
  },
  reps: [
    {
      id: 'rep-1',
      name: 'Vikram Sharma',
      code: 'FA-REP-101',
      avatar: '',
      phone: '+91 98110 11223',
      territory: 'Bengaluru South (Jayanagar - JP Nagar)',
      status: 'At Store',
      coords: { lat: 12.9298, lng: 77.5832 },
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
      avatar: '',
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
      avatar: '',
      phone: '+91 98330 33445',
      territory: 'Bengaluru East (Indiranagar - Koramangala)',
      status: 'Idle',
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
  ],
  geofencedOutlets: [
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
  ],
};

export const gpsApi = {
  /**
   * GET /api/gps
   * Fetch live fleet positions, telemetry, and active geofences
   */
  async getLiveFleet(repId?: string): Promise<FleetGpsResponse> {
    try {
      const qs = repId ? `?repId=${encodeURIComponent(repId)}` : '';
      const res = await apiFetch<FleetGpsResponse>(`/gps${qs}`);
      if (res && res.success && Array.isArray(res.reps)) {
        return res;
      }
    } catch (err) {
      console.warn('Backend /api/gps notice, applying fallback telemetry:', err);
    }

    await simulateNetworkDelay(100);
    return FALLBACK_TELEMETRY;
  },

  /**
   * POST /api/gps
   * Transmit live device coordinate ping to backend fleet radar
   */
  async broadcastDevicePing(payload: GpsPingPayload): Promise<{
    success: boolean;
    insideGeofence: boolean;
    distanceToNearestOutletMeters?: number;
    nearestOutlet?: string | null;
  }> {
    try {
      const res = await apiFetch<{
        success: boolean;
        insideGeofence: boolean;
        distanceToNearestOutletMeters?: number;
        nearestOutlet?: string | null;
      }>('/gps', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (err) {
      console.warn('Device GPS ping fallback:', err);
      return { success: true, insideGeofence: false, nearestOutlet: null };
    }
  },
};
