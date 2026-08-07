"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ReportShell, Column } from "./report-shell";
import { useReportRestore } from "@/hooks/use-report-restore";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

const columns: Column[] = [
  { key: "plateNumber", label: "Plate" },
  { key: "eventType", label: "Event" },
  { key: "startedAt", label: "Started", render: (val) => fmtTimestamp(val) },
  { key: "endedAt", label: "Ended", render: (val) => fmtTimestamp(val) },
  { key: "speed", label: "Speed", render: (val) => val != null ? `${Number(val).toFixed(2)} km/h` : "—" },
  { key: "latitude", label: "Lat" },
  { key: "longitude", label: "Lon" },
  { key: "acknowledged", label: "Acknowledged", render: (val) => <Badge variant={val ? "default" : "secondary"}>{val ? "Yes" : "No"}</Badge> },
];

const REPORT_ID = "event-log";

export function EventLogReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const restored = useReportRestore(REPORT_ID);
  const router = useRouter();

  useEffect(() => {
    if (restored) setData(restored);
  }, [restored]);

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
    <ReportShell title="Event Log" reportId={REPORT_ID} onGenerate={handleGenerate} loading={loading} data={data} columns={columns} onViewMap={(row) => router.push(`/live-map?lat=${row.latitude ?? 0}&lng=${row.longitude ?? 0}`)} exportFileName="event-log">
      {({ setParam }: any) => (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Event Type</label>
          <Select onValueChange={(val) => setParam("eventType", val || undefined)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All events" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SPEED">Speed</SelectItem>
              <SelectItem value="IDLE">Idle</SelectItem>
              <SelectItem value="GEOFENCE">Geofence</SelectItem>
              <SelectItem value="IGNITION">Ignition</SelectItem>
              <SelectItem value="MOVEMENT">Movement</SelectItem>
              <SelectItem value="SOS">SOS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </ReportShell>
  );
}
