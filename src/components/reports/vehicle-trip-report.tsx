"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { fmtTimestampExport, formatDurationExport } from "./format-helpers";
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
  { key: "startTime", label: "Start", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
  { key: "endTime", label: "End", render: (val) => fmtTimestamp(val), formatExport: (val) => fmtTimestampExport(val) },
  { key: "durationSec", label: "Duration", render: (val) => formatDuration(val), formatExport: (val) => formatDurationExport(val) },
  { key: "distanceKm", label: "Distance", render: (val) => val != null ? `${Number(val).toFixed(2)} km` : "—", formatExport: (val) => val != null ? `${Number(val).toFixed(2)} km` : "—" },
  { key: "avgSpeed", label: "Avg Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—", formatExport: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "maxSpeed", label: "Max Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—", formatExport: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "startLat", label: "Start Lat" },
  { key: "startLon", label: "Start Lon" },
  { key: "endLat", label: "End Lat" },
  { key: "endLon", label: "End Lon" },
  { key: "points", label: "GPS Points", render: (val) => (Array.isArray(val) ? val.length : "—"), formatExport: (val) => Array.isArray(val) ? `${val.length} points` : "—" },
];

const REPORT_ID = "vehicle-trips";

export function VehicleTripReport({ reportType, onReportTypeChange, reportOptions, reportMeta }: {
  reportType: string; onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[]; reportMeta: Record<string, ReportMeta>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const handleGenerate = async (params: { from: string; to: string; deviceId?: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.vehicleTrips(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell
      title="Vehicle Trips"
      reportId={REPORT_ID}
      reportType={reportType}
      onReportTypeChange={onReportTypeChange}
      reportOptions={reportOptions}
      reportMeta={reportMeta}
      onGenerate={handleGenerate}
      loading={loading}
      data={data}
      columns={columns}
      exportFileName="vehicle-trips"
    />
  );
}
