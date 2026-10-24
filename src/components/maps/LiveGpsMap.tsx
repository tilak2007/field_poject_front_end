import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Radio,
} from 'lucide-react';
import type { RepLiveTelemetry, GeofencedOutlet } from '../../api/gpsApi';

interface LiveGpsMapProps {
  reps: RepLiveTelemetry[];
  geofencedOutlets: GeofencedOutlet[];
  selectedRepId: string | null;
  onSelectRep: (repId: string) => void;
  myDeviceCoords?: { lat: number; lng: number; accuracy?: number } | null;
  showTrails?: boolean;
  showGeofences?: boolean;
}

type MapLayerType = 'streets' | 'satellite' | 'dark';

export const LiveGpsMap: React.FC<LiveGpsMapProps> = ({
  reps,
  geofencedOutlets,
  selectedRepId,
  onSelectRep,
  myDeviceCoords,
  showTrails = true,
  showGeofences = true,
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

  // Tile layers definition
  const getTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'streets':
      default:
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Delhi-NCR default territory
    const initialCenter: [number, number] = [28.685, 77.145];
    const initialZoom = 12;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    const tileLayer = L.tileLayer(getTileUrl('streets'), {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Change Tile Layer Style
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getTileUrl(mapLayer));
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
          <div style="background-color: #047857; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid white; font-size: 10px; font-weight: bold;">
            🏪
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const storeMarker = L.marker([outlet.coords.lat, outlet.coords.lng], { icon: storeIcon })
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
      const statusColor = isAtStore ? '#10b981' : isMoving ? '#0284c7' : '#f59e0b';

      // Custom animated HTML Marker
      const customIcon = L.divIcon({
        className: 'custom-rep-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <!-- Radar pulsing waves -->
            <div style="position: absolute; top: -6px; left: -6px; width: 44px; height: 44px; border-radius: 50%; background: ${statusColor}33; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            
            <!-- Avatar Circle -->
            <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; border: 3px solid ${isSelected ? '#fbbf24' : 'white'}; box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; background: #1e293b;">
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
        const marker = L.marker([rep.coords.lat, rep.coords.lng], { icon: customIcon })
          .on('click', () => {
            onSelectRep(rep.id);
          })
          .addTo(map);

        markersRef.current[rep.id] = marker;
      }

      // Draw Daily GPS Breadcrumb Trail if enabled or if rep is selected
      if (showTrails && rep.dailyTrail && rep.dailyTrail.length > 1) {
        const trailPoints = rep.dailyTrail.map((t) => [t.lat, t.lng] as [number, number]);
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
        map.panTo([selectedRep.coords.lat, selectedRep.coords.lng], { animate: true, duration: 0.8 });
      }
    }
  }, [reps, selectedRepId, showTrails, autoFollow, onSelectRep]);

  // 5. Render Real Device GPS Coords
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

    // Accuracy Circle
    if (myDeviceCoords.accuracy) {
      const circle = L.circle([myDeviceCoords.lat, myDeviceCoords.lng], {
        radius: myDeviceCoords.accuracy,
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(map);
      myAccuracyCircleRef.current = circle;
    }

    // Glowing User Device Marker
    const deviceIcon = L.divIcon({
      className: 'custom-my-device-marker',
      html: `
        <div style="position: relative; width: 22px; height: 22px;">
          <div style="position: absolute; top: -7px; left: -7px; width: 36px; height: 36px; border-radius: 50%; background: #3b82f655; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 22px; height: 22px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker([myDeviceCoords.lat, myDeviceCoords.lng], { icon: deviceIcon })
      .bindPopup(`
        <div style="font-family: inherit; font-size: 12px; font-weight: bold; color: #1e3a8a;">
          📍 Your Device Live GPS<br/>
          <span style="font-size: 10px; font-weight: normal; color: #475569;">
            Lat: ${myDeviceCoords.lat.toFixed(5)}, Lng: ${myDeviceCoords.lng.toFixed(5)}
          </span>
        </div>
      `)
      .addTo(map);

    myLocationMarkerRef.current = marker;
  }, [myDeviceCoords]);

  // Handle Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const allCoords: [number, number][] = reps.map((r) => [r.coords.lat, r.coords.lng]);
    if (myDeviceCoords) allCoords.push([myDeviceCoords.lat, myDeviceCoords.lng]);

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-2xl">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[520px] z-0" />

      {/* Floating Top Controls HUD */}
      <div className="absolute top-4 left-4 z-[500] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs font-semibold text-white">
        <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
        <span>Live Radar Engine</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-slate-400 text-[11px]">{reps.length} Reps Monitored</span>
      </div>

      {/* Map Style Selector HUD */}
      <div className="absolute top-4 right-4 z-[500] flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
        <button
          onClick={() => setMapLayer('streets')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            mapLayer === 'streets' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
          }`}
        >
          Street
        </button>
        <button
          onClick={() => setMapLayer('satellite')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            mapLayer === 'satellite' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapLayer('dark')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            mapLayer === 'dark' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
          }`}
        >
          Dark
        </button>
      </div>

      {/* Bottom Floating Controls */}
      <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitAll}
          title="Fit All Fleet on Map"
          className="p-2.5 bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700/80 rounded-xl shadow-lg transition-all"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-Follow Toggle */}
      <div className="absolute bottom-4 left-4 z-[500] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-lg text-xs font-semibold text-white">
        <button
          onClick={() => setAutoFollow(!autoFollow)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${
            autoFollow ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
          }`}
        >
          <Crosshair className={`w-3.5 h-3.5 ${autoFollow ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Auto-Center Selected</span>
        </button>
      </div>
    </div>
  );
};
