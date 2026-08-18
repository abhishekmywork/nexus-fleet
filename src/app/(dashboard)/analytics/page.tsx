import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Analytics",
  description:
    "Fleet analytics and insights. View performance metrics, usage trends, and operational data.",
  openGraph: { title: "Analytics — MST-VTS", description: "Fleet analytics and performance insights." },
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Reports"
        description="Deep-dive reports, funnels, and exportable insights."
        actions={
          <div className="flex gap-2">
            <Button variant="outline">Export</Button>
            <Button>Generate report</Button>
          </div>
        }
      />

      <Card className="flex min-h-[420px] flex-col items-center justify-center border-dashed p-10 text-center shadow-sm">
        <BarChart3 className="size-10 text-muted-foreground/50" aria-hidden="true" />
        <CardHeader>
          <CardTitle>Reports in progress</CardTitle>
          <CardDescription>
            This placeholder will host advanced analytics: funnels, cohort
            retention, and scheduled PDF/CSV reports. The dashboard already
            demonstrates the Recharts integration to build on.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
