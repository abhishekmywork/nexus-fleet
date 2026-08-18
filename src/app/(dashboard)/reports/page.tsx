import type { Metadata } from "next";
import ReportsView from "./reports-view";

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Generate and export fleet reports. View daily summaries, trip reports, speed violations, geofence events, and more.",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return <ReportsView />;
}
