import type { Metadata } from "next";
import ReportMapView from "./report-map-view";

export const metadata: Metadata = {
  title: "Report Map",
  description:
    "Visualize fleet report data on an interactive map. View trip routes, geofence events, and vehicle positions.",
  robots: { index: false, follow: false },
};

export default function ReportMapPage() {
  return <ReportMapView />;
}
