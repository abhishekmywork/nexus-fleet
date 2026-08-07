import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { DriversTable } from "@/components/drivers/drivers-table";

export const metadata: Metadata = { title: "Drivers" };

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
