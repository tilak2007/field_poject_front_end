import React, { useEffect, useRef, useState } from "react";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  saveBeatPlan,
  getDailyBeatPlan,
  updateRetailerCoordinates,
  getGoogleMapsDirectionsUrl,
  BeatPlanRetailerItem,
} from "../../integrations/supabase/beats";
import { supabase } from "../../integrations/supabase/client";

export interface Retailer {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function BeatPlanningMap() {
  const { latitude: userLat, longitude: userLng, error: geoError, loading: geoLoading, getLocation } = useGeolocation();

  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [selectedPlanItems, setSelectedPlanItems] = useState<Retailer[]>([]);
  const [activeDate, setActiveDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const polylineLayerRef = useRef<any>(null);

  // 1. Fetch available retailers
  useEffect(() => {
    async function loadRetailers() {
      const { data, error } = await supabase
        .from("retailers")
        .select("id, name, code, address, phone, latitude, longitude")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setRetailers(data as Retailer[]);
      }
    }
    loadRetailers();
  }, []);

  // 2. Fetch existing beat plan for selected date
  useEffect(() => {
    async function loadPlan() {
      try {
        const plan = await getDailyBeatPlan(supabase, activeDate);
        if (plan.found && plan.items.length > 0) {
          const orderedRetailers: Retailer[] = plan.items.map((item: BeatPlanRetailerItem) => ({
            id: item.retailer_id,
            name: item.retailer_name,
            code: item.retailer_code,
            address: item.address,
            phone: item.phone,
            latitude: item.latitude,
            longitude: item.longitude,
          }));
          setSelectedPlanItems(orderedRetailers);
        } else {
          setSelectedPlanItems([]);
        }
      } catch (err) {
        console.error("Failed to load beat plan", err);
      }
    }
    loadPlan();
  }, [activeDate]);

  // 3. Dynamically load Leaflet (OpenStreetMap - 100% Free, No API Key Required)
  useEffect(() => {
    if ((window as any).L) {
      setLeafletReady(true);
      return;
    }

    // Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Leaflet JS
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // 4. Initialize Map Instance
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || leafletMapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const defaultCenter = userLat && userLng
      ? [userLat, userLng]
      : [28.6139, 77.2090]; // Default: New Delhi

    const map = L.map(mapContainerRef.current).setView(defaultCenter, 13);

    // OpenStreetMap free tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    polylineLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [leafletReady]);

  // 5. Update Map Markers & Route Polyline
  useEffect(() => {
    if (!leafletMapRef.current || !leafletReady) return;

    const L = (window as any).L;
    const map = leafletMapRef.current;
    const markersGroup = markersLayerRef.current;
    const polylineGroup = polylineLayerRef.current;

    markersGroup.clearLayers();
    polylineGroup.clearLayers();

    const boundsLatLngs: any[] = [];
    const routePoints: any[] = [];

    // Sales Rep Current Location Marker (Blue Glowing Dot)
    if (userLat && userLng) {
      const userLatLng = [userLat, userLng];
      routePoints.push(userLatLng);
      boundsLatLngs.push(userLatLng);

      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `
          <div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 8px rgba(37,99,235,0.8);"></div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker(userLatLng, { icon: userIcon })
        .addTo(markersGroup)
        .bindPopup("<strong>📍 Your Current Location (Sales Rep)</strong>");
    }

    // Numbered Stops in the Planned Beat Order
    selectedPlanItems.forEach((ret, index) => {
      if (ret.latitude && ret.longitude) {
        const storeLatLng = [ret.latitude, ret.longitude];
        routePoints.push(storeLatLng);
        boundsLatLngs.push(storeLatLng);

        const stopNumber = index + 1;
        const stopIcon = L.divIcon({
          className: "custom-stop-marker",
          html: `
            <div style="background-color: #ef4444; color: #ffffff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
              ${stopNumber}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const directionsUrl = getGoogleMapsDirectionsUrl(
          userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
          { latitude: ret.latitude, longitude: ret.longitude }
        );

        const popupContent = `
          <div style="font-family: sans-serif; min-width: 180px; padding: 4px;">
            <div style="font-size: 11px; color: #ef4444; font-weight: bold;">STOP #${stopNumber}</div>
            <strong style="font-size: 14px; color: #1f2937;">${ret.name}</strong>
            <p style="font-size: 12px; color: #6b7280; margin: 4px 0 8px 0;">${ret.address || "No address recorded"}</p>
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
              🗺️ Open in Google Maps
            </a>
          </div>
        `;

        L.marker(storeLatLng, { icon: stopIcon })
          .addTo(markersGroup)
          .bindPopup(popupContent);
      }
    });

    // Draw route polyline connecting planned stops
    if (routePoints.length > 1) {
      L.polyline(routePoints, {
        color: "#2563eb",
        weight: 4,
        opacity: 0.8,
        dashArray: "6, 6",
      }).addTo(polylineGroup);
    }

    // Zoom and pan map to fit all points
    if (boundsLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(boundsLatLngs), { padding: [50, 50] });
    }
  }, [selectedPlanItems, userLat, userLng, leafletReady]);

  // Reorder functions
  const moveUp = (index: number) => {
    if (index === 0) return;
    const items = [...selectedPlanItems];
    const temp = items[index - 1];
    items[index - 1] = items[index];
    items[index] = temp;
    setSelectedPlanItems(items);
  };

