"use client";

import * as React from "react";
import { Loader2, MapPin } from "lucide-react";
import { useTenant } from "@/components/tenant/tenant-provider";
import { api } from "@/lib/api";
import type { LivePosition } from "@/hooks/use-live-map";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

/** Inline Leaflet map for the public view — no auth required. */
function PublicLiveMap({ positions, tenantName }: { positions: LivePosition[]; tenantName: string }) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersRef = React.useRef<Map<string, any>>(new Map());

  React.useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css"),
    ]).then(([L]) => {
      const map = L.map(mapRef.current!, {
        center: [22.5, 88.3],
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      mapInstanceRef.current = map;
    });
  }, []);

  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      const currentIds = new Set(positions.map((p) => p.deviceId));

      for (const [id, marker] of markersRef.current) {
        if (!currentIds.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }

      const bounds: [number, number][] = [];

      for (const pos of positions) {
        if (pos.latitude == null || pos.longitude == null) continue;
        bounds.push([pos.latitude, pos.longitude]);

        const color =
          pos.movement === "MOVING" ? "#22c55e" :
          pos.movement === "STOPPED" ? "#f97316" : "#64748b";

        const icon = L.divIcon({
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
              ${pos.plateNumber ? `<span style="
                position:absolute;top:-20px;left:50%;transform:translateX(-50%);
                background:${color};color:#fff;font-size:8px;font-weight:700;
                padding:1px 5px;border-radius:3px;white-space:nowrap;
                box-shadow:0 1px 4px rgba(0,0,0,.3);
              ">${pos.plateNumber}</span>` : ""}
            </div>
          `,
          iconSize: [14, 16],
          iconAnchor: [7, 16],
        });

        const existing = markersRef.current.get(pos.deviceId);
        if (existing) {
          existing.setLatLng([pos.latitude, pos.longitude]);
          existing.setIcon(icon);
        } else {
          const marker = L.marker([pos.latitude, pos.longitude], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="font-size:12px;line-height:1.5;min-width:140px">
                <div style="font-weight:700">${pos.plateNumber ?? "Unknown"}</div>
                <div>Speed: ${pos.speed != null ? `${pos.speed} km/h` : "N/A"}</div>
                <div>Ignition: ${pos.ignition ?? "N/A"}</div>
              </div>
            `);
          markersRef.current.set(pos.deviceId, marker);
        }
      }

      if (bounds.length > 0 && markersRef.current.size === bounds.length) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    });
  }, [positions]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <div className="absolute top-4 left-4 z-[1000] rounded-lg border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span className="text-sm font-semibold">{tenantName} — Live Fleet</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {positions.length} vehicle{positions.length !== 1 ? "s" : ""} online
        </p>
      </div>
    </div>
  );
}

export default function PublicMapPage() {
  const { tenant, slug, resolved, error } = useTenant();
  const [positions, setPositions] = React.useState<LivePosition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [accessDenied, setAccessDenied] = React.useState(false);

  React.useEffect(() => {
    if (!resolved || !slug) return;

    async function load() {
      try {
        const statusRes = await fetch(
          `${API_BASE.replace(/\/api\/?$/, "")}/api/tenants/public/${slug}/public-live-map-status`
        );
        const status = await statusRes.json();

        if (!status.enabled) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const data = await api.liveMap.publicPositions();
        setPositions(data);
      } catch {
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [resolved, slug]);

  React.useEffect(() => {
    if (accessDenied || !slug) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.liveMap.publicPositions();
        setPositions(data);
      } catch {
        // silently fail
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [accessDenied, slug]);

  if (!resolved || loading) {
    return (
      <div className="flex h-[calc(100vh-52px)] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex h-[calc(100vh-52px)] items-center justify-center">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex h-[calc(100vh-52px)] flex-col items-center justify-center gap-4">
        <MapPin className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-semibold">Public Access Not Available</p>
          <p className="text-sm text-muted-foreground mt-1">
            {tenant.name} has not enabled public access to the live map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-52px)]">
      <PublicLiveMap positions={positions} tenantName={tenant.name} />
    </div>
  );
}
