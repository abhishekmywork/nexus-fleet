import type { Metadata } from "next";
import { TenantsTable } from "@/components/tenants/tenants-table";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Tenants" };

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Administration"
        description="Manage the isolated workspaces that organize users and data."
      />
      <TenantsTable />
    </div>
  );
}
