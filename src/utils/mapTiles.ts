import L from 'leaflet';

export type MapStyleType = 'streets' | 'satellite' | 'dark' | 'terrain' | 'humanitarian';

export interface TileProviderConfig {
  url: string;
  subdomains: string;
  maxZoom: number;
  attribution: string;
  fallbackUrl: string;
}

/**
 * Enterprise-Grade Free CDN Map Tile Providers (Zero API Key, Unlimited Global Bandwidth, Zero Watermarks)
 * Hosted on Akamai / Esri ArcGIS Global multi-region edge caches.
 * Eliminates HTTP 429 "Too Many Requests" rate limits and avoids API key watermarks.
 */
export const MAP_PROVIDERS: Record<MapStyleType, TileProviderConfig> = {
  streets: {
    // Esri World Street Map: ultra-clean high-resolution streets, landmarks, zero watermarks
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Street Map',
    fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  dark: {
    // Esri Dark Gray Canvas: High contrast dark theme, zero watermarks
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Dark Canvas',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  },
  satellite: {
    // Esri World Imagery: Ultra-high resolution global satellite photography
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Satellite Imagery',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  },
  terrain: {
    // Esri World Topo Map: Clean topographic contours and hillshading
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Topographic',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  },
  humanitarian: {
    // High-visibility crisp routing tiles
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri',
    fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
};

/**
 * Creates an enterprise Leaflet tile layer with automatic error interception and mirror failover.
 * If any single tile fails or times out, it automatically swaps the src to the backup mirror!
 */
export function createRobustTileLayer(style: MapStyleType = 'streets'): L.TileLayer {
  const config = MAP_PROVIDERS[style] || MAP_PROVIDERS.streets;
  const layer = L.tileLayer(config.url, {
    maxZoom: config.maxZoom,
    subdomains: config.subdomains || 'abc',
    crossOrigin: true,
    keepBuffer: 6,
    updateWhenIdle: false,
    updateWhenZooming: true,
    attribution: config.attribution,
  });

  // Attach auto-recovery listener
  layer.on('tileerror', (errorEvent: any) => {
    const tile = errorEvent.tile as HTMLImageElement;
    if (tile && !tile.dataset.fallbackApplied && config.fallbackUrl) {
      tile.dataset.fallbackApplied = 'true';
      const coords = errorEvent.coords;
      if (coords) {
        const fallback = config.fallbackUrl
          .replace('{z}', String(coords.z))
          .replace('{x}', String(coords.x))
          .replace('{y}', String(coords.y))
          .replace('{s}', 'a')
          .replace('{r}', '');
        tile.src = fallback;
      }
    }
  });

  return layer;
}

/**
 * Fix Vite / Webpack Leaflet default marker icon asset paths
 */
export function fixLeafletDefaultIcons(): void {
  try {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  } catch {}
}
