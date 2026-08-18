"use client";

import dynamic from "next/dynamic";

const PublicMapView = dynamic(
  () => import("./public-map-view").then((m) => m.default),
  { ssr: false }
);

export default function PublicMapClient() {
  return <PublicMapView />;
}
