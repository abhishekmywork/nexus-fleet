import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TelemetryTable } from "@/components/telemetry/telemetry-table";

export const metadata: Metadata = { title: "Telemetry" };

export default function TelemetryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetry"
        description="Live GPS tracking data and vehicle telemetry monitoring"
      />
      <TelemetryTable />
    </div>
  );
}
