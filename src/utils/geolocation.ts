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
  // Check if user manually saved preferred coordinates previously
  try {
    const saved = localStorage.getItem('fieldassist_user_coords');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        onSuccess(parsed);
        onStatusUpdate?.(`📍 Using saved location: ${parsed.city || `${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}`}`);
      }
    }
  } catch {
    // Ignore
  }

  onStatusUpdate?.('Requesting real device location (high-precision GPS)...');

  if (!('geolocation' in navigator)) {
    fallbackIpLocation(onSuccess, onStatusUpdate);
    return;
  }

  // Tier 1: Try high accuracy GPS (satellite / hardware)
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const result: GeoLocationResult = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy),
        source: 'gps-high-accuracy',
      };
      try {
        localStorage.setItem('fieldassist_user_coords', JSON.stringify(result));
      } catch {}
      onSuccess(result);
      onStatusUpdate?.(`📍 High-Accuracy GPS locked (±${Math.round(pos.coords.accuracy)}m)`);
    },
    (err) => {
      console.warn('High accuracy GPS timed out or unavailable, trying network WiFi location:', err.message);
      onStatusUpdate?.('Accessing WiFi / Network triangulation...');

      // Tier 2: Try standard accuracy (WiFi / cell network - instant on desktops/laptops)
      navigator.geolocation.getCurrentPosition(
        (netPos) => {
          const result: GeoLocationResult = {
            lat: Number(netPos.coords.latitude.toFixed(6)),
            lng: Number(netPos.coords.longitude.toFixed(6)),
            accuracy: Math.round(netPos.coords.accuracy),
            source: 'network-wifi',
          };
          try {
            localStorage.setItem('fieldassist_user_coords', JSON.stringify(result));
          } catch {}
          onSuccess(result);
          onStatusUpdate?.(`📍 Network location locked (±${Math.round(netPos.coords.accuracy)}m)`);
        },
        async (finalErr) => {
          console.warn('Browser geolocation denied or unavailable, trying IP lookup fallback:', finalErr.message);
          onStatusUpdate?.('Accessing location via network IP lookup...');
          await fallbackIpLocation(onSuccess, onStatusUpdate);
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
  );
};

const fallbackIpLocation = async (
  onSuccess: (loc: GeoLocationResult) => void,
  onStatusUpdate?: (status: string) => void
) => {
  // Provider 1: ipwho.is (fast, highly accurate in India, no rate limits)
  try {
    const res0 = await fetch('https://ipwho.is/');
    if (res0.ok) {
      const data0 = await res0.json();
      if (data0.success && data0.latitude && data0.longitude) {
        const result: GeoLocationResult = {
          lat: Number(data0.latitude.toFixed(6)),
          lng: Number(data0.longitude.toFixed(6)),
          accuracy: 500,
          source: 'ip-location',
          city: data0.city,
          country: data0.country,
        };
        try {
          localStorage.setItem('fieldassist_user_coords', JSON.stringify(result));
        } catch {}
        onSuccess(result);
        onStatusUpdate?.(`📍 Real Network location locked: ${data0.city || 'Your Area'}, ${data0.region || ''}`);
        return;
      }
    }
  } catch {
    // Fallback to next provider
  }

  // Provider 2: ipapi.co
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const result: GeoLocationResult = {
          lat: Number(data.latitude.toFixed(6)),
          lng: Number(data.longitude.toFixed(6)),
          accuracy: 1000,
          source: 'ip-location',
          city: data.city,
          country: data.country_name,
        };
        try {
          localStorage.setItem('fieldassist_user_coords', JSON.stringify(result));
        } catch {}
        onSuccess(result);
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
          const result: GeoLocationResult = {
            lat: Number(data2.latitude.toFixed(6)),
            lng: Number(data2.longitude.toFixed(6)),
            accuracy: 1000,
            source: 'ip-location',
            city: data2.cityName,
            country: data2.countryName,
          };
          try {
            localStorage.setItem('fieldassist_user_coords', JSON.stringify(result));
          } catch {}
          onSuccess(result);
          onStatusUpdate?.(`📍 Location locked: ${data2.cityName || 'Local'}`);
          return;
        }
      }
    } catch {
      // Ignored
    }
  }

  // Default fallback if all fail: Bengaluru
  onSuccess({
    lat: 12.9295,
    lng: 77.5830,
    accuracy: 50,
    source: 'ip-location',
    city: 'Bengaluru',
    country: 'India',
  });
  onStatusUpdate?.('📍 Defaulting to regional hub (Bengaluru)');
};
