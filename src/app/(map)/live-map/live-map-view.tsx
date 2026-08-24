"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { getAccessToken } from "@/lib/api";

const LiveMap = dynamic(
  () => import("@/components/live-map/live-map").then((m) => m.LiveMap),
  { ssr: false }
);

export default function LiveMapPage() {
  return (
    <LiveMap
      initialPositions={[]}
      token={getAccessToken() ?? ""}
    />
  );
}
