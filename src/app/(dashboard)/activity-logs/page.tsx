import type { Metadata } from "next";
import { ActivityLogsTable } from "@/components/activity-logs/activity-logs-table";

export const metadata: Metadata = {
  title: "Activity Logs",
  description:
    "Audit trail of all user actions. Track who did what, when, and where across the fleet management platform.",
  robots: { index: false, follow: false },
};

export default function ActivityLogsPage() {
  return <ActivityLogsTable />;
}
