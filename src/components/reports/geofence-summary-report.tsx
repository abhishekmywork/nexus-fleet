"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import type { SearchableSelectOption } from "@/components/common/searchable-select";
import type { ReportMeta } from "./report-shell";

const columns: Column[] = [
  { key: "geofenceName", label: "Geofence" },
  { key: "totalVisits", label: "Visits" },
  { key: "uniqueVehicles", label: "Unique Vehicles" },
  { key: "timestamps", label: "Timestamps", render: (val) => { if (!val || !Array.isArray(val) || val.length === 0) return "—"; return `${val.length} event${val.length !== 1 ? "s" : ""}`; }, getValue: (row) => row.timestamps },
];

const REPORT_ID = "geofence-summary";

export function GeofenceSummaryReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

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
    <ReportShell title="Geofence Summary" reportId={REPORT_ID} reportType={reportType} onReportTypeChange={onReportTypeChange} reportOptions={reportOptions} reportMeta={reportMeta} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="geofence-summary" />
  );
}
