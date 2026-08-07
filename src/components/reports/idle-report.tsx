"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { useReportRestore } from "@/hooks/use-report-restore";
import { Input } from "@/components/ui/input";

function formatDuration(sec?: number): string {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "eventType", label: "Type" },
  { key: "startedAt", label: "Start", render: (val) => fmtTimestamp(val) },
  { key: "endedAt", label: "End", render: (val) => fmtTimestamp(val) },
  { key: "durationSec", label: "Duration", render: (val) => formatDuration(val) },
  { key: "latitude", label: "Lat" },
  { key: "longitude", label: "Lon" },
];

const REPORT_ID = "idle-stoppages";

export function IdleReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const restored = useReportRestore(REPORT_ID);
  const router = useRouter();

  useEffect(() => {
    if (restored) setData(restored);
  }, [restored]);

  const handleGenerate = async (params: { from: string; to: string; minDuration?: number }) => {
    setLoading(true);
    try {
      const result = await api.reports.idleStoppages(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Idle & Stoppages" reportId={REPORT_ID} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} onViewMap={(row) => router.push(`/live-map?lat=${row.latitude ?? 0}&lng=${row.longitude ?? 0}`)} exportFileName="idle-stoppages">
      {({ setParam }: any) => (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Min Duration (min)</label>
          <Input type="number" placeholder="e.g. 5" className="w-28" onChange={(e) => setParam("minDuration", e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      )}
    </ReportShell>
  );
}
