import { UsersTable } from "@/components/users/users-table";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Search, filter, and manage your user base."
      />
      <UsersTable />
    </div>
  );
}
