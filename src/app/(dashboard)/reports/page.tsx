import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ReportsView = dynamic(
  () => import("./reports-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Generate and export fleet reports. View daily summaries, trip reports, speed violations, geofence events, and more.",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return <ReportsView />;
}
