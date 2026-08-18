import type { Metadata } from "next";
import { RolesTable } from "@/components/roles/roles-table";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Roles",
  description:
    "Manage user roles and permissions. Define access levels for fleet management features.",
  openGraph: { title: "Roles — MST-VTS", description: "Manage user roles and access permissions." },
};

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Define roles and control which permissions each one grants."
      />
      <RolesTable />
    </div>
  );
}
