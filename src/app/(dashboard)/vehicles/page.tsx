import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { VehiclesTable } from "@/components/vehicles/vehicles-table";

export const metadata: Metadata = {
  title: "Vehicles",
  description:
    "Manage your fleet vehicles. Add, edit, and monitor vehicle status, assignment, and details.",
  openGraph: { title: "Vehicles — MST-VTS", description: "Manage your fleet vehicles and monitor their status." },
};

export default function VehiclesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Manage your fleet vehicles, assignments and serving areas"
      />
      <VehiclesTable />
    </div>
  );
}
