"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { fmtTimestampExport } from "./format-helpers";
import type { SearchableSelectOption } from "@/components/common/searchable-select";
import type { ReportMeta } from "./report-shell";

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "imei", label: "IMEI" },
  { key: "readingCount", label: "Readings" },
  { key: "battery-min", label: "Battery Min", getValue: (row) => row.battery?.min, render: (val) => (val != null ? `${val}%` : "—"), formatExport: (val) => val != null ? `${val}%` : "—" },
  { key: "battery-max", label: "Battery Max", getValue: (row) => row.battery?.max, render: (val) => (val != null ? `${val}%` : "—"), formatExport: (val) => val != null ? `${val}%` : "—" },
  { key: "battery-avg", label: "Battery Avg", getValue: (row) => row.battery?.avg, render: (val) => (val != null ? `${val}%` : "—"), formatExport: (val) => val != null ? `${val}%` : "—" },
  { key: "signal-min", label: "Signal Min", getValue: (row) => row.signal?.min, render: (val) => (val != null ? `${val}` : "—"), formatExport: (val) => val != null ? String(val) : "—" },
  { key: "signal-max", label: "Signal Max", getValue: (row) => row.signal?.max, render: (val) => (val != null ? `${val}` : "—"), formatExport: (val) => val != null ? String(val) : "—" },
  { key: "signal-avg", label: "Signal Avg", getValue: (row) => row.signal?.avg, render: (val) => (val != null ? `${val}` : "—"), formatExport: (val) => val != null ? String(val) : "—" },
  { key: "firstReading", label: "First Reading", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
  { key: "lastReading", label: "Last Reading", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
];

const REPORT_ID = "device-health";

export function DeviceHealthReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const handleGenerate = async (params: { from: string; to: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.deviceHealth(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Device Health" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="device-health" />
  );
}
