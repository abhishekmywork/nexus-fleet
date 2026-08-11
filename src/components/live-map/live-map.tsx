"use client";

import * as React from "react";
import { useState, useRef, useCallback } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-polylinedecorator";
import proj4 from "proj4";
import { useLiveMap, LivePosition } from "@/hooks/use-live-map";
import { VehicleSidebar } from "./vehicle-sidebar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Geofence, TrailPoint } from "@/lib/auth-types";
import { ChevronRight, Map, Satellite, Mountain, Layers } from "lucide-react";

type MapMode = "standard" | "satellite" | "terrain" | "hybrid";

const MAP_LAYERS: Record<MapMode, { url: string; attribution: string }[]> = {
  standard: [
    { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap" },
  ],
  satellite: [
    { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "&copy; Esri" },
  ],
  terrain: [
    { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenTopoMap" },
    { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "" },
  ],
  hybrid: [
    { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "&copy; Esri" },
    { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", attribution: "" },
  ],
};

const MAP_MODE_ICONS: Record<MapMode, React.ReactNode> = {
  standard: <Map className="size-3.5" />,
  satellite: <Satellite className="size-3.5" />,
  terrain: <Mountain className="size-3.5" />,
  hybrid: <Layers className="size-3.5" />,
};

const MAP_MODE_LABELS: Record<MapMode, string> = {
  standard: "Standard",
  satellite: "Satellite",
  terrain: "Terrain",
  hybrid: "Hybrid",
};

// UTM Zone 45N (covers West Bengal/East India) → WGS84
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");

/** Transform a coordinate to [lat, lon]. If already WGS84, returns as-is. */
function toLatLng(
  lat: number,
  lon: number
): [number, number] {
  if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lat, lon];
  const [x, y] = proj4("EPSG:32645", "WGS84", [lon, lat]);
  return [y, x];
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]; // Delhi

/** Imperatively adds/removes tile layers when map mode changes, avoiding Leaflet container reuse. */
function MapLayerManager({ mapMode }: { mapMode: MapMode }) {
  const map = useMap();
  const layerRefs = React.useRef<L.TileLayer[]>([]);

  React.useEffect(() => {
    // Remove previous layers
    for (const layer of layerRefs.current) {
      map.removeLayer(layer);
    }
    layerRefs.current = [];

    // Add new layers
    for (const cfg of MAP_LAYERS[mapMode]) {
      const layer = L.tileLayer(cfg.url, { attribution: cfg.attribution }).addTo(map);
      layerRefs.current.push(layer);
    }
  }, [mapMode, map]);

  return null;
}

/** Fits map to geofences first, then vehicle positions as fallback — refits when toggle changes. */
function FitBounds({
  positions,
  geofences,
  showGeofences,
}: {
  positions: LivePosition[];
  geofences: Geofence[];
  showGeofences: boolean;
}) {
  const map = useMap();
  const lastFittedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Build a key from current state so we refit when geofence toggle changes
    const gfCount = showGeofences ? geofences.filter((g) => g.enabled).length : 0;
    const key = `${gfCount}-${positions.length}`;
    if (lastFittedRef.current === key) return;

    // Collect all lat/lng points from enabled geofences
    const geofencePoints: [number, number][] = [];
    if (showGeofences) {
      for (const gf of geofences) {
        if (!gf.enabled) continue;
        if (gf.type === "circle" && gf.coordinates?.center) {
          const [lat, lon] = toLatLng(gf.coordinates.center.lat, gf.coordinates.center.lon);
          geofencePoints.push([lat, lon]);
        }
        if (gf.type === "polygon" && gf.coordinates?.points) {
          for (const p of gf.coordinates.points) {
            const [lat, lon] = toLatLng(p.lat, p.lon);
            geofencePoints.push([lat, lon]);
          }
        }
      }
    }

    // Prefer geofences, fall back to vehicle positions
    const points = geofencePoints.length > 0
      ? geofencePoints
      : positions.map((p) => [p.latitude, p.longitude] as [number, number]);

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    lastFittedRef.current = key;
  }, [positions, geofences, showGeofences, map]);

  return null;
}

