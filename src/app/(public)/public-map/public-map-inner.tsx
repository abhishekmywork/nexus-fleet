"use client";

import * as React from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Circle,
  Polygon,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Map, Satellite, Mountain, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LivePosition } from "@/hooks/use-live-map";
import type { Geofence } from "@/lib/auth-types";

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

const DEFAULT_CENTER: [number, number] = [22.5, 88.3];

function MapLayerManager({ mapMode }: { mapMode: MapMode }) {
  const map = useMap();
  const layerRefs = React.useRef<L.TileLayer[]>([]);

  React.useEffect(() => {
    for (const layer of layerRefs.current) map.removeLayer(layer);
    layerRefs.current = [];
    for (const cfg of MAP_LAYERS[mapMode]) {
      const layer = L.tileLayer(cfg.url, { attribution: cfg.attribution }).addTo(map);
      layerRefs.current.push(layer);
    }
  }, [mapMode, map]);

  return null;
}

function FitBounds({
  positions,
  geofences,
}: {
  positions: LivePosition[];
  geofences: Geofence[];
}) {
  const map = useMap();
  const lastFittedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const key = `${geofences.filter((g) => g.enabled).length}-${positions.length}`;
    if (lastFittedRef.current === key) return;

    const gfPoints: [number, number][] = [];
    for (const gf of geofences) {
      if (!gf.enabled) continue;
      if (gf.type === "circle" && gf.coordinates?.center) {
        gfPoints.push([gf.coordinates.center.lat, gf.coordinates.center.lon]);
      }
      if (gf.type === "polygon" && gf.coordinates?.points) {
        for (const p of gf.coordinates.points) gfPoints.push([p.lat, p.lon]);
      }
    }

    const points = gfPoints.length > 0
      ? gfPoints
      : positions.map((p) => [p.latitude, p.longitude] as [number, number]);

    if (points.length === 0) return;

    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
    lastFittedRef.current = key;
  }, [positions, geofences, map]);

  return null;
}

function createVehicleIcon(plateNumber: string | null, movement: string | null): L.DivIcon {
  const color =
    movement === "MOVING" ? "#22c55e" :
    movement === "STOPPED" ? "#f97316" : "#64748b";

  return L.divIcon({
    className: "vehicle-marker",
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:12px;height:12px;border-radius:50%;
          background:${color};border:2px solid #fff;
          box-shadow:0 0 0 2px ${color}, 0 0 8px ${color}40;
        "></div>
        <div style="
          width:2px;height:4px;background:${color};border-radius:0 0 1px 1px;
        "></div>
        ${plateNumber ? `<span style="
          position:absolute;top:-20px;left:50%;transform:translateX(-50%);
          background:${color};color:#fff;font-size:8px;font-weight:700;
          padding:1px 5px;border-radius:3px;white-space:nowrap;
          box-shadow:0 1px 4px rgba(0,0,0,.3);
        ">${plateNumber}</span>` : ""}
      </div>
    `,
    iconSize: [14, 16],
    iconAnchor: [7, 16],
  });
}

function formatSpeed(speed: number | null): string {
  if (speed == null) return "N/A";
  return `${parseFloat(speed.toFixed(2))} km/h`;
}

export function PublicMapInner({
  positions,
  geofences,
  tenantName,
}: {
  positions: LivePosition[];
  geofences: Geofence[];
  tenantName: string;
}) {
  const [mapMode, setMapMode] = React.useState<MapMode>("standard");
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!modeMenuOpen) return;
    const handler = () => setModeMenuOpen(false);
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, [modeMenuOpen]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        className="h-full w-full"
        zoomControl={false}
      >
        <MapLayerManager mapMode={mapMode} />
        <FitBounds positions={positions} geofences={geofences} />

        {positions.map((pos) => (
          <Marker
            key={pos.deviceId}
            position={[pos.latitude, pos.longitude]}
            icon={createVehicleIcon(pos.plateNumber, pos.movement)}
          >
            <Popup>
              <div className="min-w-[160px] space-y-0.5 text-sm">
                <p className="font-semibold">{pos.plateNumber ?? "Unknown"}</p>
                <p>Speed: {formatSpeed(pos.speed)}</p>
                <p>Ignition: {pos.ignition ?? "N/A"}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {geofences.filter((gf) => gf.enabled).map((gf) => {
          if (gf.type === "circle") {
            const center = gf.coordinates?.center;
            const radius = gf.coordinates?.radiusMeters;
            if (!center || !radius) return null;
            return (
              <Circle
                key={gf.id}
                center={[center.lat, center.lon]}
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
                positions={points.map((p: { lat: number; lon: number }) => [p.lat, p.lon] as [number, number])}
                pathOptions={{ color: "#8b5cf6", fillColor: "#8b5cf6", fillOpacity: 0.1, weight: 2 }}
              />
            );
          }
          return null;
        })}
      </MapContainer>

      {/* Tenant label */}
      <div className="absolute top-4 left-4 z-[1000] rounded-lg border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span className="text-sm font-semibold">{tenantName} — Live Fleet</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {positions.length} vehicle{positions.length !== 1 ? "s" : ""} online
        </p>
      </div>

      {/* Map mode switcher */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
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
                  onClick={() => { setMapMode(mode); setModeMenuOpen(false); }}
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
    </div>
  );
}
