"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { useReportRestore } from "@/hooks/use-report-restore";
import { Badge } from "@/components/ui/badge";

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "geofenceName", label: "Geofence" },
  { key: "eventType", label: "Event", render: (val) => <Badge variant={val === "ENTRY" ? "default" : "destructive"}>{val}</Badge> },
  { key: "timestamp", label: "Time", render: (val) => fmtTimestamp(val) },
  { key: "latitude", label: "Lat" },
  { key: "longitude", label: "Lon" },
];

const REPORT_ID = "geofence-entry-exit";

export function GeofenceEntryExitReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const restored = useReportRestore(REPORT_ID);
  const router = useRouter();

  useEffect(() => {
    if (restored) setData(restored);
  }, [restored]);

  const handleGenerate = async (params: { from: string; to: string; geofenceId?: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.geofenceEntryExit(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Geofence Entry/Exit" reportId={REPORT_ID} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} onViewMap={(row) => router.push(`/live-map?lat=${row.latitude ?? 0}&lng=${row.longitude ?? 0}`)} exportFileName="geofence-entry-exit" />
  );
}
