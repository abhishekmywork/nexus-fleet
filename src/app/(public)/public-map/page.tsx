import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PublicMapView = dynamic(
  () => import("./public-map-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Live Fleet Map — Real-Time GPS Tracking",
  description:
    "Track your fleet in real-time on an interactive map. View vehicle locations, movement status, and geofence boundaries.",
  openGraph: {
    title: "Live Fleet Map — MST-VTS",
    description:
      "Real-time GPS fleet tracking. View vehicle locations, movement status, and geofence boundaries on an interactive map.",
  },
};

export default function PublicMapPage() {
  return <PublicMapView />;
}
