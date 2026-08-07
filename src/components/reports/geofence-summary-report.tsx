"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { useReportRestore } from "@/hooks/use-report-restore";

const columns: Column[] = [
  { key: "geofenceName", label: "Geofence" },
  { key: "totalVisits", label: "Visits" },
  { key: "uniqueVehicles", label: "Unique Vehicles" },
  { key: "timestamps", label: "Timestamps", render: (val) => { if (!val || !Array.isArray(val) || val.length === 0) return "—"; return `${val.length} event${val.length !== 1 ? "s" : ""}`; }, getValue: (row) => row.timestamps },
];

const REPORT_ID = "geofence-summary";

export function GeofenceSummaryReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const restored = useReportRestore(REPORT_ID);

  useEffect(() => {
    if (restored) setData(restored);
  }, [restored]);

  const handleGenerate = async (params: { from: string; to: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.geofenceSummary(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Geofence Summary" reportId={REPORT_ID} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="geofence-summary" />
  );
}
