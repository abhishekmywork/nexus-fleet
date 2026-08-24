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

  React.useEffect(() => {
    api.liveMap.positions()
      .then((data) => setInitialPositions(data))
      .catch(() => {});
  }, []);

  return (
    <LiveMap
      initialPositions={initialPositions}
      token={getAccessToken() ?? ""}
    />
  );
}
