import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { EventsTable } from "@/components/events/events-table";

export const metadata: Metadata = {
  title: "Events",
  description:
    "View and manage fleet events including overspeeding, geofence alerts, SOS triggers, and device status changes.",
  openGraph: { title: "Events — MST-VTS", description: "Track fleet events: overspeeding, geofence alerts, SOS triggers." },
};

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Detected events and alerts from vehicle telemetry"
      />
      <EventsTable />
    </div>
  );
}
