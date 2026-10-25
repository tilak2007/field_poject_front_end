import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Radio,
  Compass,
} from 'lucide-react';
import type { RepLiveTelemetry, GeofencedOutlet } from '../../api/gpsApi';
import { acquireLiveLocation, type GeoLocationResult } from '../../utils/geolocation';

export interface LiveGpsMapProps {
  reps: RepLiveTelemetry[];
  geofencedOutlets: GeofencedOutlet[];
  selectedRepId: string | null;
  onSelectRep: (repId: string) => void;
  myDeviceCoords?: { lat: number; lng: number; accuracy?: number } | null;
  showTrails?: boolean;
  showGeofences?: boolean;
  onLocateMe?: () => void;
  isLocating?: boolean;
}

export type MapLayerType = 'streets' | 'satellite' | 'dark' | 'humanitarian';

export const LiveGpsMap: React.FC<LiveGpsMapProps> = ({
  reps,
  geofencedOutlets,
  selectedRepId,
  onSelectRep,
  myDeviceCoords,
  showTrails = true,
  showGeofences = true,
  onLocateMe,
  isLocating = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const geofenceCirclesRef = useRef<L.Circle[]>([]);
  const trailPolylinesRef = useRef<L.Polyline[]>([]);
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const myAccuracyCircleRef = useRef<L.Circle | null>(null);

  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [autoFollow, setAutoFollow] = useState(true);
  const [internalLocating, setInternalLocating] = useState(false);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  const [liveGpsLabel, setLiveGpsLabel] = useState<string>('Free Map API Active');

  // 100% Free Tile Layers (NO API KEY REQUIRED, NO WATERMARKS)
  const getTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'humanitarian':
        return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      case 'dark':
      case 'streets':
      default:
        // OpenStreetMap Standard - 100% Free Public Map Server
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on default territory or user coords if already available
    const initialCenter: [number, number] = myDeviceCoords
      ? [myDeviceCoords.lat, myDeviceCoords.lng]
      : [28.685, 77.145];
    const initialZoom = myDeviceCoords ? 15 : 12;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
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

    // Fix container size on mount to prevent gray/blank screen
    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 600);

    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Change Tile Layer Style & Dark Filter (Zero Watermark Free Layer)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getTileUrl(mapLayer));

    // Apply dark mode CSS inversion filter on standard OSM tiles for clean dark theme without Carto watermark
    const container = tileLayerRef.current.getContainer();
    if (container) {
      if (mapLayer === 'dark') {
        container.style.filter =
          'invert(100%) hue-rotate(180deg) brightness(92%) contrast(92%)';
      } else {
        container.style.filter = 'none';
      }
    }
    mapInstanceRef.current.invalidateSize();
  }, [mapLayer]);

  // 3. Render Geofence Circles around Retailers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old geofence circles
    geofenceCirclesRef.current.forEach((c) => c.remove());
    geofenceCirclesRef.current = [];

    if (!showGeofences) return;

    geofencedOutlets.forEach((outlet) => {
      const circle = L.circle([outlet.coords.lat, outlet.coords.lng], {
        radius: outlet.geofenceRadiusMeters,
        color: '#10b981',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#10b981',
        fillOpacity: 0.12,
      }).addTo(map);

      // Store marker pin inside circle
      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="background-color: #047857; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white; font-size: 11px; font-weight: bold;">
            🏪
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const storeMarker = L.marker([outlet.coords.lat, outlet.coords.lng], {
        icon: storeIcon,
      })
        .bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-weight: 800; color: #0f172a; font-size: 13px;">${outlet.name}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">Owner: ${outlet.ownerName} (${outlet.type})</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${outlet.address}</div>
            <div style="margin-top: 6px; display: inline-block; padding: 2px 8px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 700;">
              Geofence Radius: ${outlet.geofenceRadiusMeters}m
            </div>
          </div>
        `)
        .addTo(map);

      geofenceCirclesRef.current.push(circle);
      geofenceCirclesRef.current.push(storeMarker as any);
    });
  }, [geofencedOutlets, showGeofences]);

  // 4. Update Rep Markers and Daily Trails
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old polylines
    trailPolylinesRef.current.forEach((p) => p.remove());
    trailPolylinesRef.current = [];

    // Track active marker keys
    const currentRepIds = new Set(reps.map((r) => r.id));

    // Remove markers for removed reps
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentRepIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    reps.forEach((rep) => {
      const isSelected = selectedRepId === rep.id;
      const isMoving = rep.status === 'Moving';
      const isAtStore = rep.status === 'At Store';

      // Status indicator color
      const statusColor = isAtStore
        ? '#10b981'
        : isMoving
        ? '#0284c7'
        : '#f59e0b';

      // Custom animated HTML Marker
      const customIcon = L.divIcon({
        className: 'custom-rep-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <!-- Radar pulsing waves -->
            <div style="position: absolute; top: -6px; left: -6px; width: 44px; height: 44px; border-radius: 50%; background: ${statusColor}33; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            
            <!-- Avatar Circle -->
            <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; border: 3px solid ${
              isSelected ? '#fbbf24' : 'white'
            }; box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; background: #1e293b;">
              <img src="${rep.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="${rep.name}" />
            </div>

            <!-- Status Dot -->
            <div style="position: absolute; bottom: 12px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; border: 1.5px solid white;"></div>

            <!-- Name Label Pill -->
            <div style="margin-top: 2px; background: rgba(15, 23, 42, 0.9); color: white; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              ${rep.name.split(' ')[0]} ${isMoving ? `• ${rep.speedKmH}km/h` : ''}
            </div>
          </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 24],
      });

      if (markersRef.current[rep.id]) {
        // Smoothly animate marker position
        markersRef.current[rep.id].setLatLng([rep.coords.lat, rep.coords.lng]);
        markersRef.current[rep.id].setIcon(customIcon);
      } else {
        // Create new marker
        const marker = L.marker([rep.coords.lat, rep.coords.lng], {
          icon: customIcon,
        })
          .on('click', () => {
            onSelectRep(rep.id);
          })
          .addTo(map);

        markersRef.current[rep.id] = marker;
      }

      // Draw Daily GPS Breadcrumb Trail if enabled or if rep is selected
      if (showTrails && rep.dailyTrail && rep.dailyTrail.length > 1) {
        const trailPoints = rep.dailyTrail.map(
          (t) => [t.lat, t.lng] as [number, number]
        );
        trailPoints.push([rep.coords.lat, rep.coords.lng]);

        const polyline = L.polyline(trailPoints, {
          color: isSelected ? '#38bdf8' : '#94a3b8',
          weight: isSelected ? 3.5 : 2,
          dashArray: isSelected ? undefined : '5, 5',
          opacity: isSelected ? 0.9 : 0.45,
        }).addTo(map);

        trailPolylinesRef.current.push(polyline);
      }
    });

    // Auto-center on selected rep if enabled
    if (autoFollow && selectedRepId && markersRef.current[selectedRepId]) {
      const selectedRep = reps.find((r) => r.id === selectedRepId);
      if (selectedRep) {
        map.panTo([selectedRep.coords.lat, selectedRep.coords.lng], {
          animate: true,
          duration: 0.8,
        });
      }
    }
  }, [reps, selectedRepId, showTrails, autoFollow, onSelectRep]);

  // 5. Render Real Live Device GPS Coordinates with Pulsing Radar
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.remove();
      myLocationMarkerRef.current = null;
    }
    if (myAccuracyCircleRef.current) {
      myAccuracyCircleRef.current.remove();
      myAccuracyCircleRef.current = null;
    }

    if (!myDeviceCoords) return;

    // High-accuracy GPS circle
    if (myDeviceCoords.accuracy) {
      const circle = L.circle([myDeviceCoords.lat, myDeviceCoords.lng], {
        radius: myDeviceCoords.accuracy,
        color: '#2563eb',
        weight: 1.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(map);
      myAccuracyCircleRef.current = circle;
    }

    // Glowing Real Live Location User Pin
    const deviceIcon = L.divIcon({
      className: 'custom-my-device-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <!-- Multi-ring pulsing radar wave -->
          <div style="position: absolute; top: -8px; left: -8px; width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 99, 235, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          
          <!-- Outer core -->
          <div style="width: 28px; height: 28px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 0 16px rgba(37,99,235,0.9); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">
            📍
          </div>
          
          <!-- Live Position Badge -->
          <div style="margin-top: 3px; background: #1e3a8a; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; white-space: nowrap; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 2px 6px rgba(0,0,0,0.4); letter-spacing: 0.02em;">
            YOU ARE HERE (REAL GPS)
          </div>
        </div>
      `,
      iconSize: [140, 56],
      iconAnchor: [70, 28],
    });

    const marker = L.marker([myDeviceCoords.lat, myDeviceCoords.lng], {
      icon: deviceIcon,
      zIndexOffset: 1000,
    })
      .bindPopup(`
        <div style="font-family: inherit; padding: 6px; min-width: 180px;">
          <div style="font-weight: 800; color: #1e3a8a; font-size: 13px; display: flex; align-items: center; gap: 4px;">
            <span>📍 Real Device Live Location</span>
          </div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px;">
            Lat: <b>${myDeviceCoords.lat.toFixed(5)}</b><br/>
            Lng: <b>${myDeviceCoords.lng.toFixed(5)}</b>
          </div>
          ${
            myDeviceCoords.accuracy
              ? `<div style="font-size: 10px; color: #16a34a; font-weight: 600; margin-top: 4px;">
                  GPS Accuracy: ±${myDeviceCoords.accuracy} meters
                </div>`
              : ''
          }
          <div style="margin-top: 6px; padding: 3px 8px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; text-align: center; border: 1px solid #bfdbfe;">
            ✓ Free OpenStreetMap API Verified
          </div>
        </div>
      `)
      .addTo(map);

    myLocationMarkerRef.current = marker;

    // Automatically fly to user's real live location on first fix
    if (!hasInitialCentered) {
      map.invalidateSize();
      map.flyTo([myDeviceCoords.lat, myDeviceCoords.lng], 15, {
        duration: 1.2,
      });
      setHasInitialCentered(true);
    }
  }, [myDeviceCoords, hasInitialCentered]);

  // Handle Locate Me (Browser Geolocation with multi-tier fallback)
  const handleLocateMeClick = () => {
    if (onLocateMe) {
      onLocateMe();
      return;
    }

    setInternalLocating(true);
    acquireLiveLocation(
      (loc: GeoLocationResult) => {
        setInternalLocating(false);
        const map = mapInstanceRef.current;
        if (map) {
          map.invalidateSize();
          map.flyTo([loc.lat, loc.lng], 16, { duration: 1.2 });
        }
        setLiveGpsLabel(`Real Location: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
      },
      (status) => {
        setLiveGpsLabel(status);
      }
    );
  };

  // Center on User Coordinates
  const handleCenterOnUser = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();
    if (myDeviceCoords) {
      map.flyTo([myDeviceCoords.lat, myDeviceCoords.lng], 16, {
        duration: 1.0,
      });
      myLocationMarkerRef.current?.openPopup();
    } else {
      handleLocateMeClick();
    }
  };

  // Handle Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
    const allCoords: [number, number][] = reps.map((r) => [
      r.coords.lat,
      r.coords.lng,
    ]);
    if (myDeviceCoords)
      allCoords.push([myDeviceCoords.lat, myDeviceCoords.lng]);

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 14,
      });
    }
  };

  const locatingActive = isLocating || internalLocating;

  return (
    <div className="relative w-full h-[520px] min-h-[520px] rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-2xl">
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '520px', minHeight: '520px' }}
        className="w-full h-[520px] z-0"
      />

      {/* Floating Top Controls HUD */}
      <div className="absolute top-4 left-4 z-[500] flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs font-semibold text-white">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Live Radar Engine</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400 text-[11px]">
            {reps.length} Reps Monitored
          </span>
        </div>

        {/* Real Live GPS Lock Indicator */}
        <button
          onClick={handleCenterOnUser}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer border ${
            myDeviceCoords
              ? 'bg-blue-600/90 hover:bg-blue-500 text-white border-blue-400'
              : 'bg-slate-900/90 hover:bg-slate-800 text-blue-400 border-slate-700/80'
          }`}
          title={
            myDeviceCoords
              ? `Real Live GPS locked: ${myDeviceCoords.lat}, ${myDeviceCoords.lng}. Click to center!`
              : 'Click to acquire Real Live Device GPS'
          }
        >
          <Compass
            className={`w-3.5 h-3.5 ${
              locatingActive ? 'animate-spin' : myDeviceCoords ? 'text-white' : 'text-blue-400'
            }`}
          />
          <span>
            {locatingActive
              ? 'Locking GPS...'
              : myDeviceCoords
              ? 'Real Live Location: LOCKED'
              : 'Find Real Location'}
          </span>
        </button>

        {/* Free Map API Badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Free OpenStreetMap API (Direct Browser GPS)</span>
        </div>
      </div>

      {/* Map Style Selector HUD */}
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
          onClick={() => setMapLayer('humanitarian')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mapLayer === 'humanitarian'
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
        {/* Real Live GPS Center Button */}
        <button
          onClick={handleCenterOnUser}
          title="Center on My Real Live Device GPS"
          className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xl transition-all cursor-pointer border border-blue-400"
        >
          <Crosshair className={`w-4 h-4 ${locatingActive ? 'animate-spin' : ''}`} />
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
          title="Fit All Fleet & Real Location on Map"
          className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-Follow Toggle & Attribution */}
      <div className="absolute bottom-4 left-4 z-[500] flex flex-wrap items-center gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-lg text-xs font-semibold text-white">
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all cursor-pointer ${
              autoFollow
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400'
            }`}
          >
            <Crosshair
              className={`w-3.5 h-3.5 ${
                autoFollow ? 'animate-spin text-emerald-400' : ''
              }`}
            />
            <span>Auto-Center Selected</span>
          </button>
        </div>

        {/* Free Map Attribution Badge */}
        <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-400">
          <span>{liveGpsLabel} • Map tiles © </span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="text-slate-300 hover:underline"
          >
            OpenStreetMap
          </a>
        </div>
      </div>
    </div>
  );
};
