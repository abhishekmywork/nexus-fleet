import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ReportMapView = dynamic(
  () => import("./report-map-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Report Map",
  description:
    "Visualize fleet report data on an interactive map. View trip routes, geofence events, and vehicle positions.",
  robots: { index: false, follow: false },
};

export default function ReportMapPage() {
  return <ReportMapView />;
}
