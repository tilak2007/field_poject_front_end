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
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phone: '+91 98110 11223',
      territory: 'North Delhi (Rohini-Pitampura)',
      status: 'At Store',
      coords: { lat: 28.7188, lng: 77.1262 },
      speedKmH: 0,
      batteryLevel: 82,
      signal: '5G',
      headingDeg: 45,
      distanceTodayKm: 16.4,
      currentRetailer: {
        id: 'ret-101',
        name: 'Gupta Kirana & General Stores',
        address: 'Shop 14, Main Market, Sector 18',
        distanceMeters: 38,
        insideGeofence: true,
      },
      dailyTrail: [
        { lat: 28.7040, lng: 77.1025, time: '09:00 AM', activity: 'Shift Started at Depot' },
        { lat: 28.7110, lng: 77.1150, time: '09:35 AM', activity: 'En route' },
        { lat: 28.7220, lng: 77.1120, time: '10:15 AM', activity: 'BlinkPick Store Visit' },
        { lat: 28.7290, lng: 77.1350, time: '11:40 AM', activity: 'Modern Super Bazaar Visit' },
        { lat: 28.7188, lng: 77.1262, time: '01:10 PM', activity: 'Gupta Kirana Visit (Active)' },
      ],
      lastPingTime: new Date().toISOString(),
    },
    {
      id: 'rep-2',
      name: 'Ananya Verma',
      code: 'FA-REP-102',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      phone: '+91 98220 22334',
      territory: 'West Delhi (Karol Bagh - Patel Nagar)',
      status: 'Moving',
      coords: { lat: 28.6520, lng: 77.1850 },
      speedKmH: 26,
      batteryLevel: 74,
      signal: '5G',
      headingDeg: 120,
      distanceTodayKm: 22.8,
      currentRetailer: {
        id: 'ret-103',
        name: 'Sri Krishna Provisions & Co',
        address: 'En route via Patel Road',
        distanceMeters: 420,
        insideGeofence: false,
      },
      dailyTrail: [
        { lat: 28.6400, lng: 77.1650, time: '09:15 AM', activity: 'Shift Started' },
        { lat: 28.6460, lng: 77.1720, time: '10:00 AM', activity: 'Visit #1 Completed' },
        { lat: 28.6520, lng: 77.1850, time: '12:30 PM', activity: 'Transit to Beat Point 3' },
      ],
      lastPingTime: new Date().toISOString(),
    },
    {
      id: 'rep-3',
      name: 'Rahul Deshmukh',
      code: 'FA-REP-103',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      phone: '+91 98330 33445',
      territory: 'South Delhi (Saket - Hauz Khas)',
      status: 'Idle',
      coords: { lat: 28.5245, lng: 77.2065 },
      speedKmH: 0,
      batteryLevel: 45,
      signal: '4G',
      headingDeg: 280,
      distanceTodayKm: 11.2,
      currentRetailer: {
        id: 'ret-104',
        name: 'National Wholesale Traders',
        address: 'Saket District Centre',
        distanceMeters: 85,
        insideGeofence: true,
      },
      dailyTrail: [
        { lat: 28.5350, lng: 77.2100, time: '09:30 AM', activity: 'Shift Started' },
        { lat: 28.5245, lng: 77.2065, time: '11:15 AM', activity: 'Order Booking in Progress' },
      ],
      lastPingTime: new Date().toISOString(),
    },
  ],
  geofencedOutlets: [
    {
      id: 'ret-101',
      name: 'Gupta Kirana & General Stores',
      ownerName: 'Ramesh Gupta',
      address: 'Shop 14, Main Market, Sector 18, Rohini',
      coords: { lat: 28.7185, lng: 77.1265 },
      geofenceRadiusMeters: 100,
      type: 'Kirana',
    },
    {
      id: 'ret-102',
      name: 'Modern Super Bazaar',
      ownerName: 'Kavita Singh',
      address: 'Plot 45, DDA Commercial Complex, Sector 15',
      coords: { lat: 28.7290, lng: 77.1350 },
      geofenceRadiusMeters: 120,
      type: 'Supermarket',
    },
    {
      id: 'ret-103',
      name: 'Sri Krishna Provisions & Co',
      ownerName: 'Venkatesh Rao',
      address: '100 Feet Road, Deepali Enclave, Pitampura',
      coords: { lat: 28.6980, lng: 77.1210 },
      geofenceRadiusMeters: 90,
      type: 'Kirana',
    },
    {
      id: 'ret-104',
      name: 'National Wholesale Traders',
      ownerName: 'Harish Chandra',
      address: 'Grain Market Yard, Lawrence Road',
      coords: { lat: 28.6820, lng: 77.1510 },
      geofenceRadiusMeters: 150,
      type: 'Wholesale',
    },
    {
      id: 'ret-105',
      name: 'BlinkPick Convenience Store',
      ownerName: 'Ajay Verma',
      address: 'Metro Walk Mall Entrance, Sector 10',
      coords: { lat: 28.7220, lng: 77.1120 },
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