function calcDistance(points: TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371;
    const dLat = ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180;
    const dLon = ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((points[i - 1].latitude * Math.PI) / 180) *
        Math.cos((points[i].latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function createCircleIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "trail-endpoint",
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:14px;height:14px;border-radius:50%;
          background:${color};border:2.5px solid #fff;
          box-shadow:0 0 6px ${color};
        "></div>
        <span style="
          position:absolute;top:-20px;left:50%;transform:translateX(-50%);
          background:#171717;color:#fff;font-size:9px;font-weight:600;
          padding:1px 5px;border-radius:3px;white-space:nowrap;
          box-shadow:0 1px 3px rgba(0,0,0,.4);
        ">${label}</span>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Renders a highlighted polyline trail with glow, arrows, start/end markers, and stats popup. */
function TrailLine({ points }: { points: TrailPoint[] }) {
  const map = useMap();

  React.useEffect(() => {
    if (points.length < 2) return;

    const latLngs = points.map(
      (p) => [p.latitude, p.longitude] as [number, number]
    );

    // --- Glow polyline (wider, transparent) ---
    const glow = L.polyline(latLngs, {
      color: "#fb923c",
      weight: 10,
      opacity: 0.25,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // --- Main polyline ---
    const mainLine = L.polyline(latLngs, {
      color: "#f97316",
      weight: 4,
      opacity: 1,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // --- Direction arrows (larger, filled) ---
    const LDecor = (L as any);
    const decorator = LDecor.polylineDecorator(mainLine, {
      patterns: [
        {
          offset: "5%",
          repeat: "12%",
          symbol: LDecor.Symbol?.arrowHead({
            pixelSize: 14,
            polygon: true,
            pathOptions: {
              color: "#c2410c",
              fillColor: "#f97316",
              fillOpacity: 1,
              weight: 0,
            },
          }) ?? { pixelSize: 14 },
        },
      ],
    }).addTo(map);

    // --- Start marker (green) ---
    const startTime = new Date(points[0].timestamp);
    const startLabel = startTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const startMarker = L.marker(latLngs[0], {
      icon: createCircleIcon("#22c55e", startLabel),
    }).addTo(map);

    // --- End marker (red) ---
    const endTime = new Date(points[points.length - 1].timestamp);
    const endLabel = endTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endMarker = L.marker(latLngs[latLngs.length - 1], {
      icon: createCircleIcon("#ef4444", endLabel),
    }).addTo(map);

    // --- Trail stats popup on line click ---
    const distance = calcDistance(points);
    const durationMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const avgSpeed = hours > 0 ? distance / (durationMs / 3600000) : 0;

    const statsHtml = `
      <div style="font-size:12px;line-height:1.5;min-width:140px">
        <div style="font-weight:700;margin-bottom:4px">Today's Trail</div>
        <div>${points[0].timestamp.split("T")[0]}</div>
        <div><b>${distance.toFixed(2)}</b> km total</div>
        <div><b>${hours}h ${minutes}m</b> duration</div>
        <div><b>${avgSpeed.toFixed(1)}</b> km/h avg</div>
        <div style="margin-top:4px;font-size:10px;color:#6b7280">
          ${points.length} GPS points
        </div>
      </div>
    `;
    mainLine.bindPopup(statsHtml);
    glow.on("click", () => mainLine.openPopup());

    // --- Fit map to trail ---
    map.fitBounds(mainLine.getBounds(), { padding: [50, 50] });

    return () => {
      map.removeLayer(decorator);
      map.removeLayer(mainLine);
      map.removeLayer(glow);
      map.removeLayer(startMarker);
      map.removeLayer(endMarker);
      mainLine.closePopup();
    };
  }, [points, map]);

  return null;
}

function formatSpeed(speed: number | null): string {
  if (speed == null) return "N/A";
  return `${parseFloat(speed.toFixed(2))} km/h`;
}

function createVehicleIcon(plateNumber: string | null, movement: string | null): L.DivIcon {
  const color =
    movement === "MOVING" ? "#22c55e" :
    movement === "STOPPED" ? "#f97316" :
    "#64748b";
  const glow =
    movement === "MOVING" ? "rgba(34,197,94,0.5)" :
    movement === "STOPPED" ? "rgba(249,115,22,0.4)" :
    "rgba(100,116,139,0.3)";
  return L.divIcon({
    className: "vehicle-marker",
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:12px;height:12px;border-radius:50%;
          background:${color};border:2px solid #fff;
          box-shadow:0 0 0 2px ${color}, 0 0 8px ${glow};
        "></div>
        <div style="
          width:2px;height:4px;background:${color};border-radius:0 0 1px 1px;
          box-shadow:0 0 4px ${glow};
        "></div>
        ${plateNumber ? `<span style="
          position:absolute;top:-20px;left:50%;transform:translateX(-50%);
          background:${color};color:#fff;font-size:8px;font-weight:700;
          padding:1px 5px;border-radius:3px;white-space:nowrap;
          letter-spacing:0.4px;pointer-events:none;
          box-shadow:0 1px 4px rgba(0,0,0,.3);
        ">${plateNumber}</span>` : ""}
      </div>
    `,
    iconSize: [14, 16],
    iconAnchor: [7, 16],
  });
}

interface LiveMapProps {
  initialPositions: LivePosition[];
  token: string;
}

export function LiveMap({ initialPositions, token }: LiveMapProps) {
  const { positions, connected, setInitialPositions } = useLiveMap(token);
  const [visibleVehicles, setVisibleVehicles] = useState<Set<string>>(new Set());
  const [showGeofences, setShowGeofences] = useState(true);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("live-map-mode");
      if (saved && ["standard", "satellite", "terrain", "hybrid"].includes(saved)) {
        return saved as MapMode;
      }
    }
    return "standard";
  });

  const handleMapModeChange = useCallback((mode: MapMode) => {
    setMapMode(mode);
    localStorage.setItem("live-map-mode", mode);
  }, []);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);

  // Merge initial positions
  React.useEffect(() => {
    if (initialPositions.length > 0) {
      setInitialPositions(initialPositions);
      setVisibleVehicles(new Set(initialPositions.map((p) => p.deviceId)));
    }
  }, [initialPositions, setInitialPositions]);

  // Load geofences
  React.useEffect(() => {
    api.geofences.list().then(setGeofences).catch(() => {});
  }, []);

  // Close map mode menu on outside click
  React.useEffect(() => {
    if (!modeMenuOpen) return;
    const handler = () => setModeMenuOpen(false);
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, [modeMenuOpen]);

  // Fetch trail when selected vehicle changes
  const selectVehicle = useCallback(async (deviceId: string) => {
    if (selectedDeviceId === deviceId) {
      setSelectedDeviceId(null);
      setTrail([]);
      return;
    }
    setSelectedDeviceId(deviceId);
    // Close sidebar on mobile so user can see the trail
    if (window.innerWidth < 768) setSidebarOpen(false);
    setTrailLoading(true);
    try {
      const data = await api.telemetry.trail(deviceId);
      setTrail(data);
    } catch {
      setTrail([]);
    } finally {
      setTrailLoading(false);
    }
  }, [selectedDeviceId]);

  const toggleVehicle = useCallback((deviceId: string) => {
    setVisibleVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setVisibleVehicles(new Set(Array.from(positions.keys())));
  }, [positions]);

  const hideAll = useCallback(() => {
    setVisibleVehicles(new Set());
  }, []);

  const allPositions = Array.from(positions.values());
  const visiblePositions = allPositions.filter((p) => visibleVehicles.has(p.deviceId));

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[998] bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — overlay on mobile, inline on desktop */}
      {sidebarOpen && (
        <div
          className={cn(
            "shrink-0 border-r bg-background z-[999]",
            "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-72 max-md:shadow-xl",
            "md:relative md:block"
          )}
        >
          <VehicleSidebar
            positions={allPositions}
            visibleVehicles={visibleVehicles}
            selectedDeviceId={selectedDeviceId}
            onToggle={toggleVehicle}
            onSelect={selectVehicle}
            onShowAll={showAll}
            onHideAll={hideAll}
            showGeofences={showGeofences}
            onToggleGeofences={() => setShowGeofences((p) => !p)}
            open={sidebarOpen}
            onToggleOpen={() => setSidebarOpen((p) => !p)}
          />
        </div>
      )}

      {/* Map — fills remaining space */}
      <div className="relative flex-1">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <MapLayerManager mapMode={mapMode} />

          <FitBounds positions={visiblePositions} geofences={geofences} showGeofences={showGeofences} />

          {trail.length >= 2 && <TrailLine points={trail} />}

          {visiblePositions.map((pos) => (
            <Marker
              key={pos.deviceId}
              position={[pos.latitude, pos.longitude]}
              icon={createVehicleIcon(pos.plateNumber, pos.movement)}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1 text-sm">
                  <p className="font-semibold">{pos.plateNumber ?? "Unknown"}</p>
                  <p>Speed: {formatSpeed(pos.speed)}</p>
                  <p>Ignition: {pos.ignition ?? "N/A"}</p>
                  <p>Lat: {pos.latitude.toFixed(6)}</p>
                  <p>Lng: {pos.longitude.toFixed(6)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(pos.timestamp).toLocaleString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {showGeofences && geofences.filter((gf) => gf.enabled).map((gf) => {
            if (gf.type === "circle") {
              const center = gf.coordinates?.center;
              const radius = gf.coordinates?.radiusMeters;
              if (!center || !radius) return null;
              const [lat, lon] = toLatLng(center.lat, center.lon);
              return (
                <Circle
                  key={gf.id}
                  center={[lat, lon]}
                  radius={radius}
                  pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 2 }}
                />
              );
            }
            if (gf.type === "polygon") {
              const points = gf.coordinates?.points;
              if (!points || !Array.isArray(points) || points.length < 3) return null;
              return (
                <Polygon
                  key={gf.id}
                  positions={points.map((p: { lat: number; lon: number }) => toLatLng(p.lat, p.lon))}
                  pathOptions={{ color: "#8b5cf6", fillColor: "#8b5cf6", fillOpacity: 0.1, weight: 2 }}
                />
              );
            }
            return null;
          })}
        </MapContainer>

        {/* Reopen sidebar button — shown when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-lg border bg-background/90 shadow-sm backdrop-blur hover:bg-accent md:h-10 md:w-10"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* Map mode switcher */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] max-md:top-16">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setModeMenuOpen((p) => !p); }}
              className="flex items-center gap-1.5 rounded-lg border bg-background/90 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent md:py-1.5"
            >
              {MAP_MODE_ICONS[mapMode]}
              <span className="hidden sm:inline">{MAP_MODE_LABELS[mapMode]}</span>
            </button>
            {modeMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 rounded-lg border bg-background p-1 shadow-lg">
                {(Object.keys(MAP_LAYERS) as MapMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { handleMapModeChange(mode); setModeMenuOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      mapMode === mode ? "bg-accent font-medium" : "hover:bg-accent/50"
                    )}
                  >
                    {MAP_MODE_ICONS[mode]}
                    {MAP_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connection indicator — floating on map */}
        <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 rounded-lg border bg-background/90 px-2.5 py-1.5 shadow-sm backdrop-blur md:px-3">
          <div className={`size-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs font-medium">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
