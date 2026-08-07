import type { Metadata } from "next";
import { RolesTable } from "@/components/roles/roles-table";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Roles" };

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
