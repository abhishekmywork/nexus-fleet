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
  { key: "eventType", label: "Event" },
  { key: "startedAt", label: "Started", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
  { key: "endedAt", label: "Ended", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
  { key: "speed", label: "Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—", formatExport: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "latitude", label: "Lat" },
  { key: "longitude", label: "Lon" },
  { key: "acknowledged", label: "Acknowledged", render: (val) => <Badge variant={val ? "default" : "secondary"}>{val ? "Yes" : "No"}</Badge>, formatExport: (val) => val ? "Yes" : "No" },
];

const REPORT_ID = "event-log";

export function EventLogReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const handleGenerate = async (params: { from: string; to: string; eventType?: string; deviceId?: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.eventLog(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Event Log" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="event-log" />
  );
}
