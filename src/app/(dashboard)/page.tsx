import type { Metadata } from "next";
import dynamic from "next/dynamic";

const DashboardView = dynamic(
  () => import("./dashboard-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: {
    default: "MST-VTS — Dashboard",
    template: "%s | MST-VTS",
  },
  description:
    "MST-VTS fleet management dashboard. Monitor vehicle status, track GPS positions, view events, and manage your fleet in real-time.",
  openGraph: {
    title: "MST-VTS Fleet Dashboard",
    description:
      "Monitor your fleet in real-time. Track vehicles, view events, and manage drivers from a single dashboard.",
  },
};

export default function DashboardPage() {
  return <DashboardView />;
}
