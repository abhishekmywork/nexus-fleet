"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";
import { useTenant } from "@/components/tenant/tenant-provider";
import { api } from "@/lib/api";
import type { LivePosition } from "@/hooks/use-live-map";
import type { Geofence } from "@/lib/auth-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const PublicMapInner = dynamic(
  () => import("./public-map-inner").then((m) => m.PublicMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function PublicMapPage() {
  const { tenant, slug, resolved, error } = useTenant();
  const [positions, setPositions] = React.useState<LivePosition[]>([]);
  const [geofences, setGeofences] = React.useState<Geofence[]>([]);
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

        const [posData, geoData] = await Promise.all([
          api.liveMap.publicPositions(),
          api.geofences.publicByTenant(),
        ]);
        setPositions(posData);
        setGeofences(geoData);
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
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
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
    <div className="absolute inset-0">
      <PublicMapInner
        positions={positions}
        geofences={geofences}
        tenantName={tenant.name}
      />
    </div>
  );
}
