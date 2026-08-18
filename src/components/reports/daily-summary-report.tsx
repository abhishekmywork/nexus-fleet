"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import type { SearchableSelectOption } from "@/components/common/searchable-select";
import type { ReportMeta } from "./report-shell";

function formatDuration(sec?: number): string {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "totalDistanceKm", label: "Distance", render: (val) => val != null ? `${Number(val).toFixed(2)} km` : "—" },
  { key: "movingTimeSec", label: "Moving Time", render: (val) => formatDuration(val) },
  { key: "idleTimeSec", label: "Idle Time", render: (val) => formatDuration(val) },
  { key: "stopTimeSec", label: "Stop Time", render: (val) => formatDuration(val) },
  { key: "avgSpeed", label: "Avg Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "maxSpeed", label: "Max Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "stopCount", label: "Stops" },
  { key: "readingCount", label: "Readings" },
];

const REPORT_ID = "daily-summary";

export function DailySummaryReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const handleGenerate = async (params: { from: string; to: string; deviceId?: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.dailySummary(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Daily Summary" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="daily-summary" />
  );
}
