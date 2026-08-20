"use client";

import * as React from "react";
import { Map, useMap, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { MapPin, Map as MapIcon, Satellite, Mountain, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LivePosition } from "@/hooks/use-live-map";
import type { Geofence } from "@/lib/auth-types";

type MapMode = "standard" | "satellite" | "terrain" | "hybrid";

const MAP_MODE_TYPES: Record<MapMode, google.maps.MapTypeId> = {
  standard: google.maps.MapTypeId.ROADMAP,
  satellite: google.maps.MapTypeId.SATELLITE,
  terrain: google.maps.MapTypeId.TERRAIN,
  hybrid: google.maps.MapTypeId.HYBRID,
};

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

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 22.5, lng: 88.3 };

function MapModeManager({ mapMode }: { mapMode: MapMode }) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;
    map.setMapTypeId(MAP_MODE_TYPES[mapMode]);
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
    if (!map) return;

    const key = `${geofences.filter((g) => g.enabled).length}-${positions.length}`;
    if (lastFittedRef.current === key) return;

    const gfPoints: google.maps.LatLngLiteral[] = [];
    for (const gf of geofences) {
      if (!gf.enabled) continue;
      if (gf.type === "circle" && gf.coordinates?.center) {
        gfPoints.push({ lat: gf.coordinates.center.lat, lng: gf.coordinates.center.lon });
      }
      if (gf.type === "polygon" && gf.coordinates?.points) {
        for (const p of gf.coordinates.points) gfPoints.push({ lat: p.lat, lng: p.lon });
      }
    }

    const points = gfPoints.length > 0
      ? gfPoints
      : positions.map((p) => ({ lat: p.latitude, lng: p.longitude }));

    if (points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const pt of points) bounds.extend(pt);

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(15);
    } else {
      map.fitBounds(bounds, 50);
    }

    lastFittedRef.current = key;
  }, [positions, geofences, map]);

  return null;
}

function GeofenceManager({
  geofences,
}: {
  geofences: Geofence[];
}) {
  const map = useMap();
  const circlesRef = React.useRef<google.maps.Circle[]>([]);
  const polygonsRef = React.useRef<google.maps.Polygon[]>([]);

  React.useEffect(() => {
    if (!map) return;

    for (const c of circlesRef.current) c.setMap(null);
    circlesRef.current = [];
    for (const p of polygonsRef.current) p.setMap(null);
    polygonsRef.current = [];

    for (const gf of geofences) {
      if (!gf.enabled) continue;

      if (gf.type === "circle") {
        const center = gf.coordinates?.center;
        const radius = gf.coordinates?.radiusMeters;
        if (!center || !radius) continue;
        const circle = new google.maps.Circle({
          map,
          center: { lat: center.lat, lng: center.lon },
          radius,
          strokeColor: "#3b82f6",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
        });
        circlesRef.current.push(circle);
      }

      if (gf.type === "polygon") {
        const points = gf.coordinates?.points;
        if (!points || !Array.isArray(points) || points.length < 3) continue;
        const polygon = new google.maps.Polygon({
          map,
          paths: points.map((p: { lat: number; lon: number }) => ({ lat: p.lat, lng: p.lon })),
          strokeColor: "#8b5cf6",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#8b5cf6",
          fillOpacity: 0.1,
        });
        polygonsRef.current.push(polygon);
      }
    }

    return () => {
      for (const c of circlesRef.current) c.setMap(null);
      for (const p of polygonsRef.current) p.setMap(null);
    };
  }, [geofences, map]);

  return null;
}

function createVehicleHtml(plateNumber: string | null, movement: string | null): string {
  const color =
    movement === "MOVING" ? "#22c55e" :
    movement === "STOPPED" ? "#f97316" : "#64748b";

  return `
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
  `;
}

function formatSpeed(speed: number | null): string {
  if (speed == null) return "N/A";
  return `${parseFloat(speed.toFixed(2))} km/h`;
}

function VehicleMarker({ pos }: { pos: LivePosition }) {
  const [open, setOpen] = React.useState(false);

  return (
    <AdvancedMarker
      position={{ lat: pos.latitude, lng: pos.longitude }}
      onClick={() => setOpen(true)}
    >
      <div dangerouslySetInnerHTML={{ __html: createVehicleHtml(pos.plateNumber, pos.movement) }} />
      {open && (
        <InfoWindow onCloseClick={() => setOpen(false)} position={{ lat: pos.latitude, lng: pos.longitude }}>
          <div style={{ minWidth: 160, fontSize: 13, lineHeight: 1.6, color: "#1f2937", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: "#111827" }}>{pos.plateNumber ?? "Unknown"}</div>
            <div><span style={{ color: "#6b7280" }}>Speed: </span><span style={{ fontWeight: 600 }}>{formatSpeed(pos.speed)}</span></div>
            <div><span style={{ color: "#6b7280" }}>Ignition: </span><span style={{ fontWeight: 600 }}>{pos.ignition ?? "N/A"}</span></div>
          </div>
        </InfoWindow>
      )}
    </AdvancedMarker>
  );
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
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={12}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={true}
        style={{ width: "100%", height: "100%" }}
      >
        <MapModeManager mapMode={mapMode} />
        <FitBounds positions={positions} geofences={geofences} />
        <GeofenceManager geofences={geofences} />

        {positions.map((pos) => (
          <VehicleMarker key={pos.deviceId} pos={pos} />
        ))}
      </Map>

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
              {(Object.keys(MAP_MODE_TYPES) as MapMode[]).map((mode) => (
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
