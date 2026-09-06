"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { Badge } from "@/components/ui/badge";
import { fmtTimestampExport } from "./format-helpers";
import type { SearchableSelectOption } from "@/components/common/searchable-select";
import type { ReportMeta } from "./report-shell";

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "geofenceName", label: "Geofence" },
  { key: "eventType", label: "Event", render: (val) => <Badge variant={val === "ENTRY" ? "default" : "destructive"}>{val}</Badge>, formatExport: (val) => String(val ?? "") },
  { key: "timestamp", label: "Time", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
  { key: "latitude", label: "Lat" },
  { key: "longitude", label: "Lon" },
];

const REPORT_ID = "geofence-entry-exit";

export function GeofenceEntryExitReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

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
    <ReportShell title="Geofence Entry/Exit" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="geofence-entry-exit" />
  );
}
