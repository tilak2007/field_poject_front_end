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
 * Enterprise-Grade Free CDN Map Tile Providers (Zero API Key, Unlimited Global Bandwidth)
 * Hosted on Akamai / Fastly multi-region edge caches.
 * Eliminates HTTP 429 "Too Many Requests" rate limits from raw OSM servers.
 */
export const MAP_PROVIDERS: Record<MapStyleType, TileProviderConfig> = {
  streets: {
    // CartoDB Voyager: ultra-fast street map with high-DPI retina support, zero rate limits
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  dark: {
    // CartoDB Dark Matter: True native dark mode map (high contrast, crisp neon lines)
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  satellite: {
    // Esri World Imagery: Ultra-high resolution global satellite photography
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    fallbackUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  },
  terrain: {
    // CartoDB Positron: Clean high-contrast topographic light map
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  humanitarian: {
    // High-visibility crisp routing tiles
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
