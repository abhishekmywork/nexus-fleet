"use client";

import dynamic from "next/dynamic";

const ReportMapView = dynamic(
  () => import("./report-map-view").then((m) => m.default),
  { ssr: false }
);

export default function ReportMapPage() {
  return <ReportMapView />;
}
