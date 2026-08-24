"use client";

import * as React from "react";
import { useState, useRef, useCallback } from "react";
import {
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import proj4 from "proj4";
import { useLiveMap, LivePosition } from "@/hooks/use-live-map";
import { useVehicleAnimation } from "@/hooks/use-vehicle-animation";
import { VehicleMarker } from "@/components/vehicle-marker";
import { VehicleSidebar } from "./vehicle-sidebar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Geofence, TrailPoint } from "@/lib/auth-types";
import {
  ChevronRight,
  MapIcon,
  Satellite,
  Mountain,
  Layers,
  X,
  Route,
} from "lucide-react";

type MapMode = "standard" | "satellite" | "terrain" | "hybrid";

let MAP_MODE_TYPES: Record<MapMode, google.maps.MapTypeId> | null = null;
function getMapModeTypes(): Record<MapMode, google.maps.MapTypeId> {
  if (!MAP_MODE_TYPES) {
    MAP_MODE_TYPES = {
      standard: google.maps.MapTypeId.ROADMAP,
      satellite: google.maps.MapTypeId.SATELLITE,
      terrain: google.maps.MapTypeId.TERRAIN,
      hybrid: google.maps.MapTypeId.HYBRID,
    };
  }
  return MAP_MODE_TYPES;
}

const MAP_MODE_ICONS: Record<MapMode, React.ReactNode> = {
  standard: <MapIcon className="size-3.5" />,
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

proj4.defs(
  "EPSG:32645",
  "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs"
);

function toLatLng(lat: number, lon: number): [number, number] {
  if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lat, lon];
  const [x, y] = proj4("EPSG:32645", "WGS84", [lon, lat]);
  return [y, x];
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

function MapTypeController({ mapMode }: { mapMode: MapMode }) {
  const map = useMap();
  React.useEffect(() => {
    if (map) map.setMapTypeId(getMapModeTypes()[mapMode]);
  }, [mapMode, map]);
  return null;
}

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
    if (!map) return;

    const gfCount = showGeofences
      ? geofences.filter((g) => g.enabled).length
      : 0;
    const key = `${gfCount}-${positions.length}`;
    if (lastFittedRef.current === key) return;

    const geofencePoints: google.maps.LatLngLiteral[] = [];
    if (showGeofences) {
      for (const gf of geofences) {
        if (!gf.enabled) continue;
        if (gf.type === "circle" && gf.coordinates?.center) {
          const [lat, lon] = toLatLng(
            gf.coordinates.center.lat,
            gf.coordinates.center.lon
          );
          geofencePoints.push({ lat, lng: lon });
        }
        if (gf.type === "polygon" && gf.coordinates?.points) {
          for (const p of gf.coordinates.points) {
            const [lat, lon] = toLatLng(p.lat, p.lon);
            geofencePoints.push({ lat, lng: lon });
          }
        }
      }
    }

    const points =
      geofencePoints.length > 0
        ? geofencePoints
        : positions.map((p) => ({ lat: p.latitude, lng: p.longitude }));

    if (points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const pt of points) bounds.extend(pt);
    map.fitBounds(bounds, 50);
    lastFittedRef.current = key;
  }, [positions, geofences, showGeofences, map]);

  return null;
}

