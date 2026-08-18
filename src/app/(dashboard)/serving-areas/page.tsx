import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ServingAreasTable } from "@/components/serving-areas/serving-areas-table";

export const metadata: Metadata = {
  title: "Serving Areas",
  description:
    "Define and manage service areas. Set geographic boundaries for fleet operations and coverage zones.",
  openGraph: { title: "Serving Areas — MST-VTS", description: "Define geographic boundaries for fleet operations." },
};

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
