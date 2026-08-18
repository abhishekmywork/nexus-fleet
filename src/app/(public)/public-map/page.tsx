import type { Metadata } from "next";
import PublicMapClient from "./public-map-client";

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
  return <PublicMapClient />;
}
