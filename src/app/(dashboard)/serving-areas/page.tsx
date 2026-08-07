import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ServingAreasTable } from "@/components/serving-areas/serving-areas-table";

export const metadata: Metadata = { title: "Serving Areas" };

export default function ServingAreasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Serving Areas"
        description="Define geographic zones where your vehicles operate"
      />
      <ServingAreasTable />
    </div>
  );
}