function calcDistance(points: TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371;
    const dLat =
      ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180;
    const dLon =
      ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((points[i - 1].latitude * Math.PI) / 180) *
        Math.cos((points[i].latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function createCircleIconHtml(color: string, label: string): string {
  return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
    <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 0 6px ${color};"></div>
    <span style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#171717;color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4);">${label}</span>
  </div>`;
}

function formatSpeed(speed: number | null): string {
  if (speed == null) return "N/A";
  return `${parseFloat(speed.toFixed(2))} km/h`;
}

function TrailLine({ points, routeGeometry }: { points: TrailPoint[]; routeGeometry?: { lat: number; lng: number }[] | null }) {
  const map = useMap();

  React.useEffect(() => {
    if (!map || points.length < 2) return;

    const latLngs = routeGeometry && routeGeometry.length >= 2
      ? routeGeometry.map((p) => new google.maps.LatLng(p.lat, p.lng))
      : points.map((p) => new google.maps.LatLng(p.latitude, p.longitude));

    const glow = new google.maps.Polyline({
      path: latLngs,
      strokeColor: "#fb923c",
      strokeWeight: 10,
      strokeOpacity: 0.25,
      map,
      clickable: false,
    });

    const mainLine = new google.maps.Polyline({
      path: latLngs,
      strokeColor: "#f97316",
      strokeWeight: 4,
      strokeOpacity: 1,
      map,
      clickable: true,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
            strokeColor: "#c2410c",
            fillColor: "#f97316",
            fillOpacity: 1,
            strokeWeight: 0,
            scale: 4,
          },
          offset: "0%",
          repeat: "12%",
        },
      ],
    });

    const startTime = new Date(points[0].timestamp);
    const startLabel = startTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const startEl = document.createElement("div");
    startEl.innerHTML = createCircleIconHtml("#22c55e", startLabel);
    const startMarker = new google.maps.marker.AdvancedMarkerElement({
      position: latLngs[0],
      content: startEl,
      map,
    });

    const endTime = new Date(points[points.length - 1].timestamp);
    const endLabel = endTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endEl = document.createElement("div");
    endEl.innerHTML = createCircleIconHtml("#ef4444", endLabel);
    const endMarker = new google.maps.marker.AdvancedMarkerElement({
      position: latLngs[latLngs.length - 1],
      content: endEl,
      map,
    });

    const bounds = new google.maps.LatLngBounds();
    for (const ll of latLngs) bounds.extend(ll);
    map.fitBounds(bounds, 50);

    return () => {
      glow.setMap(null);
      mainLine.setMap(null);
      startMarker.map = null;
      endMarker.map = null;
    };
  }, [points, routeGeometry, map]);

  return null;
}

function TrailInfoBox({
  points,
  plateNumber,
  onClose,
}: {
  points: TrailPoint[];
  plateNumber?: string | null;
  onClose: () => void;
}) {
  if (points.length < 2) return null;

  const startTime = new Date(points[0].timestamp);
  const endTime = new Date(points[points.length - 1].timestamp);
  const distance = calcDistance(points);
  const durationMs = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const avgSpeed = hours > 0 ? distance / (durationMs / 3600000) : 0;

  return (
    <div className="absolute bottom-6 right-4 z-[1000] w-56 rounded-xl border border-white/20 bg-black/50 p-3 text-white shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Route className="size-3.5 text-orange-400" />
          <span className="text-xs font-bold tracking-wide">Trail Summary</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-0.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {plateNumber && (
        <div className="mb-1.5 rounded-md bg-white/10 px-2 py-1 text-center text-xs font-bold">
          {plateNumber}
        </div>
      )}

      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-white/60">Date</span>
          <span className="font-medium">
            {startTime.toLocaleDateString([], {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Distance</span>
          <span className="font-semibold text-orange-300">
            {distance.toFixed(2)} km
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Duration</span>
          <span className="font-medium">
            {hours}h {minutes}m
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Avg Speed</span>
          <span className="font-medium">{avgSpeed.toFixed(1)} km/h</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Start</span>
          <span className="font-medium">
            {startTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">End</span>
          <span className="font-medium">
            {endTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-1">
          <span className="text-white/40">GPS points</span>
          <span className="text-white/40">{points.length}</span>
        </div>
      </div>
    </div>
  );
}

function GeofenceOverlays({
  geofences,
  showGeofences,
}: {
  geofences: Geofence[];
  showGeofences: boolean;
}) {
  const map = useMap();
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);

  React.useEffect(() => {
    if (!map) return;

    for (const c of circlesRef.current) c.setMap(null);
    for (const p of polygonsRef.current) p.setMap(null);
    circlesRef.current = [];
    polygonsRef.current = [];

    if (!showGeofences) return;

    for (const gf of geofences) {
      if (!gf.enabled) continue;
      if (gf.type === "circle") {
        const center = gf.coordinates?.center;
        const radius = gf.coordinates?.radiusMeters;
        if (!center || !radius) continue;
        const [lat, lon] = toLatLng(center.lat, center.lon);
        circlesRef.current.push(
          new google.maps.Circle({
            center: { lat, lng: lon },
            radius,
            strokeColor: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            strokeWeight: 2,
            clickable: false,
            map,
          })
        );
      }
      if (gf.type === "polygon") {
        const pts = gf.coordinates?.points;
        if (!pts || !Array.isArray(pts) || pts.length < 3) continue;
        const path = pts.map((p: { lat: number; lon: number }) => {
          const [lat, lon] = toLatLng(p.lat, p.lon);
          return { lat, lng: lon };
        });
        polygonsRef.current.push(
          new google.maps.Polygon({
            paths: path,
            strokeColor: "#8b5cf6",
            fillColor: "#8b5cf6",
            fillOpacity: 0.1,
            strokeWeight: 2,
            clickable: false,
            map,
          })
        );
      }
    }

    return () => {
      for (const c of circlesRef.current) c.setMap(null);
      for (const p of polygonsRef.current) p.setMap(null);
      circlesRef.current = [];
      polygonsRef.current = [];
    };
  }, [map, geofences, showGeofences]);

  return null;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

interface LiveMapProps {
  initialPositions: LivePosition[];
  token: string;
}

export function LiveMap({ initialPositions, token }: LiveMapProps) {
  const { positions, connected, setInitialPositions } = useLiveMap(token);
  const [visibleVehicles, setVisibleVehicles] = useState<Set<string>>(
    new Set()
  );
  const [showGeofences, setShowGeofences] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("live-map-geofences") === "true";
    }
    return false;
  });
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("live-map-mode");
      if (
        saved &&
        ["standard", "satellite", "terrain", "hybrid"].includes(saved)
      ) {
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
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    null
  );
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [trailRouteGeometry, setTrailRouteGeometry] = useState<{ lat: number; lng: number }[] | null>(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [selectedMarkerDeviceId, setSelectedMarkerDeviceId] = useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (initialPositions.length > 0) {
      setInitialPositions(initialPositions);
      setVisibleVehicles(
        new Set(initialPositions.map((p) => p.deviceId))
      );
    }
  }, [initialPositions, setInitialPositions]);

  React.useEffect(() => {
    if (positions.size > 0 && visibleVehicles.size === 0) {
      setVisibleVehicles(new Set(positions.keys()));
    }
  }, [positions]);

  React.useEffect(() => {
    api.geofences.list().then(setGeofences).catch(() => {});
  }, []);

  const handleToggleGeofences = useCallback(() => {
    setShowGeofences((prev) => {
      const next = !prev;
      localStorage.setItem("live-map-geofences", String(next));
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!modeMenuOpen) return;
    const handler = () => setModeMenuOpen(false);
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, [modeMenuOpen]);

  const selectVehicle = useCallback(
    async (deviceId: string) => {
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
        setTrail([]);
        setTrailRouteGeometry(null);
        return;
      }
      setSelectedDeviceId(deviceId);
      if (window.innerWidth < 768) setSidebarOpen(false);
      setTrailLoading(true);
      try {
        const data = await api.telemetry.trail(deviceId);
        setTrail(data.points);
        setTrailRouteGeometry(data.routeGeometry);
      } catch {
        setTrail([]);
        setTrailRouteGeometry(null);
      } finally {
        setTrailLoading(false);
      }
    },
    [selectedDeviceId]
  );

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

  const allPositions = React.useMemo(() => Array.from(positions.values()), [positions]);
  const visiblePositions = React.useMemo(
    () => allPositions.filter((p) => visibleVehicles.has(p.deviceId)),
    [allPositions, visibleVehicles]
  );

  const animatedPositions = useVehicleAnimation(positions);

  const selectedPos = selectedMarkerDeviceId
    ? visiblePositions.find((p) => p.deviceId === selectedMarkerDeviceId) ??
      allPositions.find((p) => p.deviceId === selectedMarkerDeviceId)
    : null;

  const handleMarkerClick = useCallback(
    (deviceId: string) => {
      setSelectedMarkerDeviceId((prev) => (prev === deviceId ? null : deviceId));
    },
    []
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[998] bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
            onToggleGeofences={handleToggleGeofences}
            open={sidebarOpen}
            onToggleOpen={() => setSidebarOpen((p) => !p)}
          />
        </div>
      )}

      <div className="relative flex-1">
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={12}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          gestureHandling="greedy"
          disableDefaultUI={true}
          style={{ width: "100%", height: "100%" }}
        >
          <MapTypeController mapMode={mapMode} />

          <FitBounds
            positions={visiblePositions}
            geofences={geofences}
            showGeofences={showGeofences}
          />

          {trail.length >= 2 && <TrailLine points={trail} routeGeometry={trailRouteGeometry} />}

          <GeofenceOverlays
            geofences={geofences}
            showGeofences={showGeofences}
          />

          {visiblePositions.map((pos) => {
            const anim = animatedPositions.get(pos.deviceId);
            return (
              <VehicleMarker
                key={pos.deviceId}
                lat={anim?.lat ?? pos.latitude}
                lng={anim?.lng ?? pos.longitude}
                heading={anim?.heading ?? 0}
                speed={pos.speed}
                movement={pos.movement}
                plateNumber={pos.plateNumber}
                timestamp={pos.timestamp}
                isSelected={selectedMarkerDeviceId === pos.deviceId}
                onClick={() => handleMarkerClick(pos.deviceId)}
              />
            );
          })}
        </Map>

        {trail.length >= 2 && selectedDeviceId && (
          <TrailInfoBox
            points={trail}
            plateNumber={allPositions.find((p) => p.deviceId === selectedDeviceId)?.plateNumber}
            onClose={() => {
              setSelectedDeviceId(null);
              setTrail([]);
              setTrailRouteGeometry(null);
            }}
          />
        )}

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-lg border bg-background/90 shadow-sm backdrop-blur hover:bg-accent md:h-10 md:w-10"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] max-md:top-16">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModeMenuOpen((p) => !p);
              }}
              className="flex items-center gap-1.5 rounded-lg border bg-background/90 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent md:py-1.5"
            >
              {MAP_MODE_ICONS[mapMode]}
              <span className="hidden sm:inline">
                {MAP_MODE_LABELS[mapMode]}
              </span>
            </button>
            {modeMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 rounded-lg border bg-background p-1 shadow-lg">
                {(Object.keys(getMapModeTypes()) as MapMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      handleMapModeChange(mode);
                      setModeMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      mapMode === mode
                        ? "bg-accent font-medium"
                        : "hover:bg-accent/50"
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

        <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 rounded-lg border bg-background/90 px-2.5 py-1.5 shadow-sm backdrop-blur md:px-3">
          <div
            className={`size-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-xs font-medium">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
