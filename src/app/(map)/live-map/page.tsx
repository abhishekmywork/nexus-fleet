import type { Metadata } from "next";
import dynamic from "next/dynamic";

const LiveMapView = dynamic(
  () => import("./live-map-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Live Map — Real-Time Fleet Tracking",
  description:
    "Track your entire fleet in real-time on an interactive map. View vehicle locations, movement status, and geofence boundaries.",
  openGraph: {
    title: "Live Fleet Map — MST-VTS",
    description:
      "Real-time GPS fleet tracking. View vehicle locations, speed, and geofence boundaries on an interactive map.",
  },
};

export default function LiveMapPage() {
  return <LiveMapView />;
}
