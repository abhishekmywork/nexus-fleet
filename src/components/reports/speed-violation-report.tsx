"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { useReportRestore } from "@/hooks/use-report-restore";
import { Input } from "@/components/ui/input";

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "timestamp", label: "Time", render: (val) => fmtTimestamp(val) },
  { key: "speed", label: "Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "speedLimit", label: "Limit", render: (val) => val != null ? `${val} km/h` : "—" },
  { key: "latitude", label: "Lat" },
  { key: "longitude", label: "Lon" },
];

const REPORT_ID = "speed-violations";

export function SpeedViolationReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const restored = useReportRestore(REPORT_ID);
  const router = useRouter();

  useEffect(() => {
    if (restored) setData(restored);
  }, [restored]);

  const handleGenerate = async (params: { from: string; to: string; speedLimit?: number }) => {
    setLoading(true);
    try {
      const result = await api.reports.speedViolations(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Speed Violations" reportId={REPORT_ID} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} onViewMap={(row) => router.push(`/live-map?lat=${row.latitude ?? 0}&lng=${row.longitude ?? 0}`)} exportFileName="speed-violations">
      {({ setParam }: any) => (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Speed Limit (km/h)</label>
          <Input type="number" placeholder="e.g. 80" className="w-32" onChange={(e) => setParam("speedLimit", e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      )}
    </ReportShell>
  );
}
