"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Map, useMap } from "@vis.gl/react-google-maps";
import { ArrowLeft, FileText } from "lucide-react";

const MAP_STORAGE_KEY = "report-map-data";
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAP_STYLE: React.CSSProperties = { width: "100%", height: "100%" };

interface ReportMapData {
  title: string;
  data: any[];
  columns: { key: string; label: string; getValue?: (row: any) => any; render?: (val: any, row: any) => React.ReactNode }[];
}

function fmtCoord(val: any): number | null {
  const n = Number(val);
  if (n === 0 || !isFinite(n)) return null;
  return n;
}

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

function makeMarker(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);cursor:pointer;`;
  return el;
}

function makeInfo(parts: string[]): string {
  return `<div style="font-size:12px;line-height:1.5;color:#1f2937;font-family:system-ui,sans-serif;max-width:220px;">${parts.join("<br/>")}</div>`;
}

const MapRenderer = React.memo(function MapRenderer({ data }: { data: any[] }) {
  const map = useMap();
  const refs = React.useRef({
    markers: [] as google.maps.marker.AdvancedMarkerElement[],
    lines: [] as google.maps.Polyline[],
    info: null as google.maps.InfoWindow | null,
  });

  React.useEffect(() => {
    if (!map || !data.length) return;
    const r = refs.current;

    r.markers.forEach((m) => (m.map = null));
    r.markers = [];
    r.lines.forEach((l) => l.setMap(null));
    r.lines = [];
    r.info?.close();
    r.info = null;

    const allPts: google.maps.LatLngLiteral[] = [];

    for (const row of data) {
      const plate = row.plateNumber ?? "Unknown";

      if (Array.isArray(row.points) && row.points.length >= 2) {
        const trail = row.points
          .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lon) }))
          .filter((p: google.maps.LatLngLiteral) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));

        if (trail.length >= 2) {
          r.lines.push(
            new google.maps.Polyline({ path: trail, map, strokeColor: "#f97316", strokeWeight: 10, strokeOpacity: 0.2, clickable: false }),
            new google.maps.Polyline({ path: trail, map, strokeColor: "#f97316", strokeWeight: 4, strokeOpacity: 1, clickable: false })
          );
          allPts.push(...trail);

          const sM = new google.maps.marker.AdvancedMarkerElement({ position: trail[0], content: makeMarker("#22c55e"), map });
          sM.addListener("click", () => { r.info?.close(); r.info = new google.maps.InfoWindow({ content: makeInfo([`<b>${plate}</b>`, `Start: ${fmtTimestamp(row.startTime)}`, `Distance: ${row.distanceKm ?? "—"} km`]) }); r.info.open({ anchor: sM, map }); });
          r.markers.push(sM);

          const eM = new google.maps.marker.AdvancedMarkerElement({ position: trail[trail.length - 1], content: makeMarker("#ef4444"), map });
          eM.addListener("click", () => { r.info?.close(); r.info = new google.maps.InfoWindow({ content: makeInfo([`<b>${plate}</b>`, `End: ${fmtTimestamp(row.endTime)}`]) }); r.info.open({ anchor: eM, map }); });
          r.markers.push(eM);
        }
        continue;
      }

      const lat = fmtCoord(row.latitude ?? row.startLat);
      const lon = fmtCoord(row.longitude ?? row.startLon);
      if (lat == null || lon == null) continue;

      const pos = { lat, lng: lon };
      allPts.push(pos);

      const parts: string[] = [`<b>${plate}</b>`];
      if (row.eventType) parts.push(`Event: ${row.eventType}`);
      if (row.speed != null) parts.push(`Speed: ${Number(row.speed).toFixed(1)} km/h`);
      if (row.timestamp) parts.push(`Time: ${fmtTimestamp(row.timestamp)}`);
      if (row.startedAt) parts.push(`Start: ${fmtTimestamp(row.startedAt)}`);
      if (row.geofenceName) parts.push(`Geofence: ${row.geofenceName}`);

      const m = new google.maps.marker.AdvancedMarkerElement({ position: pos, content: makeMarker("#3b82f6"), map });
      m.addListener("click", () => { r.info?.close(); r.info = new google.maps.InfoWindow({ content: makeInfo(parts) }); r.info.open({ anchor: m, map }); });
      r.markers.push(m);
    }

    if (allPts.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const pt of allPts) bounds.extend(pt);
      map.fitBounds(bounds, 50);
    }

    return () => {
      r.markers.forEach((m) => (m.map = null));
      r.markers = [];
      r.lines.forEach((l) => l.setMap(null));
      r.lines = [];
      r.info?.close();
      r.info = null;
    };
  }, [map, data]);

  return null;
});

export default function ReportMapView() {
  const router = useRouter();
  const [payload, setPayload] = React.useState<ReportMapData | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MAP_STORAGE_KEY);
      if (raw) {
        setPayload(JSON.parse(raw));
        sessionStorage.removeItem(MAP_STORAGE_KEY);
      }
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!payload || !payload.data.length) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-sm text-muted-foreground">No report data to display on the map.</p>
        <button onClick={() => router.push("/reports")} className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          <ArrowLeft className="size-4" /> Go to Reports
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={12}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={true}
        style={MAP_STYLE}
      >
        <MapRenderer data={payload.data} />
      </Map>

      {/* Floating header */}
      <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-3 rounded-lg border bg-background/90 px-4 py-2 shadow-sm backdrop-blur">
        <h1 className="text-sm font-semibold">{payload.title}</h1>
        <span className="text-xs text-muted-foreground">{payload.data.length} points</span>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push("/reports")}
        className="absolute top-4 left-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-lg border bg-background/90 shadow-sm backdrop-blur hover:bg-accent"
      >
        <ArrowLeft className="size-4" />
      </button>
    </div>
  );
}
