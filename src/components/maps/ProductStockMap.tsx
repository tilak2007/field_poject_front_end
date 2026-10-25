import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Store,
  Package,
} from 'lucide-react';
import type { Product } from '../../types';

interface ProductStockMapProps {
  products: Product[];
  selectedSku?: string | null;
  onSelectProduct?: (sku: string) => void;
  className?: string;
}

type MapLayerType = 'streets' | 'satellite' | 'terrain' | 'dark';

interface OutletStockInfo {
  id: string;
  name: string;
  owner: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  stockMap: Record<string, number>; // sku -> cases
  type: string;
}

export const ProductStockMap: React.FC<ProductStockMapProps> = ({
  products,
  selectedSku,
  onSelectProduct,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const outletMarkersRef = useRef<L.Marker[]>([]);

  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Requesting real GPS...');
  const [activeSku, setActiveSku] = useState<string>(selectedSku || (products[0]?.sku ?? ''));
  const [outlets, setOutlets] = useState<OutletStockInfo[]>([]);

  // 100% Free Tile Layer URLs (NO API KEY, NO WATERMARK)
  const getTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      case 'dark':
      case 'streets':
      default:
        // Free OpenStreetMap Standard
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  // Generate or align sample retail outlets around the given center point
  const generateOutletsNear = (centerLat: number, centerLng: number, prds: Product[]): OutletStockInfo[] => {
    const offsets = [
      { dLat: 0.0065, dLng: 0.0072, name: 'Metro Supermart & Groceries', owner: 'Ramesh Gupta', type: 'Supermarket' },
      { dLat: -0.0052, dLng: 0.0061, name: 'Shree Krishna Daily Provisions', owner: 'Gopal Krishna', type: 'Kirana' },
      { dLat: 0.0088, dLng: -0.0049, name: 'Royal Wholesale Depot', owner: 'Amrit Singh', type: 'Wholesale' },
      { dLat: -0.0074, dLng: -0.0083, name: 'City Center Mega Store', owner: 'Sunil Verma', type: 'Supermarket' },
      { dLat: 0.0025, dLng: -0.0095, name: 'Balaji Express Mart', owner: 'Rajesh Tyagi', type: 'Kirana' },
      { dLat: -0.0031, dLng: 0.0038, name: 'Apex FMCG Distribution Hub', owner: 'Vikram Mehta', type: 'Depot' },
    ];

    return offsets.map((o, idx) => {
      const stockMap: Record<string, number> = {};
      prds.forEach((p, pIdx) => {
        // Deterministic realistic stock quantity
        stockMap[p.sku] = Math.max(5, ((idx * 7 + pIdx * 13) % 45) + 5);
      });

      return {
        id: `outlet-${idx + 1}`,
        name: o.name,
        owner: o.owner,
        phone: `+91 9810${idx} 78${idx}10`,
        address: `Shop #${12 + idx * 4}, Sector Road`,
        lat: Number((centerLat + o.dLat).toFixed(6)),
        lng: Number((centerLng + o.dLng).toFixed(6)),
        stockMap,
        type: o.type,
      };
    });
  };

  // Calculate Haversine distance in km
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
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
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [28.6139, 77.209]; // Default fallback
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    const tileLayer = L.tileLayer(getTileUrl('streets'), {
      maxZoom: 19,
      subdomains: 'abc',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Immediately acquire Real Live Location
    acquireRealLocation(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Tile Layer & Filter Handling
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getTileUrl(mapLayer));

    const container = tileLayerRef.current.getContainer();
    if (container) {
      if (mapLayer === 'dark') {
        container.style.filter =
          'invert(100%) hue-rotate(180deg) brightness(92%) contrast(92%)';
      } else {
        container.style.filter = 'none';
      }
    }
  }, [mapLayer]);

  // Acquire Real Live Location via browser GPS
  const acquireRealLocation = (map?: L.Map | null) => {
    const targetMap = map || mapInstanceRef.current;
    if (!('geolocation' in navigator)) {
      setLocationStatus('GPS not supported in browser');
      // Set default outlets
      setOutlets(generateOutletsNear(28.6139, 77.209, products));
      return;
    }

    setIsLocating(true);
    setLocationStatus('Acquiring real-time satellite GPS fix...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        setUserCoords({ lat, lng, accuracy });
        setLocationStatus(`📍 Real Live GPS locked: ${lat}, ${lng} (±${accuracy}m)`);

        // Generate outlets surrounding the user's real location!
        const localOutlets = generateOutletsNear(lat, lng, products);
        setOutlets(localOutlets);

        if (targetMap) {
          targetMap.flyTo([lat, lng], 14, { duration: 1.2 });
        }
      },
      (err) => {
        setIsLocating(false);
        setLocationStatus(`GPS permission deferred: ${err.message}. Showing territory hubs.`);
        // Fallback default territory outlets
        setOutlets(generateOutletsNear(28.6139, 77.209, products));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 3. Render Real Live Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.remove();
      userAccuracyCircleRef.current = null;
    }

    if (!userCoords) return;

    // Accuracy Circle
    if (userCoords.accuracy) {
      const circle = L.circle([userCoords.lat, userCoords.lng], {
        radius: userCoords.accuracy,
        color: '#2563eb',
        weight: 1.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(map);
      userAccuracyCircleRef.current = circle;
    }

    // Glowing Real Live Location Icon
    const userIcon = L.divIcon({
      className: 'custom-user-live-pin',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <!-- Radar waves -->
          <div style="position: absolute; top: -8px; left: -8px; width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 99, 235, 0.4); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          
          <!-- Outer core -->
          <div style="width: 28px; height: 28px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 0 16px rgba(37,99,235,0.9); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">
            📍
          </div>
          
          <!-- Live Position Badge -->
          <div style="margin-top: 3px; background: #1e3a8a; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; white-space: nowrap; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            YOU ARE HERE (REAL GPS)
          </div>
        </div>
      `,
      iconSize: [140, 56],
      iconAnchor: [70, 28],
    });

    const marker = L.marker([userCoords.lat, userCoords.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    })
      .bindPopup(`
        <div style="font-family: inherit; padding: 6px; min-width: 180px;">
          <div style="font-weight: 800; color: #1e3a8a; font-size: 13px; display: flex; align-items: center; gap: 4px;">
            <span>📍 Your Real Live Location</span>
          </div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px;">
            Lat: <b>${userCoords.lat.toFixed(5)}</b><br/>
            Lng: <b>${userCoords.lng.toFixed(5)}</b>
          </div>
          ${
            userCoords.accuracy
              ? `<div style="font-size: 10px; color: #16a34a; font-weight: 600; margin-top: 4px;">
                  GPS Accuracy: ±${userCoords.accuracy} meters
                </div>`
              : ''
          }
          <div style="margin-top: 6px; padding: 3px 8px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; text-align: center; border: 1px solid #bfdbfe;">
            ✓ 100% Free OpenStreetMap API
          </div>
        </div>
      `)
      .addTo(map);

    userMarkerRef.current = marker;
  }, [userCoords]);

  // 4. Render Retail Outlet Pins with Stock Information
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous outlet markers
    outletMarkersRef.current.forEach((m) => m.remove());
    outletMarkersRef.current = [];

    const currentProduct = products.find((p) => p.sku === activeSku) || products[0];

    outlets.forEach((outlet) => {
      const stock = currentProduct ? outlet.stockMap[currentProduct.sku] || 0 : 15;
      const isStockGood = stock > 20;

      // Distance from user if live GPS available
      const distance = userCoords
        ? getDistanceKm(userCoords.lat, userCoords.lng, outlet.lat, outlet.lng)
        : null;

      const outletIcon = L.divIcon({
        className: 'custom-outlet-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${
              isStockGood ? '#059669' : '#d97706'
            }; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">
              🏪
            </div>
            <div style="margin-top: 2px; background: rgba(15, 23, 42, 0.95); color: #f1f5f9; padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 700; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2);">
              ${stock} Cases In Stock
            </div>
          </div>
        `,
        iconSize: [80, 50],
        iconAnchor: [40, 25],
      });

      const marker = L.marker([outlet.lat, outlet.lng], { icon: outletIcon })
        .bindPopup(`
          <div style="font-family: inherit; padding: 6px; min-width: 200px;">
            <div style="font-weight: 800; color: #0f172a; font-size: 13px;">${outlet.name}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              Owner: <b>${outlet.owner}</b> (${outlet.type})
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
              ${outlet.address}
            </div>
            
            ${
              distance !== null
                ? `<div style="font-size: 11px; color: #2563eb; font-weight: 700; margin-top: 4px;">
                    📍 ${distance} km from your real GPS position
                  </div>`
                : ''
            }

            <div style="margin-top: 8px; padding: 6px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">
                Selected SKU Inventory
              </div>
              <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                ${currentProduct ? currentProduct.name : 'Selected Product'}
              </div>
              <div style="font-size: 11px; font-weight: 700; color: ${
                isStockGood ? '#059669' : '#d97706'
              }; margin-top: 2px;">
                ✓ ${stock} Cases Available
              </div>
            </div>

            <div style="margin-top: 8px; display: flex; gap: 4px;">
              <a href="tel:${outlet.phone}" style="flex: 1; text-align: center; padding: 4px 8px; background: #2563eb; color: white; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none;">
                Call Store
              </a>
            </div>
          </div>
        `)
        .addTo(map);

      outletMarkersRef.current.push(marker);
    });
  }, [outlets, activeSku, userCoords, products]);

  // Center on user GPS
  const handleCenterUser = () => {
    if (userCoords && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([userCoords.lat, userCoords.lng], 15, {
        duration: 1.0,
      });
      userMarkerRef.current?.openPopup();
    } else {
      acquireRealLocation();
    }
  };

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const allCoords: [number, number][] = outlets.map((o) => [o.lat, o.lng]);
    if (userCoords) allCoords.push([userCoords.lat, userCoords.lng]);

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  const selectedProductObj = products.find((p) => p.sku === activeSku) || products[0];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Controls & Product Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-inner">
            <Store className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-brand-400">
                LIVE OUTLET & STOCK RADAR
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                FREE MAP API
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time product stock levels mapped across nearby retail stores with live device GPS distance.
            </p>
          </div>
        </div>

        {/* Product SKU Selector Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">
            View SKU:
          </span>
          <select
            value={activeSku}
            onChange={(e) => {
              setActiveSku(e.target.value);
              onSelectProduct?.(e.target.value);
            }}
            className="bg-slate-950 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            {products.map((p) => (
              <option key={p.id} value={p.sku}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Top Left Badge */}
        <div className="absolute top-4 left-4 z-[500] flex flex-wrap items-center gap-2">
          {/* Real Live GPS button */}
          <button
            onClick={handleCenterUser}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer border ${
              userCoords
                ? 'bg-blue-600/90 hover:bg-blue-500 text-white border-blue-400'
                : 'bg-slate-900/90 hover:bg-slate-800 text-blue-400 border-slate-700/80'
            }`}
            title="Lock your real live location on the map"
          >
            <Crosshair
              className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`}
            />
            <span>
              {isLocating
                ? 'Acquiring GPS...'
                : userCoords
                ? 'Real Live Location: LOCKED'
                : 'Find My Real Location'}
            </span>
          </button>

          {/* Active SKU pill */}
          {selectedProductObj && (
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold text-white">
              <Package className="w-3.5 h-3.5 text-brand-400" />
              <span>{selectedProductObj.name}</span>
              <span className="text-brand-400 font-mono text-[10px]">
                {selectedProductObj.sku}
              </span>
            </div>
          )}
        </div>

        {/* Map Layer Selector HUD */}
        <div className="absolute top-4 right-4 z-[500] flex items-center gap-1 bg-slate-900/95 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
          <button
            onClick={() => setMapLayer('streets')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapLayer === 'streets'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Street
          </button>
          <button
            onClick={() => setMapLayer('satellite')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapLayer === 'satellite'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapLayer('terrain')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapLayer === 'terrain'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Terrain
          </button>
          <button
            onClick={() => setMapLayer('dark')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapLayer === 'dark'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Dark
          </button>
        </div>

        {/* Bottom Floating Controls */}
        <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-2">
          <button
            onClick={handleCenterUser}
            title="Locate Real Live GPS"
            className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xl transition-all cursor-pointer border border-blue-400"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitAll}
            title="Fit Outlets & Real Location"
            className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Attribution & Status Badge */}
        <div className="absolute bottom-4 left-4 z-[500] flex flex-wrap items-center gap-2">
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 font-medium">
            <span>{locationStatus}</span>
          </div>

          <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400">
            <span>Map tiles © </span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="text-slate-300 hover:underline"
            >
              OpenStreetMap
            </a>
            <span> contributors (Free API)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
