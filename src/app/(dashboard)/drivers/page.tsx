import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { DriversTable } from "@/components/drivers/drivers-table";

export const metadata: Metadata = {
  title: "Drivers",
  description:
    "Manage your drivers. Add, edit, and assign drivers to vehicles in your fleet.",
  openGraph: { title: "Drivers — MST-VTS", description: "Manage drivers and assign them to fleet vehicles." },
};

export default function DriversPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Manage drivers and their vehicle assignments"
      />
      <DriversTable />
    </div>
  );
}