  const moveDown = (index: number) => {
    if (index === selectedPlanItems.length - 1) return;
    const items = [...selectedPlanItems];
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    setSelectedPlanItems(items);
  };

  const removeItem = (id: string) => {
    setSelectedPlanItems(selectedPlanItems.filter((i) => i.id !== id));
  };

  const addRetailerToPlan = (retailer: Retailer) => {
    if (!selectedPlanItems.some((i) => i.id === retailer.id)) {
      setSelectedPlanItems([...selectedPlanItems, retailer]);
    }
  };

  const handleSavePlan = async () => {
    setSavingPlan(true);
    setPlanMessage(null);
    try {
      await saveBeatPlan(supabase, {
        planDate: activeDate,
        title: `Beat Plan - ${activeDate}`,
        retailerIds: selectedPlanItems.map((r) => r.id),
      });
      setPlanMessage("Beat plan saved successfully!");
    } catch (err: any) {
      setPlanMessage(`Failed to save: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSetCurrentLocationForRetailer = async (retailerId: string) => {
    if (!userLat || !userLng) {
      alert("Please click 'Get My Location' first to obtain GPS coordinates.");
      return;
    }
    try {
      await updateRetailerCoordinates(supabase, retailerId, userLat, userLng);
      setRetailers((prev) =>
        prev.map((r) => (r.id === retailerId ? { ...r, latitude: userLat, longitude: userLng } : r))
      );
      setSelectedPlanItems((prev) =>
        prev.map((r) => (r.id === retailerId ? { ...r, latitude: userLat, longitude: userLng } : r))
      );
      alert("Store coordinates pinned to your current GPS position!");
    } catch (err: any) {
      alert(`Error updating location: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      {/* 1. Header & GPS Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Beat Planning & Route Map</h2>
          <p className="text-sm text-gray-500">Plan daily store visits with free interactive map & Google navigation</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={getLocation}
            disabled={geoLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center gap-2 transition"
          >
            {geoLoading ? "Locating..." : "📍 Get My Location"}
          </button>

          {userLat && userLng && (
            <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md">
              <strong>GPS:</strong> {userLat.toFixed(5)}, {userLng.toFixed(5)}
            </div>
          )}
        </div>
      </div>

      {geoError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {geoError}
        </div>
      )}

      {/* 2. Main Workspace: Beat Sequencing (Left) & Map (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Planned Route Sequencing */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Planned Route Stops</h3>
            <input
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          {planMessage && (
            <div
              className={`p-2 rounded text-xs ${
                planMessage.includes("success")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {planMessage}
            </div>
          )}

          {/* Planned Sequence List */}
          <div className="flex-1 overflow-y-auto max-h-80 flex flex-col gap-2">
            {selectedPlanItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No stores in today's beat plan.<br />Select stores below to add them to your route.
              </p>
            ) : (
              selectedPlanItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-6 h-6 flex-shrink-0 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-medium text-gray-800 truncate">{item.name}</div>
                      <div className="text-xs text-gray-500 truncate">{item.address || "No address"}</div>
                      {!item.latitude && (
                        <span className="text-xs text-amber-600 font-medium">⚠️ Missing GPS</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="px-1.5 py-0.5 border rounded text-xs hover:bg-gray-200 disabled:opacity-30"
                      title="Move earlier"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === selectedPlanItems.length - 1}
                      className="px-1.5 py-0.5 border rounded text-xs hover:bg-gray-200 disabled:opacity-30"
                      title="Move later"
                    >
                      ▼
                    </button>
                    {item.latitude && item.longitude && (
                      <a
                        href={getGoogleMapsDirectionsUrl(
                          userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
                          { latitude: item.latitude, longitude: item.longitude }
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded text-xs font-medium"
                        title="Open in Google Maps"
                      >
                        ↗
                      </a>
                    )}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-700 px-1 font-bold"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleSavePlan}
            disabled={savingPlan || selectedPlanItems.length === 0}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md text-sm font-semibold transition"
          >
            {savingPlan ? "Saving..." : "💾 Save Beat Plan"}
          </button>

          {/* Retailer Selector */}
          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Available Stores</h4>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
              {retailers
                .filter((r) => !selectedPlanItems.some((p) => p.id === r.id))
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 border border-dashed rounded text-xs hover:bg-gray-50"
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium text-gray-700">{r.name}</div>
                      <div className="text-gray-400 truncate">{r.address || "No address"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!r.latitude && userLat && userLng && (
                        <button
                          onClick={() => handleSetCurrentLocationForRetailer(r.id)}
                          className="px-2 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded"
                          title="Pin current GPS as store coordinates"
                        >
                          Pin GPS
                        </button>
                      )}
                      <button
                        onClick={() => addRetailerToPlan(r)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Column: 100% Free OpenStreetMap Container */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 flex items-center justify-between">
            <span>🗺️ <strong>Free OpenStreetMap</strong> (Zero API Key, No Billing Required)</span>
            <span className="text-blue-600">Click any stop to open Google Maps navigation</span>
          </div>
          <div ref={mapContainerRef} className="w-full flex-1 min-h-[480px]" style={{ minHeight: "480px" }} />
        </div>
      </div>
    </div>
  );
}
