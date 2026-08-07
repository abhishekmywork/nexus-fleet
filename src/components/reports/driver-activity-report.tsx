"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { useReportRestore } from "@/hooks/use-report-restore";

const columns: Column[] = [
  { key: "driverName", label: "Driver" },
  { key: "licenseNumber", label: "License" },
  { key: "plateNumber", label: "Plate" },
  { key: "totalTrips", label: "Trips" },
  { key: "totalDistanceKm", label: "Distance", render: (val) => val != null ? `${Number(val).toFixed(2)} km` : "—" },
  { key: "avgSpeed", label: "Avg Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
];

const REPORT_ID = "driver-activity";

export function DriverActivityReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const restored = useReportRestore(REPORT_ID);

  useEffect(() => {
    if (restored) setData(restored);
  }, [restored]);

  const handleGenerate = async (params: { from: string; to: string; driverId?: string }) => {
    setLoading(true);
    try {
      const result = await api.reports.driverActivity(params);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell title="Driver Activity" reportId={REPORT_ID} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} exportFileName="driver-activity" />
  );
}
