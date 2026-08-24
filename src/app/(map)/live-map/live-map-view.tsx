"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { api, getAccessToken } from "@/lib/api";

const LiveMap = dynamic(
  () => import("@/components/live-map/live-map").then((m) => m.LiveMap),
  { ssr: false }
);

export default function LiveMapPage() {
  const [initialPositions, setInitialPositions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await api.liveMap.positions();
        setInitialPositions(data);
      } catch {
        // Silent — WebSocket will provide live updates
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveMap
      initialPositions={initialPositions}
      token={getAccessToken() ?? ""}
    />
  );
}
