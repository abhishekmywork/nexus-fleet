"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import type { SearchableSelectOption } from "@/components/common/searchable-select";
import type { ReportMeta } from "./report-shell";

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

export function SpeedViolationReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

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
    <ReportShell title="Speed Violations" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="speed-violations" />
  );
}
