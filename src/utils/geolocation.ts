/**
 * Geolocation utility with multi-tier fallback:
 * 1. High-accuracy GPS (Mobile / Satellite)
 * 2. Standard-accuracy WiFi / Cell tower triangulation
 * 3. Free IP Geolocation API (if user denies browser permission)
 */

export interface GeoLocationResult {
  lat: number;
  lng: number;
  accuracy: number;
  source: 'gps-high-accuracy' | 'network-wifi' | 'ip-location';
  city?: string;
  country?: string;
}

export const acquireLiveLocation = async (
  onSuccess: (loc: GeoLocationResult) => void,
  onStatusUpdate?: (status: string) => void
): Promise<void> => {
  onStatusUpdate?.('Requesting device location (high-precision GPS)...');

  if (!('geolocation' in navigator)) {
    fallbackIpLocation(onSuccess, onStatusUpdate);
    return;
  }

  // Tier 1: Try high accuracy GPS (satellite / hardware)
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onSuccess({
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy),
        source: 'gps-high-accuracy',
      });
      onStatusUpdate?.(`📍 High-Accuracy GPS locked (±${Math.round(pos.coords.accuracy)}m)`);
    },
    (err) => {
      console.warn('High accuracy GPS timed out or unavailable, trying network WiFi location:', err.message);
      onStatusUpdate?.('Switching to WiFi / Network triangulation...');

      // Tier 2: Try standard accuracy (WiFi / cell network - instant on desktops/laptops)
      navigator.geolocation.getCurrentPosition(
        (netPos) => {
          onSuccess({
            lat: Number(netPos.coords.latitude.toFixed(6)),
            lng: Number(netPos.coords.longitude.toFixed(6)),
            accuracy: Math.round(netPos.coords.accuracy),
            source: 'network-wifi',
          });
          onStatusUpdate?.(`📍 Network location locked (±${Math.round(netPos.coords.accuracy)}m)`);
        },
        async (finalErr) => {
          console.warn('Browser geolocation denied or unavailable, trying IP lookup fallback:', finalErr.message);
          onStatusUpdate?.('Accessing location via IP network lookup...');
          await fallbackIpLocation(onSuccess, onStatusUpdate);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
  );
};

const fallbackIpLocation = async (
  onSuccess: (loc: GeoLocationResult) => void,
  onStatusUpdate?: (status: string) => void
) => {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        onSuccess({
          lat: Number(data.latitude.toFixed(6)),
          lng: Number(data.longitude.toFixed(6)),
          accuracy: 1000,
          source: 'ip-location',
          city: data.city,
          country: data.country_name,
        });
        onStatusUpdate?.(`📍 Approximate city location locked: ${data.city || 'Your Area'}`);
        return;
      }
    }
  } catch {
    // Second IP fallback
    try {
      const res2 = await fetch('https://freeipapi.com/api/json');
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.latitude && data2.longitude) {
          onSuccess({
            lat: Number(data2.latitude.toFixed(6)),
            lng: Number(data2.longitude.toFixed(6)),
            accuracy: 1000,
            source: 'ip-location',
            city: data2.cityName,
            country: data2.countryName,
          });
          onStatusUpdate?.(`📍 Location locked: ${data2.cityName || 'Local'}`);
          return;
        }
      }
    } catch {
      // Ignored
    }
  }

  // Default fallback if all fail: New Delhi Central
  onSuccess({
    lat: 28.6139,
    lng: 77.209,
    accuracy: 500,
    source: 'ip-location',
    city: 'Delhi',
    country: 'India',
  });
  onStatusUpdate?.('📍 Defaulting to regional hub (Delhi-NCR)');
};
