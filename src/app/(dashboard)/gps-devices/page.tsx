import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { GPSDevicesTable } from "@/components/gps-devices/gps-devices-table";

export const metadata: Metadata = { title: "GPS Devices" };

export default function GPSDevicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="GPS Devices"
        description="Track and manage GPS tracking devices installed in your fleet"
      />
      <GPSDevicesTable />
    </div>
  );
}
