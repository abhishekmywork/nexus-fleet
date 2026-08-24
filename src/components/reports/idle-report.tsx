"use client";

import { useState } from "react";
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

export function IdleReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

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
    <ReportShell title="Idle & Stoppages" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="idle-stoppages" />
  );
}
